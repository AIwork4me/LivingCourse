import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import type {
  DocumentInput,
  DocumentParseRequest,
  DocumentParseResult,
  DocumentParsingCapabilities,
  DocumentParsingProvider,
  EndpointClassification,
  ProviderHealth
} from "@livingcourse/intake";
import { normalizeMineruLegacy, normalizeMineruV2 } from "./adapter.js";

export interface MineruHttpProviderConfig {
  endpoint?: string;
  requestTimeoutMs?: number;
  providerVersion?: string;
}

const supportedMediaTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png"
].sort();

const endpointClassification = (endpoint: string): EndpointClassification => {
  const host = new URL(endpoint).hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(host)) return "local";
  if (/^10\./u.test(host) || /^192\.168\./u.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./u.test(host)) return "private_remote";
  return "public_remote";
};

export class MineruHttpProvider implements DocumentParsingProvider {
  readonly id = "mineru";
  readonly endpoint: string;
  readonly displayEndpoint: string;
  private readonly requestTimeoutMs: number;
  private readonly configuredProviderVersion: string;

  constructor(config: MineruHttpProviderConfig = {}) {
    this.endpoint = (config.endpoint ?? "http://127.0.0.1:8000").replace(/\/$/u, "");
    const display = new URL(this.endpoint);
    display.username = "";
    display.password = "";
    display.search = "";
    display.hash = "";
    this.displayEndpoint = display.toString().replace(/\/$/u, "");
    this.requestTimeoutMs = config.requestTimeoutMs ?? 120_000;
    this.configuredProviderVersion = config.providerVersion ?? process.env.MINERU_PROVIDER_VERSION ?? "server-unreported-adapter-0.3.0";
  }

  async health(): Promise<ProviderHealth> {
    const classification = endpointClassification(this.endpoint);
    try {
      const response = await fetch(`${this.endpoint}/health`, { signal: AbortSignal.timeout(Math.min(this.requestTimeoutMs, 10_000)) });
      const body = await response.json() as { status?: unknown; version?: unknown; error?: unknown };
      const available = response.ok && body.status === "healthy";
      return {
        providerId: this.id,
        status: available ? "available" : "not_available",
        version: available ? (typeof body.version === "string" ? body.version : this.configuredProviderVersion) : null,
        processingMode: classification === "local" ? "local" : "remote",
        endpointClassification: classification,
        detail: available ? "MinerU FastAPI health check passed." : `MinerU health check failed: ${typeof body.error === "string" ? body.error : `HTTP ${response.status}`}`
      };
    } catch (error) {
      return {
        providerId: this.id,
        status: "not_available",
        version: null,
        processingMode: classification === "local" ? "local" : "remote",
        endpointClassification: classification,
        detail: `MinerU parser is not available: ${(error as Error).message}`
      };
    }
  }

  async capabilities(): Promise<DocumentParsingCapabilities> {
    const providerHealth = await this.health();
    return { providerId: this.id, providerVersion: providerHealth.version, supportedMediaTypes: supportedMediaTypes, parseProfiles: ["balanced", "high_fidelity"] };
  }

  supports(input: DocumentInput): boolean {
    return supportedMediaTypes.includes(input.mediaType);
  }

  async parse(request: DocumentParseRequest): Promise<DocumentParseResult> {
    if (!this.supports(request.input)) throw new Error(`LC-MINERU-HTTP-001: unsupported media type '${request.input.mediaType}'.`);
    const providerHealth = await this.health();
    if (providerHealth.status !== "available" || providerHealth.version === null) throw new Error(`LC-MINERU-HTTP-002: ${providerHealth.detail}`);
    const form = new FormData();
    const bytes = await readFile(request.input.path);
    form.append("files", new Blob([bytes], { type: request.input.mediaType }), request.input.originalName);
    form.append("backend", "hybrid-engine");
    form.append("effort", request.profile === "balanced" ? "medium" : "high");
    form.append("parse_method", "auto");
    form.append("return_md", "true");
    form.append("return_content_list", "true");
    form.append("return_images", "true");
    form.append("response_format_zip", "true");
    const response = await fetch(`${this.endpoint}/file_parse`, { method: "POST", body: form, signal: AbortSignal.timeout(this.requestTimeoutMs) });
    if (!response.ok) throw new Error(`LC-MINERU-HTTP-003: parse failed with HTTP ${response.status}.`);
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const rawArtifacts = await Promise.all(Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => ({ name: entry.name, mediaType: entry.name.endsWith(".json") ? "application/json" : entry.name.endsWith(".md") ? "text/markdown" : "application/octet-stream", bytes: await entry.async("uint8array") })));
    const preferred = rawArtifacts.find((artifact) => artifact.name.endsWith("content_list_v2.json"));
    const legacy = rawArtifacts.find((artifact) => artifact.name.endsWith("content_list.json"));
    if (!preferred && !legacy) throw new Error("LC-MINERU-HTTP-004: response contains no supported structured output.");
    const classification = endpointClassification(this.endpoint);
    const context = {
      document: request.input,
      providerVersion: providerHealth.version,
      parseProfile: request.profile,
      providerBackend: "hybrid-engine",
      processingMode: classification === "local" ? "local" as const : "remote" as const,
      endpointClassification: classification === "not_applicable" ? "public_remote" as const : classification,
      parsedAt: request.parsedAt,
      rawArtifactRefs: rawArtifacts.map((artifact) => artifact.name)
    };
    const decoder = new TextDecoder();
    const normalized = preferred
      ? normalizeMineruV2(JSON.parse(decoder.decode(preferred.bytes)) as unknown, context)
      : normalizeMineruLegacy(JSON.parse(decoder.decode(legacy?.bytes)) as unknown, context);
    const markdown = rawArtifacts.find((artifact) => artifact.name.endsWith(".md"));
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
