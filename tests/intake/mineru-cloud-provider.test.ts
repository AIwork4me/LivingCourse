import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverDocumentInputs, validateMaterialIR } from "@livingcourse/intake";
import { MineruCloudProvider, MINERU_CLOUD_PROVIDER_VERSION } from "@livingcourse/providers";
import { executeCreate, executeIntake } from "@livingcourse/workflow";

type FetchCall = { url: string; init: RequestInit };

const temporary: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const fixtureInput = async () => {
  const inputs = await discoverDocumentInputs(path.resolve("tests/fixtures/raw-manufacturing-course"));
  const input = inputs.find((candidate) => candidate.originalName === "sop.pdf");
  if (!input) throw new Error("Synthetic PDF fixture is missing.");
  return input;
};

const resultZip = async (includeStructured = true): Promise<Uint8Array> => {
  const zip = new JSZip();
  zip.file("results/full.md", "# Synthetic Machine Entry\n\nUse training pressure setting B.");
  if (includeStructured) zip.file("results/content_list_v2.json", await readFile(path.resolve("tests/fixtures/mineru/content-list-v2.json"), "utf8"));
  return zip.generateAsync({ type: "uint8array" });
};

const jsonResponse = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json" }
});

const responseBody = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer;

const happyFetch = async (calls: FetchCall[]): Promise<(input: string | URL | Request, init?: RequestInit) => Promise<Response>> => {
  const zip = await resultZip();
  let polls = 0;
  return async (input, init = {}) => {
    const url = input.toString();
    calls.push({ url, init });
    if (url.endsWith("livingcourse-health-probe")) return jsonResponse({ code: -60012, msg: "batch not found", data: null });
    if (url.endsWith("/api/v4/file-urls/batch")) return jsonResponse({ code: 0, data: { batch_id: "batch-fixture", file_urls: ["https://upload.example.test/fixture"] } });
    if (url === "https://upload.example.test/fixture") return new Response(null, { status: 201 });
    if (url.endsWith("/api/v4/extract-results/batch/batch-fixture")) {
      polls += 1;
      return jsonResponse({ code: 0, data: { extract_result: [{ file_name: "sop.pdf", state: polls === 1 ? "running" : "done", full_zip_url: polls === 1 ? undefined : "https://download.example.test/result" }] } });
    }
    if (url === "https://download.example.test/result") return new Response(responseBody(zip), { status: 200 });
    throw new Error("Unexpected mocked request.");
  };
};

const providerFor = (fetchImplementation: (input: string | URL | Request, init?: RequestInit) => Promise<Response>, overrides: Partial<ConstructorParameters<typeof MineruCloudProvider>[0]> = {}): MineruCloudProvider => {
  vi.stubEnv("MINERU_API_TOKEN", ["test", "only", "credential", "fragments"].join("-"));
  return new MineruCloudProvider({
    baseUrl: "https://mineru.example.test",
    fetchImplementation,
    pollIntervalMs: 0,
    sleep: async () => undefined,
    ...overrides
  });
};

