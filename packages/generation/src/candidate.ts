import { sha256, validateCourseSpec, type CourseSpec, type MaterialSpec, type ReviewDecision, type SlideSpec, type SourceClass } from "@livingcourse/core";
import { validateEvidenceRefs, type EvidenceRef, type MaterialIR } from "@livingcourse/intake";
import type { AuthorityGap, CoursePlanDraft, CoursePlanSlideDraft, KnowledgeCandidate, KnowledgeConflict, SemanticCapabilityIdentity } from "./capabilities.js";
import { deterministicCoursePlan, validateCoursePlanDraft } from "./course-design.js";
import type { GroundingGap, GroundingRequirement } from "./grounding.js";

export interface CandidateEvidenceLocation {
  materialId: string;
  document: string;
  unitKind: MaterialIR["units"][number]["kind"];
  unitIndex: number;
  anchor: string | null;
  technicalRef: EvidenceRef;
}

export interface CandidateSlideEvidence {
  slideId: string;
  knowledgeCandidateIds: string[];
  evidenceRefs: EvidenceRef[];
  sourceLocations: CandidateEvidenceLocation[];
  groundingStatus: "satisfied" | "gap" | "blocked";
}

export interface CourseSpecCandidate {
  courseSpecCandidateVersion: "0.1.0";
  id: string;
  reviewStatus: "pending" | "changes_required" | "approved_for_poc_use" | "approved_for_release";
  draft: CourseSpec;
  learningObjectives: string[];
  understanding: SemanticCapabilityIdentity;
  courseDesign: SemanticCapabilityIdentity;
  slideEvidence: CandidateSlideEvidence[];
  knowledgeCandidates: KnowledgeCandidate[];
  conflicts: KnowledgeConflict[];
  groundingRequirements: GroundingRequirement[];
  groundingGaps: GroundingGap[];
  authorityGaps: AuthorityGap[];
  processing: Array<{ materialId: string; provider: string; processingMode: MaterialIR["provenance"]["processingMode"]; endpointClassification: MaterialIR["provenance"]["endpointClassification"] }>;
  unresolvedQuestions: string[];
  metrics: {
    factualCandidateCount: number;
    evidencedFactualCandidateCount: number;
    evidenceCoverage: number;
    relevantKnowledgePrecision: number;
    unsupportedFactualClaims: number;
    numericFidelityErrors: number;
    negationFidelityErrors: number;
    irrelevantKnowledgeIncluded: number;
    duplicateKnowledgeCandidates: number;
    manualPromptCount: 0;
    manualJsonEditCount: 0;
  };
}

export interface CandidateValidationIssue {
  code: "LC-CANDIDATE-001" | "LC-CANDIDATE-002" | "LC-CANDIDATE-003" | "LC-CANDIDATE-004" | "LC-CANDIDATE-005" | "LC-CANDIDATE-006" | "LC-CANDIDATE-007";
  severity: "error" | "blocking";
  message: string;
}

export interface CandidateReviewDecision {
  candidateId: string;
  reviewer: string;
  reviewedAt: string;
  decision: "approved_for_poc_use" | "approved_for_release" | "changes_required" | "rejected";
  scope: "author_review" | "production";
  comments: string;
  conflictResolutions: Array<{ conflictId: string; selectedCandidateId: string }>;
  authorityResolutions?: Array<{ authorityGapId: string; sourceClass: Exclude<SourceClass, "unknown">; authority: string }>;
  acknowledgedGroundingGapIds: string[];
  testApproval: boolean;
}

export interface CandidateApprovalResult {
  approved: boolean;
  courseSpec: CourseSpec | null;
  issues: CandidateValidationIssue[];
}

const fallbackIdentity = (kind: "understanding" | "course-design"): SemanticCapabilityIdentity => ({
  mode: "literal_deterministic",
  provider: "livingcourse",
  model: kind === "understanding" ? "deterministic-block-knowledge-v2" : "deterministic-course-plan-v2",
  promptTemplateVersion: "not-applicable",
  promptTemplateHash: sha256(kind),
  profileVersion: kind === "understanding" ? "literal-extraction-v2" : "candidate-chunking-v2"
});

