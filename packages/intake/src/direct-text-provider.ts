import { readFile } from "node:fs/promises";
import { normalizeMaterialIR } from "./normalization.js";
import type {
  DocumentInput,
  DocumentParseRequest,
  DocumentParseResult,
  DocumentParsingCapabilities,
  DocumentParsingProvider,
  MaterialBlockInput,
  MaterialUnitInput,
  ProviderHealth
} from "./types.js";

const supported = new Set(["text/markdown", "text/plain"]);

const blocksForLines = (lines: readonly string[]): MaterialBlockInput[] => {
  const blocks: MaterialBlockInput[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = (): void => {
    if (paragraph.length) blocks.push({ type: "paragraph", content: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = (): void => {
    if (list.length) blocks.push({ type: "list", content: list.join("\n") });
    list = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
    } else if (/^(?:[-*+] |\d+[.)] )/u.test(line)) {
      flushParagraph();
      list.push(line.replace(/^(?:[-*+] |\d+[.)] )/u, ""));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
};

const markdownUnits = (content: string): MaterialUnitInput[] => {
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  const units: MaterialUnitInput[] = [];
  let label: string | undefined;
  let body: string[] = [];
  const flush = (): void => {
    if (!label && body.every((line) => line.trim().length === 0)) return;
    units.push({
      kind: "section",
      index: units.length,
      ...(label === undefined ? {} : { label }),
      blocks: [
        ...(label === undefined ? [] : [{ type: "title" as const, content: label, anchor: `section-${units.length + 1}` }]),
        ...blocksForLines(body)
      ]
    });
    body = [];
  };
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+)$/u);
    if (heading?.[1]) {
      flush();
      label = heading[1].trim();
    } else body.push(line);
  }
  flush();
  return units.length ? units : [{ kind: "section", index: 0, blocks: [] }];
};

export class DirectTextProvider implements DocumentParsingProvider {
  readonly id = "built-in-text";

  async health(): Promise<ProviderHealth> {
    return {
      providerId: this.id,
      status: "available",
      version: "0.1.0",
      processingMode: "built_in",
      endpointClassification: "not_applicable",
      detail: "Deterministic Markdown/TXT parser is available in-process."
    };
  }

  async capabilities(): Promise<DocumentParsingCapabilities> {
    return { providerId: this.id, providerVersion: "0.1.0", supportedMediaTypes: [...supported].sort(), parseProfiles: ["balanced", "high_fidelity"] };
  }

  supports(input: DocumentInput): boolean {
    return supported.has(input.mediaType);
  }

  async parse(request: DocumentParseRequest): Promise<DocumentParseResult> {
    if (!this.supports(request.input)) throw new Error(`LC-DIRECT-TEXT-001: unsupported media type '${request.input.mediaType}'.`);
    const content = await readFile(request.input.path, "utf8");
    const materialIr = normalizeMaterialIR({
      document: request.input,
      units: markdownUnits(content),
      provenance: {
        provider: this.id,
        providerVersion: "0.1.0",
        parseProfile: request.profile,
        processingMode: "built_in",
        endpointClassification: "not_applicable",
        parsedAt: request.parsedAt,
        rawArtifactRefs: []
      }
    });
    return {
      materialIr,
      diagnostics: [],
      rawArtifacts: [],
      markdownPreview: content,
      parserOutputVersion: "direct-text-v1",
      normalizationMethod: "deterministic-direct-text"
    };
  }
}
