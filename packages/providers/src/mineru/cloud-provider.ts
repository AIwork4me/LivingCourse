import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import type {
  DocumentInput,
  DocumentParseRequest,
  DocumentParseResult,
  DocumentParsingCapabilities,
  DocumentParsingProvider,
  ProviderHealth,
  RawParserArtifact
} from "@livingcourse/intake";
import { normalizeMineruLegacy, normalizeMineruV2 } from "./adapter.js";

export const MINERU_CLOUD_TRANSPORT_VERSION = "precise-api-v4" as const;
export const MINERU_CLOUD_MODEL_VERSION = "vlm" as const;
export const MINERU_CLOUD_PROVIDER_VERSION = `${MINERU_CLOUD_TRANSPORT_VERSION}+${MINERU_CLOUD_MODEL_VERSION}+transport-0.3.2`;

type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface MineruCloudProviderConfig {
  baseUrl?: string;
  fetchImplementation?: FetchImplementation;
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  maxPollAttempts?: number;
  maxTransientRetries?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

interface ApiEnvelope {
  code?: unknown;
  msg?: unknown;
  data?: unknown;
}

interface CloudCacheIdentity {
  providerVersion: string;
  processingMode: "remote";
  endpointClassification: "public_remote";
  parseProfiles: readonly ["balanced"];
}

const supportedMediaTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png"
].sort();

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

const mediaTypeForArtifact = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
};

const safeJson = async (response: Response): Promise<ApiEnvelope | null> => {
  try {
    const value: unknown = await response.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
};

const apiSucceeded = (envelope: ApiEnvelope): boolean => envelope.code === 0 || envelope.code === "0";

const sleepNormally = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
};

const artifactsFromZip = async (bytes: ArrayBuffer): Promise<RawParserArtifact[]> => {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error("LC-MINERU-CLOUD-012: downloaded result is not a valid ZIP archive.");
  }
  return Promise.all(Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(async (entry) => ({ name: entry.name, mediaType: mediaTypeForArtifact(entry.name), bytes: await entry.async("uint8array") })));
};

export class MineruCloudProvider implements DocumentParsingProvider {
  readonly id = "mineru-cloud";
  readonly baseUrl: string;
  readonly displayEndpoint: string;
  readonly cacheIdentity: CloudCacheIdentity = {
    providerVersion: MINERU_CLOUD_PROVIDER_VERSION,
    processingMode: "remote",
    endpointClassification: "public_remote",
    parseProfiles: ["balanced"]
  };
  private readonly fetchImplementation: FetchImplementation;
  private readonly requestTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly maxPollAttempts: number;
  private readonly maxTransientRetries: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => number;

  constructor(config: MineruCloudProviderConfig = {}) {
    this.baseUrl = (config.baseUrl ?? process.env.MINERU_CLOUD_BASE_URL ?? "https://mineru.net").replace(/\/+$/u, "");
    this.displayEndpoint = this.safeDisplayEndpoint();
    this.fetchImplementation = config.fetchImplementation ?? fetch;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 120_000;
    this.pollIntervalMs = config.pollIntervalMs ?? 2_500;
    this.pollTimeoutMs = config.pollTimeoutMs ?? 900_000;
    this.maxPollAttempts = config.maxPollAttempts ?? 360;
    this.maxTransientRetries = config.maxTransientRetries ?? 3;
    this.sleep = config.sleep ?? sleepNormally;
    this.now = config.now ?? Date.now;
  }

  private safeDisplayEndpoint(): string {
    try {
      const display = new URL(this.baseUrl);
      display.username = "";
      display.password = "";
      display.search = "";
      display.hash = "";
      return display.toString().replace(/\/$/u, "");
    } catch {
      return "invalid MinerU Cloud base URL";
    }
  }

  private validBaseUrl(): boolean {
    try {
      const url = new URL(this.baseUrl);
      return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
    } catch {
      return false;
    }
  }

  private token(): string | null {
    const value = process.env.MINERU_API_TOKEN?.trim();
    return value ? value : null;
  }

