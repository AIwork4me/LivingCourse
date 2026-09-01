import { sha256, validateCourseSpec, type CourseSpec, type MaterialSpec, type ReviewDecision, type SlideSpec, type SlideType, type SourceClass } from "@livingcourse/core";
import { validateEvidenceRefs, type EvidenceRef, type MaterialIR } from "@livingcourse/intake";
import type { AuthorityGap, KnowledgeCandidate, KnowledgeConflict } from "./capabilities.js";
import type { GroundingGap, GroundingRequirement } from "./grounding.js";

export interface CandidateSlideEvidence {
  slideId: string;
  knowledgeCandidateIds: string[];
  evidenceRefs: EvidenceRef[];
  groundingStatus: "satisfied" | "gap" | "blocked";
}

export interface CourseSpecCandidate {
  courseSpecCandidateVersion: "0.1.0";
  id: string;
  reviewStatus: "pending" | "changes_required" | "approved_for_poc_use" | "approved_for_release";
  draft: CourseSpec;
  slideEvidence: CandidateSlideEvidence[];
  knowledgeCandidates: KnowledgeCandidate[];
  conflicts: KnowledgeConflict[];
  groundingRequirements: GroundingRequirement[];
  groundingGaps: GroundingGap[];
  authorityGaps: AuthorityGap[];
  processing: Array<{ materialId: string; provider: string; processingMode: MaterialIR["provenance"]["processingMode"]; endpointClassification: MaterialIR["provenance"]["endpointClassification"] }>;
  unresolvedQuestions: string[];
  metrics: { factualCandidateCount: number; evidencedFactualCandidateCount: number; evidenceCoverage: number; manualPromptCount: 0; manualJsonEditCount: 0 };
}

export interface CandidateValidationIssue {
  code: "LC-CANDIDATE-001" | "LC-CANDIDATE-002" | "LC-CANDIDATE-003" | "LC-CANDIDATE-004";
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
  acknowledgedGroundingGapIds: string[];
  testApproval: boolean;
}

export interface CandidateApprovalResult {
  approved: boolean;
  courseSpec: CourseSpec | null;
  issues: CandidateValidationIssue[];
}

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

const slideTypeAt = (index: number): SlideType => (["hero", "step_process", "safety_focus"] as const)[Math.min(index, 2)] ?? "safety_focus";