const materialType = (material: MaterialIR): MaterialSpec["type"] => {
  const media = material.material.mediaType;
  if (media === "application/pdf") return "pdf";
  if (media.includes("presentation")) return "pptx";
  if (media.includes("wordprocessing")) return "docx";
  if (media === "text/markdown" || media === "text/plain") return "markdown";
  if (media.startsWith("image/")) return "image";
  return "synthetic_source";
};

const sourceClassFor = (candidates: readonly KnowledgeCandidate[], materials: readonly MaterialIR[]): SourceClass => {
  const ids = new Set(candidates.flatMap((candidate) => candidate.evidenceRefs.map((ref) => ref.materialId)));
  const sourceClasses = materials.filter((material) => ids.has(material.material.id)).map((material) => material.material.sourceClass);
  return sourceClasses.includes("controlled_internal") ? "controlled_internal" : sourceClasses[0] ?? "unknown";
};

const criticalTokens = (value: string): string[] => [
  ...(value.match(/[-+]?\d+(?:[.,]\d+)?\s*(?:%|°\s*[CF]|MPa|kPa|bar|mm|cm|m|ms|s|min|h|V|A|Hz)?/giu) ?? []),
  ...(value.match(/禁止|不得|严禁|不要|\bmust\s+not\b|\bdo\s+not\b|\bprohibited\b/giu) ?? [])
].map((token) => token.normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, ""));

const genericPlanningWords = new Set([
  "apply", "author", "course", "employee", "employees", "help", "learn", "learning", "overview", "practice", "recognize", "relevant", "review", "slide", "training", "understand",
  "了解", "作者", "员工", "复习", "课程", "培训", "学习", "应用", "掌握", "审核", "识别"
]);

const planningTokens = (value: string): string[] => value.normalize("NFKC").toLocaleLowerCase().match(/[a-z]{4,}|[\p{Script=Han}]{2,}/gu) ?? [];

const safePlanText = (proposed: string, candidates: readonly KnowledgeCandidate[], fallback: string): string => {
  const candidateTokens = new Set(candidates.flatMap((candidate) => criticalTokens(candidate.claim)));
  if (!criticalTokens(proposed).every((token) => candidateTokens.has(token))) return fallback;
  const corpus = candidates.map((candidate) => candidate.claim.normalize("NFKC").toLocaleLowerCase()).join(" ");
  return planningTokens(proposed).every((token) => genericPlanningWords.has(token) || corpus.includes(token)) ? proposed : fallback;
};

const makeSlide = (
  index: number,
  planned: CoursePlanSlideDraft,
  candidates: readonly KnowledgeCandidate[],
  materials: readonly MaterialIR[],
  gaps: readonly GroundingGap[],
  locale: string
): SlideSpec => {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const group = planned.candidateIds.map((id) => byId.get(id)).filter((candidate): candidate is KnowledgeCandidate => candidate !== undefined);
  const slideId = planned.id?.trim() || `candidate-slide-${String(index + 1).padStart(2, "0")}`;
  const refs = [...new Set(group.flatMap((candidate) => candidate.evidenceRefs.map((ref) => ref.materialId)))].sort();
  const groupGapIds = new Set(gaps.filter((gap) => group.some((candidate) => candidate.id === gap.candidateId)).map((gap) => gap.id));
  const joinedClaims = group.map((candidate) => candidate.claim).join(" ");
  const title = safePlanText(planned.title, group, group[0]?.claim.slice(0, 80) || `Proposed slide ${index + 1}`);
  const purpose = safePlanText(planned.purpose, group, "Proposed course knowledge for author review.");
  return {
    id: slideId,
    order: index + 1,
    type: planned.proposedSlideType,
    knowledge: {
      purpose,
      summary: joinedClaims,
      items: group.map((candidate, itemIndex) => ({ id: candidate.id, order: itemIndex + 1, text: candidate.claim, sourceRefs: [...new Set(candidate.evidenceRefs.map((ref) => ref.materialId))].sort() }))
    },
    presentation: {
      title,
      visualIntent: { summary: planned.visualIntent?.trim() ? safePlanText(planned.visualIntent, group, "Use only reviewed source-grounded visuals after author approval.") : "Use only reviewed source-grounded visuals after author approval.", requirements: [] },
      layout: { kind: planned.proposedSlideType },
      motionIntent: []
    },
    narration: { script: joinedClaims, language: locale, voiceProfile: "pending-author-review", audioAssetRef: null, approvedDurationMs: null, cues: [] },
    grounding: {
      sourceRefs: refs,
      sourceClass: sourceClassFor(group, materials),
      verified: false,
      anchor: null,
      replacementRequirement: groupGapIds.size ? "Complete the guided grounding actions before production approval." : null,
      releaseScope: "author_review"
    },
    governance: {
      riskLevel: group.some((candidate) => candidate.category === "device_operation") ? "device_specific" : group.some((candidate) => ["safety", "process", "quality", "policy"].includes(candidate.category)) ? "procedural_general" : "illustrative",
      reviewStatus: "pending",
      requiredReviewGates: ["course-author-review", "production-release"],
      releaseBlockers: groupGapIds.size ? ["Guided grounding remains incomplete."] : []
    }
  };
};

