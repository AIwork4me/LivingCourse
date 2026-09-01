import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverDocumentInputs, validateMaterialIR } from "@livingcourse/intake";
import { MineruHttpProvider } from "@livingcourse/providers";

const endpoint = process.env.MINERU_API_URL;

describe.skipIf(!endpoint)("real MinerU smoke", () => {
  it("checks health, parses the synthetic PDF, and normalizes structured output", async () => {
    const provider = new MineruHttpProvider({ endpoint: endpoint!, requestTimeoutMs: 180_000 });
    const health = await provider.health();
    expect(health.status).toBe("available");
    const documents = await discoverDocumentInputs(path.resolve("tests/fixtures/raw-manufacturing-course"), {
      "sop.pdf": { sourceClass: "controlled_internal", authority: "Fixture Safety Owner", version: "2.0", effectiveDate: "2026-09-01" }
    });
    const input = documents.find((document) => document.originalName === "sop.pdf");
    expect(input).toBeTruthy();
    const result = await provider.parse({ input: input!, profile: "balanced", parsedAt: "2026-09-01T00:00:00Z" });
    expect(validateMaterialIR(result.materialIr).valid).toBe(true);
    expect(["preferred-v2", "legacy-fallback"]).toContain(result.normalizationMethod);
    expect(result.rawArtifacts.length).toBeGreaterThan(0);
  }, 200_000);
});