const makeSlide = (index: number, group: readonly KnowledgeCandidate[], materials: readonly MaterialIR[], gaps: readonly GroundingGap[]): SlideSpec => {
  const type = slideTypeAt(index);
  const slideId = `candidate-slide-${String(index + 1).padStart(2, "0")}`;
  const refs = [...new Set(group.flatMap((candidate) => candidate.evidenceRefs.map((ref) => ref.materialId)))].sort();
  const groupGapIds = new Set(gaps.filter((gap) => group.some((candidate) => candidate.id === gap.candidateId)).map((gap) => gap.id));
  return {
    id: slideId,
    order: index + 1,
    type,
    knowledge: {
      purpose: "Proposed course knowledge for author review.",
      summary: group.map((candidate) => candidate.claim).join(" "),
      items: group.map((candidate, itemIndex) => ({ id: candidate.id, order: itemIndex + 1, text: candidate.claim, sourceRefs: [...new Set(candidate.evidenceRefs.map((ref) => ref.materialId))].sort() }))
    },
    presentation: {
      title: group[0]?.claim.slice(0, 80) || `Proposed slide ${index + 1}`,
      visualIntent: { summary: "Visual direction will be generated only after author approval.", requirements: [] },
      layout: { kind: type },
      motionIntent: []
    },
    narration: { script: group.map((candidate) => candidate.claim).join(" "), language: "en", voiceProfile: "pending-author-review", audioAssetRef: null, approvedDurationMs: null, cues: [] },
    grounding: {
      sourceRefs: refs,
      sourceClass: sourceClassFor(group, materials),
      verified: false,
      anchor: null,
      replacementRequirement: groupGapIds.size ? "Complete the guided grounding actions before production approval." : null,
      releaseScope: "author_review"
    },
    governance: {
      riskLevel: group.some((candidate) => candidate.category === "device_operation") ? "device_specific" : group.some((candidate) => candidate.category === "safety") ? "procedural_general" : "illustrative",
      reviewStatus: "pending",
      requiredReviewGates: ["course-author-review", "production-release"],
      releaseBlockers: groupGapIds.size ? ["Guided grounding remains incomplete."] : []
    }
  };
};

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
}): CourseSpecCandidate => {
  const factual = input.knowledgeCandidates.filter((candidate) => candidate.factual);
  const evidenced = factual.filter((candidate) => candidate.evidenceRefs.length > 0);
  const groups = [
    input.knowledgeCandidates.filter((candidate) => candidate.category === "general"),
    input.knowledgeCandidates.filter((candidate) => candidate.category === "safety"),
    input.knowledgeCandidates.filter((candidate) => candidate.category === "device_operation")
  ].filter((group) => group.length > 0);
  const draft: CourseSpec = {
    courseSpecVersion: "0.2.0",
    course: { id: `course-${sha256({ title: input.title, materials: input.materials.map((material) => material.material.sha256) }).slice(0, 20)}`, title: input.title, version: "candidate-v0.3", locale: input.locale ?? "en", audience: input.audience, purpose: input.purpose, aspectRatio: "16:9" },
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
    slides: groups.map((group, index) => makeSlide(index, group, input.materials, input.groundingGaps)),
    governance: { lifecycleState: "candidate", targetReleaseScope: "author_review", reviewDecisions: [], securityScanRequired: true }
  };
  const slideEvidence = draft.slides.map((slide) => {
    const ids = new Set(slide.knowledge.items.map((item) => item.id));
    const candidates = input.knowledgeCandidates.filter((candidate) => ids.has(candidate.id));
    return { slideId: slide.id, knowledgeCandidateIds: [...ids], evidenceRefs: candidates.flatMap((candidate) => candidate.evidenceRefs), groundingStatus: candidates.some((candidate) => candidate.groundingStatus === "blocked") ? "blocked" as const : candidates.some((candidate) => candidate.groundingStatus === "gap") ? "gap" as const : "satisfied" as const };
  });
  const unresolvedQuestions = [
    ...input.conflicts.map((conflict) => `Resolve conflict '${conflict.comparableFactKey}' (${conflict.id}).`),
    ...input.groundingGaps.map((gap) => `${gap.explanation} (${gap.id})`),
    ...input.authorityGaps.map((gap) => `${gap.message} (${gap.id})`)
  ];
  const candidate = {
    courseSpecCandidateVersion: "0.1.0" as const,
    id: "",
    reviewStatus: "pending" as const,
    draft,
    slideEvidence,
    knowledgeCandidates: input.knowledgeCandidates.map((candidate) => structuredClone(candidate)),
    conflicts: input.conflicts.map((conflict) => structuredClone(conflict)),
    groundingRequirements: input.groundingRequirements.map((requirement) => structuredClone(requirement)),
    groundingGaps: input.groundingGaps.map((gap) => structuredClone(gap)),
    authorityGaps: input.authorityGaps.map((gap) => structuredClone(gap)),
    processing: input.materials.map((material) => ({ materialId: material.material.id, provider: material.provenance.provider, processingMode: material.provenance.processingMode, endpointClassification: material.provenance.endpointClassification })),
    unresolvedQuestions,
    metrics: { factualCandidateCount: factual.length, evidencedFactualCandidateCount: evidenced.length, evidenceCoverage: factual.length ? evidenced.length / factual.length : 1, manualPromptCount: 0 as const, manualJsonEditCount: 0 as const }
  };
  return { ...candidate, id: `course-candidate-${sha256(candidate).slice(0, 24)}` };
};

