import { afterEach, describe, expect, it, vi } from "vitest";
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
});
