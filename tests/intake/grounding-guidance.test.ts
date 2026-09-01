import { describe, expect, it } from "vitest";
import { normalizeMaterialIR, type DocumentInput } from "@livingcourse/intake";
import { detectKnowledgeConflicts, extractKnowledgeCandidates, resolveGrounding } from "@livingcourse/generation";

const material = (input: { id: string; sourceClass: DocumentInput["authority"]["sourceClass"]; authority: string | null; content: string; mediaType?: string }) => normalizeMaterialIR({
  document: {
    materialId: input.id,
    path: `${input.id}.txt`,
    originalName: `${input.id}.txt`,
    mediaType: input.mediaType ?? "text/plain",
    sha256: `${input.id}-sha`,
    sizeBytes: input.content.length,
    authority: { sourceClass: input.sourceClass, authority: input.authority, version: "1", effectiveDate: "2026-09-01" }
  },
  units: [{ kind: input.mediaType?.startsWith("image/") ? "image" : "section", index: 0, blocks: [{ type: "paragraph", content: input.content }] }],
  provenance: { provider: "fake", providerVersion: "1", parseProfile: "balanced", processingMode: "local", endpointClassification: "local", parsedAt: "2026-09-01T00:00:00Z", rawArtifactRefs: [] }
});

describe("guided grounding", () => {
  it("recommends the controlled source for a conflict but keeps human approval and device grounding explicit", () => {
    const materials = [
      material({ id: "old-deck", sourceClass: "reference", authority: "Training archive", content: "Synthetic training pressure setting = A" }),
      material({ id: "current-sop", sourceClass: "controlled_internal", authority: "Safety owner", content: "Synthetic training pressure setting = B", mediaType: "application/pdf" })
    ];
    const conflictAnalysis = detectKnowledgeConflicts(extractKnowledgeCandidates(materials), materials);
    const grounding = resolveGrounding(conflictAnalysis.candidates, materials);

    expect(conflictAnalysis.conflicts).toHaveLength(1);
    expect(conflictAnalysis.conflicts[0]).toMatchObject({ authorityStatus: "clear_hierarchy" });
    expect(conflictAnalysis.conflicts[0]?.recommendedCandidateId).toBeTruthy();
    expect(conflictAnalysis.conflicts[0]?.recommendedAction).toContain("human factual approval");
    expect(grounding.gaps.length).toBeGreaterThan(0);
    expect(grounding.gaps[0]?.explanation).toContain("production remains blocked");
    expect(grounding.gaps[0]?.resolutionActions.map((action) => action.acceptedEvidence)).toEqual(expect.arrayContaining(["site_equipment_photo", "confirmed_operation_region"]));
  });
});