export const validateCourseSpecCandidate = (candidate: CourseSpecCandidate, materials: readonly MaterialIR[]): { valid: boolean; issues: CandidateValidationIssue[] } => {
  const issues: CandidateValidationIssue[] = [];
  const coreValidation = validateCourseSpec(candidate.draft);
  if (!coreValidation.valid) issues.push({ code: "LC-CANDIDATE-001", severity: "error", message: `Draft CourseSpec is invalid: ${coreValidation.errors.map((error) => error.message).join("; ")}` });
  const evidenceValidation = validateEvidenceRefs(materials, candidate.knowledgeCandidates.flatMap((knowledge) => knowledge.evidenceRefs));
  if (evidenceValidation.issues.length) issues.push({ code: "LC-CANDIDATE-002", severity: "error", message: evidenceValidation.issues.map((issue) => issue.message).join("; ") });
  if (candidate.knowledgeCandidates.some((knowledge) => knowledge.factual && knowledge.evidenceRefs.length === 0)) issues.push({ code: "LC-CANDIDATE-003", severity: "blocking", message: "A factual candidate lacks evidence and cannot become approved knowledge." });
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
  if (candidate.authorityGaps.length) issues.push({ code: "LC-CANDIDATE-003", severity: "blocking", message: "Source authority gaps must be resolved before approval; authority is never inferred." });
  if (decision.scope === "author_review" && candidate.groundingGaps.some((gap) => !acknowledged.has(gap.id))) issues.push({ code: "LC-CANDIDATE-003", severity: "blocking", message: "Every remaining grounding gap must be acknowledged for author-review approval." });
  if (issues.length) return { approved: false, courseSpec: null, issues };
  const rejectedCandidateIds = new Set(candidate.conflicts.flatMap((conflict) => conflict.candidateIds.filter((id) => id !== resolutionByConflict.get(conflict.id))));
  const courseSpec: CourseSpec = structuredClone(candidate.draft);
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

export const renderCourseReviewPackage = (candidate: CourseSpecCandidate): string => {
  const evidenceLocation = (ref: EvidenceRef): string => `${ref.materialId} / ${ref.unitId} / ${ref.blockId}${ref.bbox ? ` / bbox ${ref.bbox.x},${ref.bbox.y},${ref.bbox.width},${ref.bbox.height}` : ""}${ref.anchor ? ` / ${ref.anchor}` : ""}`;
  const slides = candidate.draft.slides.map((slide, index) => {
    const evidence = candidate.slideEvidence.find((entry) => entry.slideId === slide.id);
    const knowledge = slide.knowledge.items.map((item) => `  - ${item.text}`).join("\n");
    const refs = [...(evidence?.evidenceRefs ?? [])].map((ref) => `  - ${evidenceLocation(ref)}`).join("\n") || "  - No evidence";
    const conflicts = candidate.conflicts.filter((conflict) => conflict.candidateIds.some((id) => evidence?.knowledgeCandidateIds.includes(id))).map((conflict) => `  - ${conflict.comparableFactKey}: ${conflict.recommendedAction}`).join("\n") || "  - None";
    const gaps = candidate.groundingGaps.filter((gap) => evidence?.knowledgeCandidateIds.includes(gap.candidateId)).map((gap) => `  - ${gap.explanation}\n${gap.resolutionActions.map((action) => `    [ ] ${action.label}`).join("\n")}`).join("\n") || "  - Satisfied";
    return `## ${index + 1}. ${slide.presentation.title}\n\nProposed knowledge:\n${knowledge}\n\nSource locations:\n${refs}\n\nConflicts:\n${conflicts}\n\nGrounding:\n${gaps}`;
  }).join("\n\n");
  const processing = candidate.processing.map((entry) => `- ${entry.materialId}: provider ${entry.provider}; mode ${entry.processingMode}; endpoint ${entry.endpointClassification}`).join("\n");
  const objectives = candidate.draft.slides.map((slide) => `- Review and confirm: ${slide.knowledge.summary}`).join("\n");
  return `# Course Review Package\n\nCourse title: ${candidate.draft.course.title}\n\nAudience: ${candidate.draft.course.audience}\n\nLearning purpose: ${candidate.draft.course.purpose}\n\nLearning objectives:\n${objectives}\n\nReview status: Human approval required\n\nEvidence coverage: ${(candidate.metrics.evidenceCoverage * 100).toFixed(0)}%\n\n## Source processing and privacy\n\n${processing}\n\n${slides}\n\n# Unresolved questions\n\n${candidate.unresolvedQuestions.map((question) => `- ${question}`).join("\n") || "- None"}\n`;
};
