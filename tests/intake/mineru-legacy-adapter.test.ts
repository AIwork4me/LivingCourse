import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sha256 } from "@livingcourse/core";
import { validateMaterialIR, type DocumentInput } from "@livingcourse/intake";
import { normalizeMineruLegacy } from "@livingcourse/providers";

const fixture = fileURLToPath(new URL("../fixtures/mineru/content-list-legacy.json", import.meta.url));
const document: DocumentInput = {
  materialId: "material-mineru-legacy",
  path: "C:/fixture/old-training.pptx",
  originalName: "old-training.pptx",
  mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  sha256: sha256("ppt-legacy"),
  sizeBytes: 100,
  authority: { sourceClass: "reference", authority: "Synthetic Training", version: "1.0", effectiveDate: "2025-01-01" }
};

describe("MinerU legacy structured adapter", () => {
  it("normalizes legacy output with an explicit fallback diagnostic", async () => {
    const output = normalizeMineruLegacy(JSON.parse(await readFile(fixture, "utf8")) as unknown, {
      document,
      providerVersion: "3.1.0",
      parseProfile: "balanced",
      providerBackend: "hybrid-engine",
      processingMode: "remote",
      endpointClassification: "private_remote",
      parsedAt: "2026-09-01T00:00:00.000Z",
      rawArtifactRefs: ["old-training_content_list.json"]
    });
    expect(output.normalizationMethod).toBe("legacy-fallback");
    expect(output.diagnostics).toContainEqual(expect.objectContaining({ code: "LC-INTAKE-MINERU-LEGACY", suggestedRetryProfile: "high_fidelity" }));
    expect(output.materialIr.units.map((unit) => unit.kind)).toEqual(["slide", "slide"]);
    expect(output.materialIr.units[0]?.blocks.map((block) => block.type)).toEqual(["title", "paragraph"]);
    expect(validateMaterialIR(output.materialIr).valid).toBe(true);
  });
});