const locationFor = (ref: EvidenceRef, materials: readonly MaterialIR[]): CandidateEvidenceLocation | null => {
  const material = materials.find((candidate) => candidate.material.id === ref.materialId);
  const unit = material?.units.find((candidate) => candidate.id === ref.unitId);
  if (!material || !unit) return null;
  return { materialId: ref.materialId, document: material.material.originalName, unitKind: unit.kind, unitIndex: unit.index, anchor: ref.anchor ?? null, technicalRef: structuredClone(ref) };
};

const irrelevantMetricPattern = /revision history|copyright|all rights reserved|office lunch policy|修订历史|版权所有|午餐政策/iu;

export const buildCourseSpecCandidate = (input: {
  title: string;
  audience: string;
  purpose: string;
  locale?: string;
  materials: readonly MaterialIR[];
  knowledgeCandidates: readonly KnowledgeCandidate[];
  conflicts: readonly KnowledgeConflict[];
  groundingRequirements: readonly GroundingRequirement[];
  groundingGaps: readonly GroundingGap[];
  authorityGaps: readonly AuthorityGap[];
  coursePlan?: CoursePlanDraft;
  understanding?: SemanticCapabilityIdentity;
  courseDesign?: SemanticCapabilityIdentity;
}): CourseSpecCandidate => {
  const locale = input.locale ?? "en";
  const eligible = input.knowledgeCandidates.filter((candidate) => candidate.evidenceRefs.length > 0 && !["unsupported_candidate", "stale_evidence"].includes(candidate.status));
  const plan = input.coursePlan ?? deterministicCoursePlan({ title: input.title, audience: input.audience, purpose: input.purpose, locale, candidates: eligible, maxSlides: 20 });
  const planErrors = validateCoursePlanDraft(plan, input.knowledgeCandidates, 20);
  if (planErrors.length) throw new Error(`LC-COURSE-PLAN-001: ${planErrors.join("; ")}`);
  const factual = input.knowledgeCandidates.filter((candidate) => candidate.factual);
  const evidenced = factual.filter((candidate) => candidate.evidenceRefs.length > 0 && candidate.status !== "stale_evidence");
  const draft: CourseSpec = {
    courseSpecVersion: "0.2.0",
    course: { id: `course-${sha256({ title: input.title, materials: input.materials.map((material) => material.material.sha256) }).slice(0, 20)}`, title: input.title, version: "candidate-v0.3.2", locale, audience: input.audience, purpose: input.purpose, aspectRatio: "16:9" },
    materials: input.materials.map((material) => ({
      id: material.material.id,
      type: materialType(material),
      path: material.material.originalName,
      ref: null,
      sha256: material.material.sha256,
      title: material.material.originalName,
      version: material.material.version ?? "unknown",
      effectiveDate: material.material.effectiveDate,
      authority: material.material.authority ?? "unconfirmed",
      sourceClass: material.material.sourceClass,
      availability: "available"
    })),
    slides: plan.slides.map((slide, index) => makeSlide(index, slide, input.knowledgeCandidates, input.materials, input.groundingGaps, locale)),
    governance: { lifecycleState: "candidate", targetReleaseScope: "author_review", reviewDecisions: [], securityScanRequired: true }
  };
  const slideEvidence = draft.slides.map((slide) => {
    const ids = new Set(slide.knowledge.items.map((item) => item.id));
    const candidates = input.knowledgeCandidates.filter((candidate) => ids.has(candidate.id));
    const refs = candidates.flatMap((candidate) => candidate.evidenceRefs);
    return {
      slideId: slide.id,
      knowledgeCandidateIds: [...ids],
      evidenceRefs: refs,
      sourceLocations: refs.map((ref) => locationFor(ref, input.materials)).filter((location): location is CandidateEvidenceLocation => location !== null),
      groundingStatus: candidates.some((candidate) => candidate.groundingStatus === "blocked") ? "blocked" as const : candidates.some((candidate) => candidate.groundingStatus === "gap") ? "gap" as const : "satisfied" as const
    };
  });
  const unresolvedQuestions = [
    ...input.conflicts.map((conflict) => `Resolve conflict '${conflict.comparableFactKey}' (${conflict.id}).`),
    ...input.groundingGaps.map((gap) => `${gap.explanation} (${gap.id})`),
    ...input.authorityGaps.map((gap) => `${gap.message} (${gap.id})`)
  ];
  const duplicateCount = factual.length - new Set(factual.map((candidate) => candidate.claim.normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, " ").trim())).size;
  const supportedFactual = factual.filter((candidate) => !["unsupported_candidate", "stale_evidence"].includes(candidate.status));
  const learningObjectives = plan.learningObjectives.length
    ? plan.learningObjectives.map((objective, index) => safePlanText(objective, eligible, eligible[index]?.claim ?? "Review the evidence-grounded course knowledge."))
    : eligible.slice(0, 8).map((candidate) => candidate.claim);
  const candidate = {
    courseSpecCandidateVersion: "0.1.0" as const,
    id: "",
    reviewStatus: "pending" as const,
    draft,
    learningObjectives,
    understanding: structuredClone(input.understanding ?? fallbackIdentity("understanding")),
    courseDesign: structuredClone(input.courseDesign ?? fallbackIdentity("course-design")),
    slideEvidence,
    knowledgeCandidates: input.knowledgeCandidates.map((candidate) => structuredClone(candidate)),
    conflicts: input.conflicts.map((conflict) => structuredClone(conflict)),
    groundingRequirements: input.groundingRequirements.map((requirement) => structuredClone(requirement)),
    groundingGaps: input.groundingGaps.map((gap) => structuredClone(gap)),
    authorityGaps: input.authorityGaps.map((gap) => structuredClone(gap)),
    processing: input.materials.map((material) => ({ materialId: material.material.id, provider: material.provenance.provider, processingMode: material.provenance.processingMode, endpointClassification: material.provenance.endpointClassification })),
    unresolvedQuestions,
    metrics: {
      factualCandidateCount: factual.length,
      evidencedFactualCandidateCount: evidenced.length,
      evidenceCoverage: factual.length ? evidenced.length / factual.length : 1,
      relevantKnowledgePrecision: factual.length ? supportedFactual.filter((item) => !irrelevantMetricPattern.test(item.claim)).length / factual.length : 1,
      unsupportedFactualClaims: factual.filter((item) => item.status === "unsupported_candidate" || item.status === "stale_evidence").length,
      numericFidelityErrors: factual.flatMap((item) => item.fidelityIssues).filter((issue) => issue.kind === "numeric").length,
      negationFidelityErrors: factual.flatMap((item) => item.fidelityIssues).filter((issue) => issue.kind === "negation").length,
      irrelevantKnowledgeIncluded: supportedFactual.filter((item) => irrelevantMetricPattern.test(item.claim)).length,
      duplicateKnowledgeCandidates: duplicateCount,
      manualPromptCount: 0 as const,
      manualJsonEditCount: 0 as const
    }
  };
  return { ...candidate, id: `course-candidate-${sha256(candidate).slice(0, 24)}` };
};

