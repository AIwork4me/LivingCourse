import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "@livingcourse/core";
import {
  materialIrContentHash,
  normalizeMaterialIR,
  validateMaterialIR,
  type DocumentInput,
  type MaterialNormalizationInput
} from "@livingcourse/intake";

const document: DocumentInput = {
  materialId: "material-determinism",
  path: "C:/fixtures/trainer-notes.md",
  originalName: "trainer-notes.md",
  mediaType: "text/markdown",
  sha256: sha256("# Entry safety\nWear approved PPE."),
  sizeBytes: 33,
  authority: {
    sourceClass: "reference",
    authority: "Synthetic Training Team",
    version: "1.0",
    effectiveDate: "2026-08-01"
  }
};

const normalizationInput = (): MaterialNormalizationInput => ({
  document,
  units: [{
    kind: "section",
    index: 0,
    label: "Entry safety",
    blocks: [
      { type: "title", content: "  Entry   safety  ", anchor: "entry-safety" },
      { type: "paragraph", content: "Wear approved PPE.", bbox: { x: 0.1, y: 0.2, width: 0.7, height: 0.1 } }
    ]
  }],
  provenance: {
    provider: "fixture-provider",
    providerVersion: "1.0.0",
    parseProfile: "balanced",
    processingMode: "built_in",
    endpointClassification: "not_applicable",
    parsedAt: "2026-09-01T00:00:00.000Z",
    rawArtifactRefs: []
  }
});

describe("MaterialIR determinism", () => {
  it("produces identical canonical content, block IDs, locations, and hashes", () => {
    const first = normalizeMaterialIR(normalizationInput());
    const second = normalizeMaterialIR(normalizationInput());
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(materialIrContentHash(first)).toBe(materialIrContentHash(second));
    expect(first.units[0]?.blocks.map((block) => block.id)).toEqual(second.units[0]?.blocks.map((block) => block.id));
    expect(first.units[0]?.blocks.map((block) => block.location)).toEqual(second.units[0]?.blocks.map((block) => block.location));
    expect(first.units[0]?.blocks[0]?.content).toBe("Entry safety");
    expect(validateMaterialIR(first)).toEqual({ valid: true, issues: [] });
  });
});
