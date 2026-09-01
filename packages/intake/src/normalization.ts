import { sha256 } from "@livingcourse/core";
import {
  MATERIAL_IR_NORMALIZER_VERSION,
  MATERIAL_IR_VERSION,
  type MaterialBlock,
  type MaterialIR,
  type MaterialIrValidationIssue,
  type MaterialNormalizationInput,
  type MaterialUnit
} from "./types.js";

export const normalizeMaterialContent = (content: string): string =>
  content.replace(/\r\n?/gu, "\n").replace(/[ \t]+/gu, " ").replace(/\n{3,}/gu, "\n\n").trim();

const unitId = (materialSha: string, kind: string, index: number, label: string | undefined): string =>
  `unit-${sha256({ materialSha, kind, index, label: label ?? null }).slice(0, 20)}`;

export const normalizeMaterialIR = (input: MaterialNormalizationInput): MaterialIR => {
  const units: MaterialUnit[] = [...input.units]
    .sort((left, right) => left.index - right.index || left.kind.localeCompare(right.kind))
    .map((sourceUnit) => {
      const id = unitId(input.document.sha256, sourceUnit.kind, sourceUnit.index, sourceUnit.label);
      const blocks: MaterialBlock[] = sourceUnit.blocks.map((sourceBlock, blockIndex) => {
        const content = normalizeMaterialContent(sourceBlock.content);
        return {
          id: `block-${sha256({
            materialSha: input.document.sha256,
            unit: { kind: sourceUnit.kind, index: sourceUnit.index, label: sourceUnit.label ?? null },
            blockIndex,
            content
          }).slice(0, 24)}`,
          type: sourceBlock.type,
          content,
          location: {
            unitId: id,
            unitIndex: sourceUnit.index,
            ...(sourceBlock.bbox === undefined ? {} : { bbox: structuredClone(sourceBlock.bbox) }),
            ...(sourceBlock.anchor === undefined ? {} : { anchor: sourceBlock.anchor })
          },
          contentHash: sha256(content),
          assetRefs: [...(sourceBlock.assetRefs ?? [])].sort()
        };
      });
      return {
        id,
        kind: sourceUnit.kind,
        index: sourceUnit.index,
        ...(sourceUnit.label === undefined ? {} : { label: sourceUnit.label }),
        blocks
      };
    });
  const assets = [...(input.assets ?? [])]
    .sort((left, right) => left.originalRef.localeCompare(right.originalRef))
    .map((asset) => ({
      id: `asset-${sha256({ materialSha: input.document.sha256, originalRef: asset.originalRef, contentHash: asset.contentHash }).slice(0, 24)}`,
      mediaType: asset.mediaType,
      contentHash: asset.contentHash,
      originalRef: asset.originalRef,
      rawArtifactRef: asset.rawArtifactRef ?? null
    }));
  return {
    materialIrVersion: MATERIAL_IR_VERSION,
    material: {
      id: input.document.materialId,
      originalName: input.document.originalName,
      mediaType: input.document.mediaType,
      sha256: input.document.sha256,
      sourceClass: input.document.authority.sourceClass,
      authority: input.document.authority.authority,
      version: input.document.authority.version,
      effectiveDate: input.document.authority.effectiveDate
    },
    units,
    assets,
    diagnostics: [...(input.diagnostics ?? [])],
    provenance: { ...structuredClone(input.provenance), normalizerVersion: MATERIAL_IR_NORMALIZER_VERSION }
  };
};

const validBbox = (bbox: { x: number; y: number; width: number; height: number }): boolean =>
  [bbox.x, bbox.y, bbox.width, bbox.height].every(Number.isFinite)
  && bbox.x >= 0 && bbox.y >= 0 && bbox.width > 0 && bbox.height > 0
  && bbox.x + bbox.width <= 1 && bbox.y + bbox.height <= 1;

export const validateMaterialIR = (material: MaterialIR): { valid: boolean; issues: MaterialIrValidationIssue[] } => {
  const issues: MaterialIrValidationIssue[] = [];
  const ids = new Set<string>();
  for (const [unitIndex, unit] of material.units.entries()) {
    if (ids.has(unit.id)) issues.push({ code: "LC-MATERIAL-IR-001", path: `/units/${unitIndex}/id`, message: `Duplicate unit id '${unit.id}'.` });
    ids.add(unit.id);
    for (const [blockIndex, block] of unit.blocks.entries()) {
      if (ids.has(block.id)) issues.push({ code: "LC-MATERIAL-IR-001", path: `/units/${unitIndex}/blocks/${blockIndex}/id`, message: `Duplicate block id '${block.id}'.` });
      ids.add(block.id);
      if (block.location.unitId !== unit.id || block.location.unitIndex !== unit.index) {
        issues.push({ code: "LC-MATERIAL-IR-002", path: `/units/${unitIndex}/blocks/${blockIndex}/location`, message: "Block location does not identify its containing unit." });
      }
      if (block.location.bbox && !validBbox(block.location.bbox)) {
        issues.push({ code: "LC-MATERIAL-IR-003", path: `/units/${unitIndex}/blocks/${blockIndex}/location/bbox`, message: "Bounding box must use normalized 0-1 coordinates." });
      }
    }
  }
  return { valid: issues.length === 0, issues };
};

export const materialIrContentHash = (material: MaterialIR): string => sha256({
  materialIrVersion: material.materialIrVersion,
  material: material.material,
  units: material.units,
  assets: material.assets,
  diagnostics: material.diagnostics,
  provenance: { ...material.provenance, parsedAt: null }
});

export const parsingFingerprint = (input: {
  sourceSha256: string;
  providerId: string;
  providerVersion: string;
  parseProfile: string;
  normalizerVersion?: string;
}): string => sha256({ ...input, normalizerVersion: input.normalizerVersion ?? MATERIAL_IR_NORMALIZER_VERSION });