describe("MinerU Cloud precise API transport", () => {
  it("requests signed upload, PUTs bytes, polls, downloads ZIP, and reuses the v2 adapter", async () => {
    const calls: FetchCall[] = [];
    const provider = providerFor(await happyFetch(calls));
    const health = await provider.health();
    expect(health).toMatchObject({ status: "available", version: MINERU_CLOUD_PROVIDER_VERSION, processingMode: "remote", endpointClassification: "public_remote" });

    const input = await fixtureInput();
    const result = await provider.parse({ input, profile: "balanced", parsedAt: "2026-09-01T00:00:00Z" });
    expect(validateMaterialIR(result.materialIr)).toEqual({ valid: true, issues: [] });
    expect(result.normalizationMethod).toBe("preferred-v2");
    expect(result.materialIr.provenance).toMatchObject({
      provider: "mineru-cloud",
      providerVersion: MINERU_CLOUD_PROVIDER_VERSION,
      providerBackend: "precise-api-v4/vlm",
      processingMode: "remote",
      endpointClassification: "public_remote"
    });
    expect(result.materialIr.units.flatMap((unit) => unit.blocks).some((block) => block.content.includes("pressure setting B"))).toBe(true);

    const submission = calls.find((call) => call.url.endsWith("/api/v4/file-urls/batch"));
    expect(submission?.init.method).toBe("POST");
    expect(JSON.parse(String(submission?.init.body))).toEqual({ files: [{ name: "sop.pdf", data_id: input.materialId }], model_version: "vlm" });
    const upload = calls.find((call) => call.url.startsWith("https://upload.example.test"));
    expect(upload?.init.method).toBe("PUT");
    expect(new Headers(upload?.init.headers).has("content-type")).toBe(false);
    expect(new Headers(upload?.init.headers).has("authorization")).toBe(false);
    expect(new Headers(submission?.init.headers).get("authorization")).toMatch(/^Bearer /u);
    const download = calls.find((call) => call.url.startsWith("https://download.example.test"));
    expect(new Headers(download?.init.headers).has("authorization")).toBe(false);
    expect(calls.filter((call) => call.url.includes("/extract-results/batch/batch-fixture"))).toHaveLength(2);
  });

  it.each([401, 403, 429])("fails closed on upload URL request HTTP %i", async (status) => {
    const provider = providerFor(async () => jsonResponse({ code: status }, status));
    await expect(provider.parse({ input: await fixtureInput(), profile: "balanced", parsedAt: "2026-09-01T00:00:00Z" }))
      .rejects.toThrow(`upload URL request failed with HTTP ${status}`);
  });

  it("fails on a cloud failed state", async () => {
    const provider = providerFor(async (input, init) => {
      const url = input.toString();
      if (init?.method === "POST") return jsonResponse({ code: 0, data: { batch_id: "batch", file_urls: ["https://upload.example.test/file"] } });
      if (init?.method === "PUT") return new Response(null, { status: 200 });
      if (url.includes("extract-results")) return jsonResponse({ code: 0, data: { extract_result: [{ state: "failed", file_name: "sop.pdf" }] } });
      throw new Error("Unexpected request.");
    });
    await expect(provider.parse({ input: await fixtureInput(), profile: "balanced", parsedAt: "2026-09-01T00:00:00Z" })).rejects.toThrow("reported a failed parse");
  });

  it("times out after finite polling attempts", async () => {
    const provider = providerFor(async (_input, init) => {
      if (init?.method === "POST") return jsonResponse({ code: 0, data: { batch_id: "batch", file_urls: ["https://upload.example.test/file"] } });
      if (init?.method === "PUT") return new Response(null, { status: 200 });
      return jsonResponse({ code: 0, data: { extract_result: [{ state: "pending", file_name: "sop.pdf" }] } });
    }, { maxPollAttempts: 2, pollTimeoutMs: 1_000, now: () => 0 });
    await expect(provider.parse({ input: await fixtureInput(), profile: "balanced", parsedAt: "2026-09-01T00:00:00Z" })).rejects.toThrow("polling timed out");
  });

  it("rejects malformed upload responses and missing signed URLs", async () => {
    const malformed = providerFor(async () => new Response("not-json", { status: 200 }));
    await expect(malformed.parse({ input: await fixtureInput(), profile: "balanced", parsedAt: "2026-09-01T00:00:00Z" })).rejects.toThrow("malformed JSON");
    const missingUrl = providerFor(async () => jsonResponse({ code: 0, data: { batch_id: "batch", file_urls: [] } }));
    await expect(missingUrl.parse({ input: await fixtureInput(), profile: "balanced", parsedAt: "2026-09-01T00:00:00Z" })).rejects.toThrow("did not include the requested file URL");
  });

  it("rejects done results without full_zip_url", async () => {
    const provider = providerFor(async (input, init) => {
      if (init?.method === "POST") return jsonResponse({ code: 0, data: { batch_id: "batch", file_urls: ["https://upload.example.test/file"] } });
      if (init?.method === "PUT") return new Response(null, { status: 200 });
      if (input.toString().includes("extract-results")) return jsonResponse({ code: 0, data: { extract_result: [{ state: "done", file_name: "sop.pdf" }] } });
      throw new Error("Unexpected request.");
    });
    await expect(provider.parse({ input: await fixtureInput(), profile: "balanced", parsedAt: "2026-09-01T00:00:00Z" })).rejects.toThrow("omitted full_zip_url");
  });

  it("fails loudly when the ZIP has no structured JSON", async () => {
    const zip = await resultZip(false);
    const provider = providerFor(async (input, init) => {
      if (init?.method === "POST") return jsonResponse({ code: 0, data: { batch_id: "batch", file_urls: ["https://upload.example.test/file"] } });
      if (init?.method === "PUT") return new Response(null, { status: 200 });
      if (input.toString().includes("extract-results")) return jsonResponse({ code: 0, data: { extract_result: [{ state: "done", file_name: "sop.pdf", full_zip_url: "https://download.example.test/result" }] } });
      return new Response(responseBody(zip), { status: 200 });
    });
    await expect(provider.parse({ input: await fixtureInput(), profile: "balanced", parsedAt: "2026-09-01T00:00:00Z" })).rejects.toThrow("no supported structured JSON");
  });

  it("does not claim availability merely because a token string exists", async () => {
    const provider = providerFor(async () => jsonResponse({}, 503));
    await expect(provider.health()).resolves.toMatchObject({ status: "not_available", version: null });
    vi.stubEnv("MINERU_API_TOKEN", "");
    const absent = new MineruCloudProvider({ baseUrl: "https://mineru.example.test", fetchImplementation: vi.fn() });
    await expect(absent.health()).resolves.toMatchObject({ status: "not_available", detail: expect.stringContaining("MINERU_API_TOKEN") });
  });

  it.each(["A0202", "A0211"])("maps HTTP 200 credential error %s to not_available", async (code) => {
    const provider = providerFor(async () => jsonResponse({ code, msg: "rejected" }));
    await expect(provider.health()).resolves.toMatchObject({ status: "not_available", version: null });
  });
});