export const validateCourseSpecCandidate = (candidate: CourseSpecCandidate, materials: readonly MaterialIR[]): { valid: boolean; issues: CandidateValidationIssue[] } => {
  const issues: CandidateValidationIssue[] = [];
  const coreValidation = validateCourseSpec(candidate.draft);
  if (!coreValidation.valid) issues.push({ code: "LC-CANDIDATE-001", severity: "error", message: `Draft CourseSpec is invalid: ${coreValidation.errors.map((error) => error.message).join("; ")}` });
  const evidenceValidation = validateEvidenceRefs(materials, candidate.knowledgeCandidates.flatMap((knowledge) => knowledge.evidenceRefs));
  if (evidenceValidation.issues.length) issues.push({ code: "LC-CANDIDATE-002", severity: "error", message: evidenceValidation.issues.map((issue) => issue.message).join("; ") });
  if (candidate.knowledgeCandidates.some((knowledge) => knowledge.factual && (knowledge.evidenceRefs.length === 0 || knowledge.status === "unsupported_candidate" || knowledge.status === "stale_evidence"))) issues.push({ code: "LC-CANDIDATE-003", severity: "blocking", message: "A factual candidate is unsupported or stale and cannot become approved knowledge." });
  if (candidate.knowledgeCandidates.some((knowledge) => knowledge.fidelityIssues.some((issue) => issue.kind === "numeric"))) issues.push({ code: "LC-CANDIDATE-005", severity: "blocking", message: "Numeric evidence fidelity failed for at least one factual candidate." });
  if (candidate.knowledgeCandidates.some((knowledge) => knowledge.fidelityIssues.some((issue) => issue.kind === "negation"))) issues.push({ code: "LC-CANDIDATE-006", severity: "blocking", message: "Negation or prohibition evidence fidelity failed for at least one factual candidate." });
  const knowledgeById = new Map(candidate.knowledgeCandidates.map((knowledge) => [knowledge.id, knowledge]));
  if (candidate.draft.slides.some((slide) => slide.narration.language !== candidate.draft.course.locale
    || slide.knowledge.items.some((item) => {
      const knowledge = knowledgeById.get(item.id);
      return !knowledge || knowledge.claim !== item.text || knowledge.evidenceRefs.length === 0 || knowledge.status === "unsupported_candidate" || knowledge.status === "stale_evidence";
    }))) issues.push({ code: "LC-CANDIDATE-007", severity: "blocking", message: "Course design references invalid knowledge or has inconsistent narration locale." });
  if (candidate.reviewStatus === "pending") issues.push({ code: "LC-CANDIDATE-004", severity: "blocking", message: "Explicit human review is required before the compiler may receive a CourseSpec." });
  return { valid: issues.length === 0, issues };
};

