import { describe, expect, it } from "vitest";
import { sha256 } from "@livingcourse/core";
import {
  evidenceRefForBlock,
  normalizeMaterialIR,
  validateEvidenceRefs,
  type DocumentInput
} from "@livingcourse/intake";

const source: DocumentInput = {
  materialId: "material-evidence",
  path: "C:/fixtures/sop.pdf",
  originalName: "sop.pdf",
  mediaType: "application/pdf",
  sha256: sha256("synthetic-sop"),
  sizeBytes: 13,
  authority: { sourceClass: "controlled_internal", authority: "Synthetic EHS", version: "2.0", effectiveDate: "2026-08-15" }
};

const material = normalizeMaterialIR({
  document: source,
  units: [{ kind: "page", index: 0, blocks: [{ type: "paragraph", content: "Use setting B for the synthetic training machine." }] }],
  provenance: {
    provider: "fixture-provider",
    providerVersion: "1.0.0",
    parseProfile: "balanced",
    processingMode: "local",
    endpointClassification: "local",
    parsedAt: "2026-09-01T00:00:00.000Z",
    rawArtifactRefs: []
  }
});

describe("EvidenceRef integrity", () => {
  it("resolves an exact source block and rejects missing or stale evidence", () => {
    const block = material.units[0]?.blocks[0];
    if (!block) throw new Error("Fixture block missing.");
    const valid = evidenceRefForBlock(material, block);
    expect(validateEvidenceRefs([material], [valid])).toEqual({ valid: true, issues: [] });
    expect(validateEvidenceRefs([material], [{ ...valid, blockId: "missing" }]).issues[0]?.code).toBe("LC-EVIDENCE-002");
    expect(validateEvidenceRefs([material], [{ ...valid, contentHash: sha256("changed") }]).issues[0]?.code).toBe("LC-EVIDENCE-003");
    expect(validateEvidenceRefs([], [valid]).issues[0]?.code).toBe("LC-EVIDENCE-001");
  });
});