  private apiHeaders(token: string, json = false): HeadersInit {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {})
    };
  }

  private async request(stage: string, input: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImplementation(input, { ...init, signal: init.signal ?? AbortSignal.timeout(this.requestTimeoutMs) });
    } catch {
      throw new Error(`LC-MINERU-CLOUD-NETWORK: ${stage} request failed.`);
    }
  }

  async health(): Promise<ProviderHealth> {
    const unavailable = (detail: string): ProviderHealth => ({
      providerId: this.id,
      status: "not_available",
      version: null,
      processingMode: "remote",
      endpointClassification: "public_remote",
      detail
    });
    if (!this.validBaseUrl()) return unavailable("MinerU Cloud requires a valid HTTPS base URL.");
    const token = this.token();
    if (!token) return unavailable("MinerU Cloud credential is absent. Set MINERU_API_TOKEN.");
    let response: Response;
    try {
      response = await this.request(
        "health probe",
        `${this.baseUrl}/api/v4/extract-results/batch/livingcourse-health-probe`,
        { method: "GET", headers: this.apiHeaders(token), signal: AbortSignal.timeout(Math.min(this.requestTimeoutMs, 10_000)) }
      );
    } catch {
      return unavailable("MinerU Cloud reachability probe failed.");
    }
    const envelope = await safeJson(response);
    if (!response.ok || envelope === null || response.status === 401 || response.status === 403 || response.status === 429) {
      return unavailable(`MinerU Cloud reachability probe was not accepted (HTTP ${response.status}).`);
    }
    if (typeof envelope.code !== "string" && typeof envelope.code !== "number") {
      return unavailable("MinerU Cloud reachability probe returned no API status code.");
    }
    if (["A0202", "A0211", "-10001"].includes(String(envelope.code))) {
      return unavailable("MinerU Cloud reachability probe reported an authentication or service error.");
    }
    return {
      providerId: this.id,
      status: "available",
      version: MINERU_CLOUD_PROVIDER_VERSION,
      processingMode: "remote",
      endpointClassification: "public_remote",
      detail: "MinerU Cloud precise API responded to a non-destructive authenticated result probe."
    };
  }

  async capabilities(): Promise<DocumentParsingCapabilities> {
    return { providerId: this.id, providerVersion: MINERU_CLOUD_PROVIDER_VERSION, supportedMediaTypes, parseProfiles: ["balanced"] };
  }

  supports(input: DocumentInput): boolean {
    return supportedMediaTypes.includes(input.mediaType);
  }

  private async apiJson(stage: string, input: string, init: RequestInit, token: string): Promise<ApiEnvelope> {
    const response = await this.request(stage, input, { ...init, headers: this.apiHeaders(token, init.method === "POST") });
    const envelope = await safeJson(response);
    if (!response.ok) throw new Error(`LC-MINERU-CLOUD-HTTP: ${stage} failed with HTTP ${response.status}.`);
    if (envelope === null) throw new Error(`LC-MINERU-CLOUD-MALFORMED: ${stage} returned malformed JSON.`);
    if (!apiSucceeded(envelope)) throw new Error(`LC-MINERU-CLOUD-API: ${stage} was rejected by MinerU Cloud.`);
    return envelope;
  }

  private async poll(batchId: string, input: DocumentInput, token: string): Promise<string> {
    const deadline = this.now() + this.pollTimeoutMs;
    let transientRetries = 0;
    for (let attempt = 0; attempt < this.maxPollAttempts && this.now() <= deadline; attempt += 1) {
      let response: Response;
      try {
        response = await this.request(
          "result polling",
          `${this.baseUrl}/api/v4/extract-results/batch/${encodeURIComponent(batchId)}`,
          { method: "GET", headers: this.apiHeaders(token) }
        );
      } catch {
        transientRetries += 1;
        if (transientRetries > this.maxTransientRetries) throw new Error("LC-MINERU-CLOUD-008: result polling exhausted transient retries.");
        await this.sleep(this.pollIntervalMs);
        continue;
      }
      if (response.status === 429 || response.status >= 500) {
        transientRetries += 1;
        if (transientRetries > this.maxTransientRetries) throw new Error(`LC-MINERU-CLOUD-008: result polling exhausted transient retries after HTTP ${response.status}.`);
        await this.sleep(this.pollIntervalMs);
        continue;
      }
      if (!response.ok) throw new Error(`LC-MINERU-CLOUD-008: result polling failed with HTTP ${response.status}.`);
      const envelope = await safeJson(response);
      if (envelope === null || !apiSucceeded(envelope) || !isRecord(envelope.data)) throw new Error("LC-MINERU-CLOUD-008: result polling returned a malformed response.");
      const results = envelope.data.extract_result;
      if (!Array.isArray(results)) throw new Error("LC-MINERU-CLOUD-008: result polling omitted extract_result.");
      const records = results.filter(isRecord);
      const result = records.find((record) => record.data_id === input.materialId)
        ?? records.find((record) => record.file_name === input.originalName)
        ?? (records.length === 1 ? records[0] : undefined);
      if (!result || typeof result.state !== "string") throw new Error("LC-MINERU-CLOUD-008: result polling could not identify the requested file state.");
      if (["waiting-file", "pending", "running", "converting"].includes(result.state)) {
        await this.sleep(this.pollIntervalMs);
        continue;
      }
      if (result.state === "failed") throw new Error("LC-MINERU-CLOUD-009: MinerU Cloud reported a failed parse.");
      if (result.state !== "done") throw new Error(`LC-MINERU-CLOUD-008: MinerU Cloud returned unsupported state '${result.state}'.`);
      if (typeof result.full_zip_url !== "string" || !result.full_zip_url) throw new Error("LC-MINERU-CLOUD-011: completed parse omitted full_zip_url.");
      return result.full_zip_url;
    }
    throw new Error("LC-MINERU-CLOUD-010: result polling timed out before completion.");
  }

  async parse(request: DocumentParseRequest): Promise<DocumentParseResult> {
    if (!this.supports(request.input)) throw new Error(`LC-MINERU-CLOUD-001: unsupported media type '${request.input.mediaType}'.`);
    if (request.profile !== "balanced") throw new Error("LC-MINERU-CLOUD-015: high_fidelity is not supported by the MinerU Cloud v0.3.2 transport.");
    if (!this.validBaseUrl()) throw new Error("LC-MINERU-CLOUD-003: MinerU Cloud requires a valid HTTPS base URL.");
    const token = this.token();
    if (!token) throw new Error("LC-MINERU-CLOUD-002: MINERU_API_TOKEN is required.");
    const submission = await this.apiJson(
      "upload URL request",
      `${this.baseUrl}/api/v4/file-urls/batch`,
      {
        method: "POST",
        body: JSON.stringify({ files: [{ name: request.input.originalName, data_id: request.input.materialId }], model_version: MINERU_CLOUD_MODEL_VERSION })
      },
      token
    );
    if (!isRecord(submission.data) || typeof submission.data.batch_id !== "string" || !Array.isArray(submission.data.file_urls)) {
      throw new Error("LC-MINERU-CLOUD-006: upload URL response omitted batch_id or file_urls.");
    }
    const uploadUrl = submission.data.file_urls[0];
    if (typeof uploadUrl !== "string" || !uploadUrl) throw new Error("LC-MINERU-CLOUD-006: upload URL response did not include the requested file URL.");
    const sourceBytes = await readFile(request.input.path);
    const upload = await this.request("signed upload", uploadUrl, { method: "PUT", body: sourceBytes });
    if (upload.status !== 200 && upload.status !== 201) throw new Error(`LC-MINERU-CLOUD-007: signed upload failed with HTTP ${upload.status}.`);
    const resultUrl = await this.poll(submission.data.batch_id, request.input, token);
    const download = await this.request("ZIP download", resultUrl, { method: "GET" });
    if (!download.ok) throw new Error(`LC-MINERU-CLOUD-012: ZIP download failed with HTTP ${download.status}.`);
    const rawArtifacts = await artifactsFromZip(await download.arrayBuffer());
    const preferred = rawArtifacts.find((artifact) => artifact.name.toLowerCase().endsWith("content_list_v2.json"));
    const legacy = rawArtifacts.find((artifact) => artifact.name.toLowerCase().endsWith("content_list.json"));
    if (!preferred && !legacy) throw new Error("LC-MINERU-CLOUD-013: result ZIP contains no supported structured JSON.");
    const context = {
      document: request.input,
      providerId: this.id,
      providerVersion: MINERU_CLOUD_PROVIDER_VERSION,
      parseProfile: request.profile,
      providerBackend: `${MINERU_CLOUD_TRANSPORT_VERSION}/${MINERU_CLOUD_MODEL_VERSION}`,
      processingMode: "remote" as const,
      endpointClassification: "public_remote" as const,
      parsedAt: request.parsedAt,
      rawArtifactRefs: rawArtifacts.map((artifact) => artifact.name)
    };
    const decoder = new TextDecoder();
    let normalized;
    try {
      normalized = preferred
        ? normalizeMineruV2(JSON.parse(decoder.decode(preferred.bytes)) as unknown, context)
        : normalizeMineruLegacy(JSON.parse(decoder.decode(legacy?.bytes)) as unknown, context);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("LC-MINERU-CLOUD-014: structured JSON artifact is malformed.");
      throw error;
    }
    const markdown = rawArtifacts.find((artifact) => artifact.name.toLowerCase().endsWith("full.md"))
      ?? rawArtifacts.find((artifact) => artifact.name.toLowerCase().endsWith(".md"));
    return {
      materialIr: normalized.materialIr,
      diagnostics: normalized.diagnostics,
      rawArtifacts,
      markdownPreview: markdown ? decoder.decode(markdown.bytes) : null,
      parserOutputVersion: normalized.parserOutputVersion,
      normalizationMethod: normalized.normalizationMethod
    };
  }
}
