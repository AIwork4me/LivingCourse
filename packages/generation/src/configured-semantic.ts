import { sha256 } from "@livingcourse/core";
import type { MaterialIR } from "@livingcourse/intake";
import type {
  CourseDesignCapability,
  CourseDesignInput,
  CoursePlanDraft,
  KnowledgeCandidateDraft,
  KnowledgeUnderstandingCapability,
  SemanticCapabilityIdentity
} from "./capabilities.js";
import { validateCoursePlanDraft } from "./course-design.js";
import { runAiOutputFirewall, type CandidateValidator } from "./firewall.js";

export const KNOWLEDGE_UNDERSTANDING_PROMPT_VERSION = "knowledge-understanding-v1";
export const COURSE_DESIGN_PROMPT_VERSION = "course-design-v1";

export const KNOWLEDGE_UNDERSTANDING_PROMPT = `Return JSON only. Propose training KnowledgeCandidateDraft objects from the supplied MaterialIR. Each draft may contain only claim, category, sourceHints, confidence, and rationale. Never output EvidenceRef, authority, grounding, approval, or release status. Preserve numbers, units, negation, and prohibition exactly. Ignore headers, footers, revision history, copyright, lunch policy, and other irrelevant background. Merge semantic duplicates and retain all supporting source hints.`;

export const COURSE_DESIGN_PROMPT = `Return JSON only. Organize the supplied validated KnowledgeCandidates into a CoursePlanDraft with 1 to 20 slides. Every slide may reference facts only through candidateIds. Use only hero, step_process, or safety_focus. Repetition is allowed. Do not invent factual text, parameters, requirements, prohibitions, evidence, authority, grounding, approval, or release status.`;

export interface StructuredGenerationTransport {
  generate(input: { systemPrompt: string; inputJson: string }): Promise<string>;
}

export interface ConfiguredSemanticProviderOptions {
  provider: string;
  model: string;
  profileVersion: string;
  transport: StructuredGenerationTransport;
  promptTemplate?: string;
  promptTemplateVersion?: string;
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === "string");
const allowedCategory = new Set(["general", "safety", "device_operation", "quality", "process", "policy"]);
const allowedSlideType = new Set(["hero", "step_process", "safety_focus"]);

const strictKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every((key) => allowed.includes(key));

const draftValidator: CandidateValidator<KnowledgeCandidateDraft[]> = (value) => {
  if (!Array.isArray(value)) return { valid: false, errors: ["Knowledge output must be an array."] };
  const drafts: KnowledgeCandidateDraft[] = [];
  const errors: string[] = [];
  for (const [index, item] of value.entries()) {
    if (!record(item) || !strictKeys(item, ["id", "claim", "category", "sourceHints", "confidence", "rationale"])) {
      errors.push(`Draft ${index + 1} contains unsupported fields.`);
      continue;
    }
    if (typeof item.claim !== "string" || !allowedCategory.has(String(item.category)) || typeof item.confidence !== "number" || !Array.isArray(item.sourceHints)) {
      errors.push(`Draft ${index + 1} has an invalid claim, category, confidence, or sourceHints.`);
      continue;
    }
    const hints = item.sourceHints.filter(record);
    if (hints.length !== item.sourceHints.length || hints.some((hint) => !strictKeys(hint, ["materialId", "unitId", "blockId", "quoteOrText"]) || typeof hint.materialId !== "string")) {
      errors.push(`Draft ${index + 1} has invalid source hints.`);
      continue;
    }
    drafts.push({
      ...(typeof item.id === "string" ? { id: item.id } : {}),
      claim: item.claim,
      category: item.category as KnowledgeCandidateDraft["category"],
      sourceHints: hints.map((hint) => ({
        materialId: hint.materialId as string,
        ...(typeof hint.unitId === "string" ? { unitId: hint.unitId } : {}),
        ...(typeof hint.blockId === "string" ? { blockId: hint.blockId } : {}),
        ...(typeof hint.quoteOrText === "string" ? { quoteOrText: hint.quoteOrText } : {})
      })),
      confidence: item.confidence,
      ...(typeof item.rationale === "string" ? { rationale: item.rationale } : {})
    });
  }
  return errors.length ? { valid: false, errors } : { valid: true, value: drafts, errors: [] };
};