const reviewDecisionFor = (candidate: CourseSpecCandidate, decision: CandidateReviewDecision): ReviewDecision => ({
  artifactId: candidate.draft.course.id,
  gateId: "course-author-review",
  decision: decision.decision === "approved_for_release" ? "approved_for_release" : "approved_for_poc_use",
  reviewer: decision.testApproval ? `${decision.reviewer} (test approval)` : decision.reviewer,
  reviewedAt: decision.reviewedAt,
  scope: decision.scope,
  comments: decision.comments,
  acceptedRisks: decision.acknowledgedGroundingGapIds.map((id) => ({ code: id, rationale: "Acknowledged for author-review scope only; production blocker retained." }))
});

export const approveCourseSpecCandidate = (candidate: CourseSpecCandidate, materials: readonly MaterialIR[], decision?: CandidateReviewDecision): CandidateApprovalResult => {
  const issues = validateCourseSpecCandidate({ ...candidate, reviewStatus: decision?.decision === "approved_for_release" ? "approved_for_release" : decision?.decision === "approved_for_poc_use" ? "approved_for_poc_use" : candidate.reviewStatus }, materials).issues.filter((issue) => issue.code !== "LC-CANDIDATE-004");
  if (!decision || decision.candidateId !== candidate.id || !["approved_for_poc_use", "approved_for_release"].includes(decision.decision)) {
    return { approved: false, courseSpec: null, issues: [...issues, { code: "LC-CANDIDATE-004", severity: "blocking", message: "A matching explicit human approval decision is required." }] };
  }
  const resolutionByConflict = new Map(decision.conflictResolutions.map((resolution) => [resolution.conflictId, resolution.selectedCandidateId]));
  for (const conflict of candidate.conflicts) {
    const selected = resolutionByConflict.get(conflict.id);
    if (!selected || !conflict.candidateIds.includes(selected)) issues.push({ code: "LC-CANDIDATE-003", severity: "blocking", message: `Conflict '${conflict.id}' requires a valid human selection.` });
  }
  const acknowledged = new Set(decision.acknowledgedGroundingGapIds);
  if (decision.scope === "production" && candidate.groundingGaps.length) issues.push({ code: "LC-CANDIDATE-003", severity: "blocking", message: "Production approval is blocked while grounding gaps remain." });
  const authorityResolutionByGap = new Map((decision.authorityResolutions ?? []).map((resolution) => [resolution.authorityGapId, resolution]));
  for (const gap of candidate.authorityGaps) {
    const resolution = authorityResolutionByGap.get(gap.id);
    if (!resolution?.authority.trim()) issues.push({ code: "LC-CANDIDATE-003", severity: "blocking", message: `Authority gap '${gap.id}' requires a structured human source-class and owner decision.` });
  }
  if (decision.scope === "author_review" && candidate.groundingGaps.some((gap) => !acknowledged.has(gap.id))) issues.push({ code: "LC-CANDIDATE-003", severity: "blocking", message: "Every remaining grounding gap must be acknowledged for author-review approval." });
  if (issues.length) return { approved: false, courseSpec: null, issues };
  const rejectedCandidateIds = new Set(candidate.conflicts.flatMap((conflict) => conflict.candidateIds.filter((id) => id !== resolutionByConflict.get(conflict.id))));
  const courseSpec: CourseSpec = structuredClone(candidate.draft);
  courseSpec.materials = courseSpec.materials.map((material) => {
    const gap = candidate.authorityGaps.find((candidateGap) => candidateGap.materialId === material.id);
    const resolution = gap ? authorityResolutionByGap.get(gap.id) : undefined;
    return resolution ? { ...material, sourceClass: resolution.sourceClass, authority: resolution.authority.trim() } : material;
  });
  courseSpec.slides = courseSpec.slides.map((slide) => ({
    ...slide,
    knowledge: { ...slide.knowledge, items: slide.knowledge.items.filter((item) => !rejectedCandidateIds.has(item.id)) },
    governance: { ...slide.governance, reviewStatus: decision.decision, releaseBlockers: [...slide.governance.releaseBlockers] }
  }));
  courseSpec.governance.lifecycleState = decision.decision;
  courseSpec.governance.targetReleaseScope = decision.scope;
  courseSpec.governance.reviewDecisions.push(reviewDecisionFor(candidate, decision));
  return { approved: true, courseSpec, issues: [] };
};