describe("MinerU Cloud cache and security boundaries", () => {
  it("makes zero cloud calls and zero regenerations on the identical second run", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "livingcourse-cloud-cache-"));
    temporary.push(root);
    const source = path.join(root, "materials");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(source));
    await writeFile(path.join(source, "synthetic.pdf"), "synthetic public-safe PDF bytes", "utf8");
    const calls: FetchCall[] = [];
    const provider = providerFor(await happyFetch(calls));
    const options = { workspaceRoot: root, cacheRoot: path.join(root, "cache"), providers: [provider], parsedAt: "2026-09-01T00:00:00Z" } as const;
    const first = await executeIntake(source, options);
    expect(first.parserCalls).toBe(1);
    const callsAfterFirst = calls.length;
    const second = await executeIntake(source, options);
    expect(second.parserCalls).toBe(0);
    expect(second.materialRegenerations).toBe(0);
    expect(calls).toHaveLength(callsAfterFirst);
    expect(second.materialIrHashes).toEqual(first.materialIrHashes);
    const created = await executeCreate(source, { ...options, outputRoot: path.join(root, "review") });
    expect(calls).toHaveLength(callsAfterFirst);
    const review = await readFile(created.reviewPackagePath, "utf8");
    expect(review).toContain("Document parser: MinerU Cloud");
    expect(review).toContain("Processing: Remote");
  });

  it("never persists or logs credentials and temporary URLs", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "livingcourse-cloud-security-"));
    temporary.push(root);
    const source = path.join(root, "materials");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(source));
    await writeFile(path.join(source, "synthetic.pdf"), "synthetic public-safe PDF bytes", "utf8");
    const credential = ["private", "runtime", "value", "segments"].join("-");
    const uploadUrl = ["https://upload.example.test/file?", "Signature=", "abcdef", "1234567890abcdef"].join("");
    const downloadUrl = ["https://download.example.test/result?", "sig=", "0123456789", "abcdef"].join("");
    const zip = await resultZip();
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("MINERU_API_TOKEN", credential);
    const provider = new MineruCloudProvider({
      baseUrl: "https://mineru.example.test",
      pollIntervalMs: 0,
      sleep: async () => undefined,
      fetchImplementation: async (input, init) => {
        if (input.toString().endsWith("livingcourse-health-probe")) return jsonResponse({ code: -60012 });
        if (init?.method === "POST") return jsonResponse({ code: 0, data: { batch_id: "batch", file_urls: [uploadUrl] } });
        if (init?.method === "PUT") return new Response(null, { status: 200 });
        if (input.toString().includes("extract-results")) return jsonResponse({ code: 0, data: { extract_result: [{ state: "done", file_name: "synthetic.pdf", full_zip_url: downloadUrl }] } });
        return new Response(responseBody(zip), { status: 200 });
      }
    });
    const result = await executeIntake(source, { workspaceRoot: root, cacheRoot: path.join(root, "cache"), providers: [provider], parsedAt: "2026-09-01T00:00:00Z" });
    const created = await executeCreate(source, { workspaceRoot: root, cacheRoot: path.join(root, "cache"), outputRoot: path.join(root, "review"), providers: [provider], parsedAt: "2026-09-01T00:00:00Z" });
    const cacheMetadata = await readFile(path.join(root, "cache", "index.json"), "utf8");
    const material = JSON.stringify(result.materials);
    const review = await readFile(created.reviewPackagePath, "utf8");
    const logs = JSON.stringify([...consoleLog.mock.calls, ...consoleError.mock.calls]);
    for (const prohibited of [credential, uploadUrl, downloadUrl, "Authorization", "Bearer "]) {
      expect(cacheMetadata).not.toContain(prohibited);
      expect(material).not.toContain(prohibited);
      expect(review).not.toContain(prohibited);
      expect(logs).not.toContain(prohibited);
    }
    expect(cacheMetadata).toContain(MINERU_CLOUD_PROVIDER_VERSION);
  });

  it("redacts transport URLs and credentials from network failures", async () => {
    const credential = ["runtime", "private", "parts", "only"].join("-");
    const uploadUrl = ["https://upload.example.test/file?", "Signature=", "fedcba", "0987654321fedcba"].join("");
    vi.stubEnv("MINERU_API_TOKEN", credential);
    const provider = new MineruCloudProvider({
      baseUrl: "https://mineru.example.test",
      fetchImplementation: async (_input, init) => {
        if (init?.method === "POST") return jsonResponse({ code: 0, data: { batch_id: "batch", file_urls: [uploadUrl] } });
        throw new Error([credential, uploadUrl].join(" at "));
      }
    });
    let message = "";
    try {
      await provider.parse({ input: await fixtureInput(), profile: "balanced", parsedAt: "2026-09-01T00:00:00Z" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("signed upload request failed");
    expect(message).not.toContain(credential);
    expect(message).not.toContain(uploadUrl);
  });
});
