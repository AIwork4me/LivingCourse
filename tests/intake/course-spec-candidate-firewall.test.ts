import { describe, expect, it } from "vitest";
import { sha256, validateCourseSpec } from "@livingcourse/core";
import { compileCourse } from "@livingcourse/compiler";
import { normalizeMaterialIR } from "@livingcourse/intake";
import {
  approveCourseSpecCandidate,
  buildCourseSpecCandidate,
  detectKnowledgeConflicts,
  extractKnowledgeCandidates,
  findAuthorityGaps,
  renderCourseReviewPackage,
  resolveGrounding
} from "@livingcourse/generation";

const materials = [normalizeMaterialIR({
  document: { materialId: "notes", path: "notes.md", originalName: "notes.md", mediaType: "text/markdown", sha256: "a".repeat(64), sizeBytes: 42, authority: { sourceClass: "reference", authority: "Synthetic trainer", version: "1", effectiveDate: "2026-09-01" } },
  units: [{ kind: "section", index: 0, blocks: [{ type: "paragraph", content: "Welcome learners to the synthetic course." }] }],
  provenance: { provider: "built-in-text", providerVersion: "1", parseProfile: "balanced", processingMode: "built_in", endpointClassification: "not_applicable", parsedAt: "2026-09-01T00:00:00Z", rawArtifactRefs: [] }
})];

describe("CourseSpecCandidate firewall", () => {
  it("does not yield a CourseSpec without explicit human approval", () => {
    const knowledge = extractKnowledgeCandidates(materials);
    const conflicts = detectKnowledgeConflicts(knowledge, materials);
    const grounding = resolveGrounding(conflicts.candidates, materials);
    const candidate = buildCourseSpecCandidate({ title: "Synthetic induction", audience: "New hires", purpose: "Review safe training knowledge", materials, knowledgeCandidates: grounding.candidates, conflicts: conflicts.conflicts, groundingRequirements: grounding.requirements, groundingGaps: grounding.gaps, authorityGaps: findAuthorityGaps(materials) });

    const blocked = approveCourseSpecCandidate(candidate, materials);
    expect(blocked.approved).toBe(false);
    expect(blocked.courseSpec).toBeNull();
    expect(blocked.issues.some((issue) => issue.code === "LC-CANDIDATE-004")).toBe(true);
    expect(renderCourseReviewPackage(candidate)).toContain("Human approval required");

    const approved = approveCourseSpecCandidate(candidate, materials, { candidateId: candidate.id, reviewer: "Fixture reviewer", reviewedAt: "2026-09-01T00:00:00Z", decision: "approved_for_poc_use", scope: "author_review", comments: "Synthetic test continuation only.", conflictResolutions: [], acknowledgedGroundingGapIds: [], testApproval: true });
    expect(approved.approved).toBe(true);
    expect(validateCourseSpec(approved.courseSpec).valid).toBe(true);
    expect(approved.courseSpec?.governance.reviewDecisions[0]?.reviewer).toContain("test approval");
    const compiled = compileCourse(approved.courseSpec!, {
      assetProbe: { probe: (assetRef) => ({ exists: true, approved: true, sha256: sha256(assetRef) }) },
      timingProbe: { durationMs: () => null },
      reviewDecisionSource: { decisions: () => approved.courseSpec?.governance.reviewDecisions ?? [] }
    });
    expect(compiled.presentationPlan.slides).toHaveLength(1);
    expect(compiled.videoPlan.slides).toHaveLength(1);
  });
});