const pageLabel = (location: CandidateEvidenceLocation): string => {
  const label = location.unitKind === "slide" ? "Slide" : location.unitKind === "page" ? "Page" : location.unitKind === "section" ? "Section" : location.unitKind;
  return `${label} ${location.unitIndex + 1}${location.anchor ? ` / ${location.anchor}` : ""}`;
};

export const renderCourseReviewPackage = (candidate: CourseSpecCandidate): string => {
  const zh = candidate.draft.course.locale.toLocaleLowerCase().startsWith("zh");
  const slides = candidate.draft.slides.map((slide, index) => {
    const evidence = candidate.slideEvidence.find((entry) => entry.slideId === slide.id);
    const knowledge = slide.knowledge.items.map((item) => `  - ${item.text}`).join("\n");
    const locations = evidence?.sourceLocations.map((location) => `  - ${location.document} — ${pageLabel(location)}`).join("\n") || "  - No evidence";
    const conflicts = candidate.conflicts.filter((conflict) => conflict.candidateIds.some((id) => evidence?.knowledgeCandidateIds.includes(id))).map((conflict) => `  - ${conflict.comparableFactKey}: ${conflict.recommendedAction}`).join("\n") || "  - None";
    const gaps = candidate.groundingGaps.filter((gap) => evidence?.knowledgeCandidateIds.includes(gap.candidateId)).map((gap) => `  - ${gap.explanation}\n${gap.resolutionActions.map((action) => `    [ ] ${action.label}`).join("\n")}\n    This does NOT block Author Review.\n    This DOES block Production Release.`).join("\n") || "  - Satisfied";
    const risk = slide.governance.riskLevel;
    return zh
      ? `## 第 ${index + 1} 页：${slide.presentation.title}\n\n本页目的：${slide.knowledge.purpose}\n\n员工应掌握：\n${knowledge}\n\n来源证据：\n${locations}\n\n风险：${risk}\n\n冲突：\n${conflicts}\n\n证据落地状态：${evidence?.groundingStatus ?? "blocked"}\n${gaps}`
      : `## Slide ${index + 1}: ${slide.presentation.title}\n\nWhy this slide exists: ${slide.knowledge.purpose}\n\nWhat employees should learn:\n${knowledge}\n\nSource evidence:\n${locations}\n\nRisk: ${risk}\n\nConflict:\n${conflicts}\n\nGrounding status: ${evidence?.groundingStatus ?? "blocked"}\n${gaps}`;
  }).join("\n\n");
  const processing = candidate.processing.map((entry) => `- ${entry.materialId}: provider ${entry.provider}; mode ${entry.processingMode}; endpoint ${entry.endpointClassification}`).join("\n");
  const understanding = candidate.understanding.mode === "semantic_ai"
    ? `Knowledge understanding:\nSemantic AI-assisted extraction\nProvider: ${candidate.understanding.provider}; model: ${candidate.understanding.model}; prompt: ${candidate.understanding.promptTemplateVersion}`
    : "Semantic course understanding: NOT AVAILABLE\nFallback: Literal deterministic extraction\nCourse quality may require more human editing.";
  const courseDesign = `Course design:\nMode: ${candidate.courseDesign.mode}\nProvider: ${candidate.courseDesign.provider}; model: ${candidate.courseDesign.model}; prompt: ${candidate.courseDesign.promptTemplateVersion}`;
  const authority = candidate.authorityGaps.map((gap) => `### ${gap.message}\n\nWhich source should control this topic?\n\n[ ] Current approved SOP\n[ ] Archived PPT\n[ ] Manufacturer manual\n[ ] Other\n\n${gap.resolutionAction}`).join("\n\n") || "- No authority gaps detected.";
  const objectives = candidate.learningObjectives.map((objective) => `- ${objective}`).join("\n") || "- Confirm objectives during author review.";
  const technical = candidate.slideEvidence.flatMap((entry) => entry.evidenceRefs.map((ref) => `- ${entry.slideId}: ${ref.materialId} / ${ref.unitId} / ${ref.blockId}`)).join("\n") || "- None";
  const heading = zh ? "# 课程审核包" : "# Course Review Package";
  const courseFacts = zh
    ? `课程标题：${candidate.draft.course.title}\n\n受众：${candidate.draft.course.audience}\n\n培训目的：${candidate.draft.course.purpose}\n\n学习目标：\n${objectives}`
    : `Course title: ${candidate.draft.course.title}\n\nAudience: ${candidate.draft.course.audience}\n\nLearning purpose: ${candidate.draft.course.purpose}\n\nLearning objectives:\n${objectives}`;
  return `${heading}\n\n${courseFacts}\n\n${understanding}\n\n${courseDesign}\n\nReview status: Human approval required\n\n## Quality metrics\n\n- Relevant knowledge precision: ${(candidate.metrics.relevantKnowledgePrecision * 100).toFixed(0)}%\n- Factual evidence coverage: ${(candidate.metrics.evidenceCoverage * 100).toFixed(0)}%\n- Unsupported factual claims: ${candidate.metrics.unsupportedFactualClaims}\n- Numeric fidelity errors: ${candidate.metrics.numericFidelityErrors}\n- Negation fidelity errors: ${candidate.metrics.negationFidelityErrors}\n- Duplicate knowledge candidates: ${candidate.metrics.duplicateKnowledgeCandidates}\n\n## Source processing and privacy\n\n${processing}\n\n${slides}\n\n# Authority review\n\n${authority}\n\nRecord each selection as a structured authority resolution; do not edit the candidate JSON.\n\n# Unresolved questions\n\n${candidate.unresolvedQuestions.map((question) => `- ${question}`).join("\n") || "- None"}\n\n# Review decision\n\n[ ] Approve for author review\n[ ] Changes Required\n\nComments:\n\n# Technical evidence appendix\n\n${technical}\n`;
};
