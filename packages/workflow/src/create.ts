import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeterministicBlockKnowledgeProvider,
  DeterministicCourseDesignProvider,
  buildCourseSpecCandidate,
  detectKnowledgeConflicts,
  findAuthorityGaps,
  renderCourseReviewPackage,
  resolveGrounding,
  type CourseDesignCapability,
  type CourseSpecCandidate,
  type KnowledgeConflict,
  type KnowledgeUnderstandingCapability
} from "@livingcourse/generation";
import { executeIntake, planIntake, type IntakeExecutionResult, type IntakePlanResult, type IntakeWorkflowOptions } from "./intake.js";
import { executeSemanticAuthoring, planSemanticAuthoring, type SemanticCallCounts, type SemanticPlan } from "./semantic-authoring.js";

export interface CreatePlanResult {
  intake: IntakePlanResult;
  semantic: SemanticPlan;
  aiCallPlan: { knowledgeUnderstanding: number; courseDesign: number; total: number };
  blockers: string[];
}

export interface CreateExecutionResult {
  intake: IntakeExecutionResult;
  candidate: CourseSpecCandidate;
  candidatePath: string;
  reviewPackagePath: string;
  aiCalls: SemanticCallCounts;
  semantic: { changedMaterials: string[]; reusedMaterials: string[]; candidateSetHash: string };
  manualPromptCount: 0;
  manualJsonEditCount: 0;
}

export interface CreateWorkflowOptions extends IntakeWorkflowOptions {
  title?: string;
  audience?: string;
  purpose?: string;
  locale?: string;
  outputRoot?: string;
  semanticCacheRoot?: string;
  knowledgeUnderstanding?: KnowledgeUnderstandingCapability;
  courseDesign?: CourseDesignCapability;
  maxSlides?: number;
}

const semanticOptionsFor = (folder: string, options: CreateWorkflowOptions) => {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const semanticCacheRoot = options.semanticCacheRoot
    ?? (options.cacheRoot ? `${path.resolve(options.cacheRoot)}-semantic` : path.join(workspaceRoot, ".livingcourse", "semantic"));
  return {
    cacheRoot: path.resolve(semanticCacheRoot),
    title: options.title ?? path.basename(path.resolve(folder)),
    audience: options.audience ?? "Course audience to confirm during author review",
    purpose: options.purpose ?? "Convert the supplied materials into a reviewable course plan",
    locale: options.locale ?? "en",
    maxSlides: options.maxSlides ?? 20,
    knowledge: options.knowledgeUnderstanding ?? new DeterministicBlockKnowledgeProvider(),
    courseDesign: options.courseDesign ?? new DeterministicCourseDesignProvider()
  };
};

export const planCreate = async (folder: string, options: CreateWorkflowOptions = {}): Promise<CreatePlanResult> => {
  const intake = await planIntake(folder, options);
  const semantic = await planSemanticAuthoring(intake, semanticOptionsFor(folder, options));
  return {
    intake,
    semantic,
    aiCallPlan: { knowledgeUnderstanding: semantic.knowledgeUnderstandingCalls, courseDesign: semantic.courseDesignCalls, total: semantic.totalAiCalls },
    blockers: [...intake.blockers]
  };
};

export const executeCreate = async (folder: string, options: CreateWorkflowOptions = {}): Promise<CreateExecutionResult> => {
  const intake = await executeIntake(folder, options);
  const semanticOptions = semanticOptionsFor(folder, options);
  let conflicts: KnowledgeConflict[] = [];
  let grounding: ReturnType<typeof resolveGrounding> = { candidates: [], requirements: [], gaps: [] };
  const semantic = await executeSemanticAuthoring(
    intake.materials,
    Object.fromEntries(intake.plan.files.flatMap((item) => item.cacheFingerprint ? [[item.input.originalName, item.cacheFingerprint]] : [])),
    semanticOptions,
    (resolvedCandidates) => {
      const conflictAnalysis = detectKnowledgeConflicts(resolvedCandidates, intake.materials);
      conflicts = conflictAnalysis.conflicts;
      grounding = resolveGrounding(conflictAnalysis.candidates, intake.materials);
      return grounding.candidates;
    }
  );
  const candidate = buildCourseSpecCandidate({
    title: semanticOptions.title,
    audience: semanticOptions.audience,
    purpose: semanticOptions.purpose,
    locale: semanticOptions.locale,
    materials: intake.materials,
    knowledgeCandidates: semantic.candidates,
    conflicts,
    groundingRequirements: grounding.requirements,
    groundingGaps: grounding.gaps,
    authorityGaps: findAuthorityGaps(intake.materials),
    coursePlan: semantic.coursePlan,
    understanding: semanticOptions.knowledge.identity,
    courseDesign: semanticOptions.courseDesign.identity
  });
  const outputRoot = path.resolve(options.outputRoot ?? path.join(options.workspaceRoot ?? process.cwd(), ".livingcourse", "review", candidate.id));
  await mkdir(outputRoot, { recursive: true });
  const candidatePath = path.join(outputRoot, "course-spec-candidate.json");
  const reviewPackagePath = path.join(outputRoot, "COURSE-REVIEW.md");
  const parserDisclosure = intake.plan.files
    .filter((item) => item.parser !== "built-in-text" && item.parser !== "none")
    .map((item) => ({
      parser: item.parser === "mineru-cloud" ? "MinerU Cloud" : item.parser === "mineru" ? "MinerU Self-hosted" : item.parser,
      processing: item.processingMode === "remote" ? "Remote" : "Local"
    }))
    .filter((entry, index, entries) => entries.findIndex((candidateEntry) => candidateEntry.parser === entry.parser && candidateEntry.processing === entry.processing) === index)
    .map((entry) => `- Document parser: ${entry.parser}\n- Processing: ${entry.processing}`)
    .join("\n");
  const renderedReview = `${renderCourseReviewPackage(candidate)}${parserDisclosure ? `\n## Document parser disclosure\n\n${parserDisclosure}\n` : ""}`;
  await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  await writeFile(reviewPackagePath, renderedReview, "utf8");
  return {
    intake,
    candidate,
    candidatePath,
    reviewPackagePath,
    aiCalls: semantic.calls,
    semantic: { changedMaterials: semantic.changedMaterials, reusedMaterials: semantic.reusedMaterials, candidateSetHash: semantic.candidateSetHash },
    manualPromptCount: 0,
    manualJsonEditCount: 0
  };
};
