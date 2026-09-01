import { normalizeMaterialIR, type DocumentInput, type IntakeDiagnostic, type MaterialBlockInput, type MaterialBlockType, type MaterialIR, type MaterialUnitInput, type ParseProfile } from "@livingcourse/intake";

type UnknownRecord = Record<string, unknown>;

export interface MineruNormalizationContext {
  document: DocumentInput;
  providerVersion: string;
  parseProfile: ParseProfile;
  providerBackend: string;
  processingMode: "local" | "remote";
  endpointClassification: "local" | "private_remote" | "public_remote";
  parsedAt: string;
  rawArtifactRefs: string[];
}

export interface MineruNormalizedOutput {
  materialIr: MaterialIR;
  diagnostics: IntakeDiagnostic[];
  parserOutputVersion: string;
  normalizationMethod: "preferred-v2" | "legacy-fallback";
}

const isRecord = (value: unknown): value is UnknownRecord => value !== null && typeof value === "object" && !Array.isArray(value);

const stringsBelow = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsBelow);
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .filter(([key]) => !["type", "url", "image_path", "img_path"].includes(key))
    .flatMap(([, nested]) => stringsBelow(nested));
};

const contentOf = (value: unknown): string => stringsBelow(value).join(" ").trim();

const blockType = (providerType: string, record: UnknownRecord): MaterialBlockType => {
  if (providerType === "text") return typeof record.text_level === "number" && record.text_level > 0 ? "title" : "paragraph";
  const mapping: Record<string, MaterialBlockType> = {
    title: "title",
    paragraph: "paragraph",
    list: "list",
    index: "list",
    table: "table",
    image: "image",
    chart: "chart",
    equation: "equation",
    equation_interline: "equation",
    code: record.sub_type === "algorithm" ? "algorithm" : "code",
    algorithm: "algorithm",
    header: "header",
    page_header: "header",
    footer: "footer",
    page_footer: "footer",
    footnote: "footnote",
    page_footnote: "footnote",
    page_number: "page_number",
    aside_text: "other",
    page_aside_text: "other"
  };
  return mapping[providerType] ?? "other";
};

const normalizedBbox = (value: unknown): MaterialBlockInput["bbox"] => {
  if (!Array.isArray(value) || value.length !== 4 || !value.every((part) => typeof part === "number" && Number.isFinite(part))) return undefined;
  const [x0, y0, x1, y1] = value as [number, number, number, number];
  const scale = Math.max(x0, y0, x1, y1) > 1 ? 1000 : 1;
  const bbox = { x: x0 / scale, y: y0 / scale, width: (x1 - x0) / scale, height: (y1 - y0) / scale };
  return bbox.width > 0 && bbox.height > 0 && bbox.x >= 0 && bbox.y >= 0 && bbox.x + bbox.width <= 1 && bbox.y + bbox.height <= 1 ? bbox : undefined;
};

const assetRefs = (value: unknown): string[] => {
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .filter(([key, nested]) => ["image_path", "img_path"].includes(key) && typeof nested === "string")
    .map(([, nested]) => nested as string)
    .sort();
};

const unitKind = (mediaType: string): MaterialUnitInput["kind"] => {
  if (mediaType.includes("presentation")) return "slide";
  if (mediaType.startsWith("image/")) return "image";
  if (mediaType.includes("wordprocessing")) return "section";
  if (mediaType.includes("spreadsheet")) return "sheet";
  return "page";
};

const blockFromV2 = (value: unknown): MaterialBlockInput | null => {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  const providerContent = value.content;
  const bbox = normalizedBbox(value.bbox);
  return {
    type: blockType(value.type, value),
    content: contentOf(providerContent),
    ...(bbox === undefined ? {} : { bbox }),
    ...(typeof value.anchor === "string" ? { anchor: value.anchor } : {}),
    assetRefs: assetRefs(providerContent)
  };
};

const material = (
  context: MineruNormalizationContext,
  units: MaterialUnitInput[],
  diagnostics: IntakeDiagnostic[]
): MaterialIR => normalizeMaterialIR({
  document: context.document,
  units,
  diagnostics,
  provenance: {
    provider: "mineru",
    providerVersion: context.providerVersion,
    parseProfile: context.parseProfile,
    providerBackend: context.providerBackend,
    processingMode: context.processingMode,
    endpointClassification: context.endpointClassification,
    parsedAt: context.parsedAt,
    rawArtifactRefs: [...context.rawArtifactRefs].sort()
  }
});

export const normalizeMineruV2 = (payload: unknown, context: MineruNormalizationContext): MineruNormalizedOutput => {
  if (!Array.isArray(payload) || !payload.every(Array.isArray)) throw new Error("LC-MINERU-ADAPTER-001: invalid preferred structured output.");
  const diagnostics: IntakeDiagnostic[] = [{ code: "LC-INTAKE-MINERU-V2", severity: "info", message: "Preferred structured parser output normalized through the isolated MinerU adapter." }];
  const kind = unitKind(context.document.mediaType);
  const units = payload.map((page, index) => ({
    kind,
    index,
    blocks: page.map(blockFromV2).filter((block): block is MaterialBlockInput => block !== null)
  }));
  return { materialIr: material(context, units, diagnostics), diagnostics, parserOutputVersion: "structured-v2-development", normalizationMethod: "preferred-v2" };
};

const legacyContent = (record: UnknownRecord): string => {
  for (const key of ["text", "table_body", "code_body", "image_caption", "table_caption", "code_caption"]) {
    if (record[key] !== undefined) {
      const content = contentOf(record[key]);
      if (content) return content;
    }
  }
  return "";
};

export const normalizeMineruLegacy = (payload: unknown, context: MineruNormalizationContext): MineruNormalizedOutput => {
  if (!Array.isArray(payload) || !payload.every(isRecord)) throw new Error("LC-MINERU-ADAPTER-002: invalid legacy structured output.");
  const diagnostics: IntakeDiagnostic[] = [{
    code: "LC-INTAKE-MINERU-LEGACY",
    severity: "warning",
    message: "Legacy parser output was used because preferred structured output was unavailable.",
    suggestedRetryProfile: "high_fidelity"
  }];
  const grouped = new Map<number, MaterialBlockInput[]>();
  for (const record of payload) {
    const index = typeof record.page_idx === "number" ? record.page_idx : 0;
    const providerType = typeof record.type === "string" ? record.type : "other";
    const blocks = grouped.get(index) ?? [];
    const bbox = normalizedBbox(record.bbox);
    blocks.push({
      type: blockType(providerType, record),
      content: legacyContent(record),
      ...(bbox === undefined ? {} : { bbox }),
      assetRefs: assetRefs(record)
    });
    grouped.set(index, blocks);
  }
  const kind = unitKind(context.document.mediaType);
  const units = [...grouped.entries()].sort(([left], [right]) => left - right).map(([index, blocks]) => ({ kind, index, blocks }));
  return { materialIr: material(context, units, diagnostics), diagnostics, parserOutputVersion: "structured-legacy", normalizationMethod: "legacy-fallback" };
};
