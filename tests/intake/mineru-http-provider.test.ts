import path from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverDocumentInputs, validateMaterialIR } from "@livingcourse/intake";
import { MineruHttpProvider } from "@livingcourse/providers";

afterEach(() => vi.unstubAllGlobals());

describe("MinerU HTTP provider health boundary", () => {
  it("uses an adapter-version fallback when health is available without a server version", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "healthy" }), { status: 200, headers: { "content-type": "application/json" } })));
    const provider = new MineruHttpProvider({ endpoint: "http://127.0.0.1:8000", providerVersion: "configured-fixture-version" });
    await expect(provider.health()).resolves.toMatchObject({ status: "available", version: "configured-fixture-version", processingMode: "local" });
  });

  it("redacts endpoint credentials, query strings, and fragments from display", () => {
    const provider = new MineruHttpProvider({ endpoint: "https://user:password@example.test/mineru?token=secret#fragment" });
    expect(provider.displayEndpoint).toBe("https://example.test/mineru");
  });

  it("preserves the self-hosted /health and /file_parse ZIP flow", async () => {
    const zip = new JSZip();
    zip.file("nested/content_list_v2.json", JSON.stringify([[{ type: "paragraph", content: { paragraph_content: [{ type: "text", content: "Self-hosted parser remains compatible." }] } }]]));
    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();
      calls.push(url);
      if (url.endsWith("/health")) return new Response(JSON.stringify({ status: "healthy", version: "self-hosted-fixture" }), { status: 200, headers: { "content-type": "application/json" } });
      if (url.endsWith("/file_parse")) return new Response(Uint8Array.from(zipBytes).buffer, { status: 200 });
      throw new Error("Unexpected request.");
    }));
    const input = (await discoverDocumentInputs(path.resolve("tests/fixtures/raw-manufacturing-course"))).find((candidate) => candidate.originalName === "sop.pdf");
    expect(input).toBeTruthy();
    const provider = new MineruHttpProvider({ endpoint: "http://127.0.0.1:8000" });
    const result = await provider.parse({ input: input!, profile: "balanced", parsedAt: "2026-09-01T00:00:00Z" });
    expect(validateMaterialIR(result.materialIr).valid).toBe(true);
    expect(result.materialIr.provenance.provider).toBe("mineru");
    expect(calls.some((url) => url.endsWith("/health"))).toBe(true);
    expect(calls.some((url) => url.endsWith("/file_parse"))).toBe(true);
  });
});
