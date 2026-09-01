import { describe, expect, it } from "vitest";
import { approveCourseSpecCandidate, buildCourseSpecCandidate, findAuthorityGaps, resolveKnowledgeDrafts } from "@livingcourse/generation";
import { makeMaterial } from "./semantic-test-helpers.js";

describe("structured authority review", () => {
  it("blocks missing authority decisions and applies a human resolution without JSON editing", () => {
    const material = makeMaterial({ id: "unknown-notes", blocks: [{ content: "Report uncertainty to the trainer." }], authority: { sourceClass: "unknown", authority: null, version: null, effectiveDate: null } });
    const block = material.units[0]!.blocks[0]!;
    const [knowledge] = resolveKnowledgeDrafts([{ claim: block.content, category: "policy", sourceHints: [{ materialId: material.material.id, blockId: block.id }], confidence: 0.8 }], [material]);
    const authorityGaps = findAuthorityGaps([material]);
    const candidate = buildCourseSpecCandidate({ title: "Course", audience: "New hires", purpose: "Training", materials: [material], knowledgeCandidates: [knowledge!], conflicts: [], groundingRequirements: [], groundingGaps: [], authorityGaps });
    const baseDecision = { candidateId: candidate.id, reviewer: "Fixture reviewer", reviewedAt: "2026-09-01T00:00:00Z", decision: "approved_for_poc_use" as const, scope: "author_review" as const, comments: "Reviewed", conflictResolutions: [], acknowledgedGroundingGapIds: [], testApproval: true };

    expect(approveCourseSpecCandidate(candidate, [material], baseDecision)).toMatchObject({ approved: false, courseSpec: null });
    const approved = approveCourseSpecCandidate(candidate, [material], {
      ...baseDecision,
      authorityResolutions: [{ authorityGapId: authorityGaps[0]!.id, sourceClass: "reference", authority: "Named training owner" }]
    });
    expect(approved.approved).toBe(true);
    expect(approved.courseSpec?.materials[0]).toMatchObject({ sourceClass: "reference", authority: "Named training owner" });
  });
});
