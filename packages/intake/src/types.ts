import type { NormalizedRegion, SourceClass } from "@livingcourse/core";

export const MATERIAL_IR_VERSION = "0.1.0" as const;
export const MATERIAL_IR_NORMALIZER_VERSION = "0.1.1" as const;

export type ParseProfile = "balanced" | "high_fidelity";
export type ProcessingMode = "local" | "remote" | "built_in";
export type EndpointClassification = "not_applicable" | "local" | "private_remote" | "public_remote";

export interface IntakeDiagnostic {
  code: string;
  severity: "info" | "warning" | "error" | "blocking";
  message: string;
  path?: string;
  suggestedRetryProfile?: ParseProfile;
}

export interface MaterialAuthority {
  sourceClass: SourceClass;
  authority: string | null;
  version: string | null;
  effectiveDate: string | null;
}

export interface DocumentInput {
  materialId: string;
  path: string;
  originalName: string;
  mediaType: string;
  sha256: string;
  sizeBytes: number;
  authority: MaterialAuthority;
}

export interface ProviderHealth {
  providerId: string;
  status: "available" | "not_available";
  version: string | null;
  processingMode: ProcessingMode;
  endpointClassification: EndpointClassification;
  detail: string;
}

export interface DocumentParsingCapabilities {
  providerId: string;
  providerVersion: string | null;
  supportedMediaTypes: string[];
  parseProfiles: ParseProfile[];
}

export interface DocumentParseRequest {
  input: DocumentInput;
  profile: ParseProfile;
  parsedAt: string;
}

export interface RawParserArtifact {
  name: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface DocumentParseResult {
  materialIr: MaterialIR;
  diagnostics: IntakeDiagnostic[];
  rawArtifacts: RawParserArtifact[];
  markdownPreview: string | null;
  parserOutputVersion: string;
  normalizationMethod: string;
}

export interface DocumentParsingProvider {
  readonly id: string;
  health(): Promise<ProviderHealth>;
  capabilities(): Promise<DocumentParsingCapabilities>;
  supports(input: DocumentInput): boolean;
  parse(request: DocumentParseRequest): Promise<DocumentParseResult>;
}

export type MaterialUnitKind = "page" | "slide" | "sheet" | "section" | "image" | "web_section";
export type MaterialBlockType =
  | "title"
  | "paragraph"
  | "list"
  | "table"
  | "image"
  | "chart"
  | "equation"
  | "code"
  | "algorithm"
  | "header"
  | "footer"
  | "footnote"
  | "page_number"
  | "other";

export interface MaterialLocation {
  unitId: string;
  unitIndex: number;
  bbox?: NormalizedRegion;
  anchor?: string;
}

export interface MaterialBlock {
  id: string;
  type: MaterialBlockType;
  content: string;
  location: MaterialLocation;
  contentHash: string;
  assetRefs: string[];
}

export interface MaterialUnit {
  id: string;
  kind: MaterialUnitKind;
  index: number;
  label?: string;
  blocks: MaterialBlock[];
}

export interface MaterialAsset {
  id: string;
  mediaType: string;
  contentHash: string;
  originalRef: string;
  rawArtifactRef: string | null;
}

export interface ParseProvenance {
  provider: string;
  providerVersion: string;
  parseProfile: ParseProfile;
  providerBackend?: string;
  processingMode: ProcessingMode;
  endpointClassification: EndpointClassification;
  parsedAt: string;
  rawArtifactRefs: string[];
  normalizerVersion: string;
}

export interface MaterialIR {
  materialIrVersion: typeof MATERIAL_IR_VERSION;
  material: {
    id: string;
    originalName: string;
    mediaType: string;
    sha256: string;
    sourceClass: SourceClass;
    authority: string | null;
    version: string | null;
    effectiveDate: string | null;
  };
  units: MaterialUnit[];
  assets: MaterialAsset[];
  diagnostics: IntakeDiagnostic[];
  provenance: ParseProvenance;
}

export interface MaterialBlockInput {
  type: MaterialBlockType;
  content: string;
  bbox?: NormalizedRegion;
  anchor?: string;
  assetRefs?: string[];
}

export interface MaterialUnitInput {
  kind: MaterialUnitKind;
  index: number;
  label?: string;
  blocks: MaterialBlockInput[];
}

export interface MaterialAssetInput {
  mediaType: string;
  contentHash: string;
  originalRef: string;
  rawArtifactRef?: string;
}

export interface MaterialNormalizationInput {
  document: DocumentInput;
  units: MaterialUnitInput[];
  assets?: MaterialAssetInput[];
  diagnostics?: IntakeDiagnostic[];
  provenance: Omit<ParseProvenance, "normalizerVersion">;
}

export interface MaterialIrValidationIssue {
  code: "LC-MATERIAL-IR-001" | "LC-MATERIAL-IR-002" | "LC-MATERIAL-IR-003";
  path: string;
  message: string;
}

export interface EvidenceRef {
  materialId: string;
  unitId: string;
  blockId: string;
  contentHash: string;
  bbox?: NormalizedRegion;
  anchor?: string;
}

export interface EvidenceValidationIssue {
  code: "LC-EVIDENCE-001" | "LC-EVIDENCE-002" | "LC-EVIDENCE-003";
  evidenceRef: EvidenceRef;
  message: string;
}
