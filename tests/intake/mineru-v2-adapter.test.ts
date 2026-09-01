import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sha256 } from "@livingcourse/core";
import { validateMaterialIR, type DocumentInput } from "@livingcourse/intake";
import { normalizeMineruV2 } from "@livingcourse/providers";

const fixture = fileURLToPath(new URL("../fixtures/mineru/content-list-v2.json", import.meta.url));
const document: DocumentInput = {
  materialId: "material-mineru-v2",
  path: "C:/fixture/sop.pdf",
  originalName: "sop.pdf",
  mediaType: "application/pdf",
  sha256: sha256("sop-v2"),
  sizeBytes: 100,
  authority: { sourceClass: "controlled_internal", authority: "Synthetic EHS", version: "2.0", effectiveDate: "2026-08-15" }
};

describe("MinerU preferred structured adapter", () => {
  it("normalizes page grouping, block types, anchors, assets, and 0-1 locations", async () => {
    const output = normalizeMineruV2(JSON.parse(await readFile(fixture, "utf8")) as unknown, {
      document,
      providerVersion: "3.1.0",
      parseProfile: "balanced",
      providerBackend: "hybrid-engine",
      processingMode: "local",
      endpointClassification: "local",
      parsedAt: "2026-09-01T00:00:00.000Z",
      rawArtifactRefs: ["sop_content_list_v2.json"]
    });
    expect(output.normalizationMethod).toBe("preferred-v2");
    expect(output.materialIr.units).toHaveLength(2);
    expect(output.materialIr.units[0]?.blocks[0]).toMatchObject({ type: "title", content: "Synthetic Machine Entry", location: { anchor: "synthetic-machine-entry" } });
    expect(output.materialIr.units[1]?.blocks[0]?.assetRefs).toEqual(["images/synthetic-machine.jpg"]);
    expect(output.materialIr.units[0]?.blocks[0]?.location.bbox).toEqual({ x: 0.08, y: 0.1, width: 0.84, height: 0.06 });
    expect(validateMaterialIR(output.materialIr).valid).toBe(true);
  });
});