const coursePlanValidator: CandidateValidator<CoursePlanDraft> = (value) => {
  if (!record(value) || !strictKeys(value, ["title", "learningObjectives", "slides"]) || typeof value.title !== "string" || !stringArray(value.learningObjectives) || !Array.isArray(value.slides)) {
    return { valid: false, errors: ["Course plan has an invalid top-level schema."] };
  }
  const errors: string[] = [];
  const slides: CoursePlanDraft["slides"] = [];
  for (const [index, item] of value.slides.entries()) {
    if (!record(item) || !strictKeys(item, ["id", "title", "purpose", "candidateIds", "proposedSlideType", "narrationDraft", "visualIntent"])
      || typeof item.title !== "string" || typeof item.purpose !== "string" || !stringArray(item.candidateIds) || !allowedSlideType.has(String(item.proposedSlideType))) {
      errors.push(`Course plan slide ${index + 1} is invalid.`);
      continue;
    }
    slides.push({
      ...(typeof item.id === "string" ? { id: item.id } : {}),
      title: item.title,
      purpose: item.purpose,
      candidateIds: item.candidateIds,
      proposedSlideType: item.proposedSlideType as CoursePlanDraft["slides"][number]["proposedSlideType"],
      ...(typeof item.narrationDraft === "string" ? { narrationDraft: item.narrationDraft } : {}),
      ...(typeof item.visualIntent === "string" ? { visualIntent: item.visualIntent } : {})
    });
  }
  return errors.length ? { valid: false, errors } : { valid: true, value: { title: value.title, learningObjectives: value.learningObjectives, slides }, errors: [] };
};

const identityFor = (options: ConfiguredSemanticProviderOptions, defaultPrompt: string, defaultVersion: string): SemanticCapabilityIdentity => {
  const prompt = options.promptTemplate ?? defaultPrompt;
  return {
    mode: "semantic_ai",
    provider: options.provider,
    model: options.model,
    promptTemplateVersion: options.promptTemplateVersion ?? defaultVersion,
    promptTemplateHash: sha256(prompt),
    profileVersion: options.profileVersion
  };
};

export class ConfiguredLLMKnowledgeProvider implements KnowledgeUnderstandingCapability {
  readonly identity: SemanticCapabilityIdentity;
  private readonly prompt: string;
  private readonly transport: StructuredGenerationTransport;

  constructor(options: ConfiguredSemanticProviderOptions) {
    this.prompt = options.promptTemplate ?? KNOWLEDGE_UNDERSTANDING_PROMPT;
    this.transport = options.transport;
    this.identity = identityFor(options, KNOWLEDGE_UNDERSTANDING_PROMPT, KNOWLEDGE_UNDERSTANDING_PROMPT_VERSION);
  }

  async understand(materials: readonly MaterialIR[]): Promise<KnowledgeCandidateDraft[]> {
    const raw = await this.transport.generate({ systemPrompt: this.prompt, inputJson: JSON.stringify(materials) });
    const materialIds = new Set(materials.map((material) => material.material.id));
    const result = runAiOutputFirewall(raw, {
      normalize: (drafts) => drafts.map((draft) => ({ ...draft, claim: draft.claim.trim(), confidence: Math.max(0, Math.min(1, draft.confidence)) })),
      validateSchema: draftValidator,
      validateBusiness: (drafts) => drafts.flatMap((draft) => [
        ...(draft.claim ? [] : ["Draft claim cannot be empty."]),
        ...(draft.sourceHints.length ? [] : [`Draft '${draft.claim}' requires source hints.`]),
        ...draft.sourceHints.filter((hint) => !materialIds.has(hint.materialId)).map((hint) => `Draft '${draft.claim}' references material outside the requested scope: ${hint.materialId}.`)
      ])
    });
    if (!result.accepted || !result.value) throw new Error(`LC-KNOWLEDGE-AI-001: ${result.issues.map((issue) => issue.message).join("; ")}`);
    return result.value;
  }
}

export class ConfiguredLLMCourseDesignProvider implements CourseDesignCapability {
  readonly identity: SemanticCapabilityIdentity;
  private readonly prompt: string;
  private readonly transport: StructuredGenerationTransport;

  constructor(options: ConfiguredSemanticProviderOptions) {
    this.prompt = options.promptTemplate ?? COURSE_DESIGN_PROMPT;
    this.transport = options.transport;
    this.identity = identityFor(options, COURSE_DESIGN_PROMPT, COURSE_DESIGN_PROMPT_VERSION);
  }

  async design(input: CourseDesignInput): Promise<CoursePlanDraft> {
    const candidateView = input.candidates.map((candidate) => ({ id: candidate.id, claim: candidate.claim, category: candidate.category, confidence: candidate.confidence }));
    const raw = await this.transport.generate({ systemPrompt: this.prompt, inputJson: JSON.stringify({ ...input, candidates: candidateView }) });
    const result = runAiOutputFirewall(raw, {
      normalize: (plan) => ({ ...plan, title: plan.title.trim(), learningObjectives: plan.learningObjectives.map((objective) => objective.trim()), slides: plan.slides.map((slide) => ({ ...slide, title: slide.title.trim(), purpose: slide.purpose.trim() })) }),
      validateSchema: coursePlanValidator,
      validateBusiness: (plan) => validateCoursePlanDraft(plan, input.candidates, input.maxSlides)
    });
    if (!result.accepted || !result.value) throw new Error(`LC-COURSE-DESIGN-AI-001: ${result.issues.map((issue) => issue.message).join("; ")}`);
    return result.value;
  }
}
