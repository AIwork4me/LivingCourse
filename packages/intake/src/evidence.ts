import type { EvidenceRef, EvidenceValidationIssue, MaterialIR, MaterialBlock } from "./types.js";

export const evidenceRefForBlock = (material: MaterialIR, block: MaterialBlock): EvidenceRef => ({
  materialId: material.material.id,
  unitId: block.location.unitId,
  blockId: block.id,
  contentHash: block.contentHash,
  ...(block.location.bbox === undefined ? {} : { bbox: structuredClone(block.location.bbox) }),
  ...(block.location.anchor === undefined ? {} : { anchor: block.location.anchor })
});

export const validateEvidenceRefs = (
  materials: readonly MaterialIR[],
  refs: readonly EvidenceRef[]
): { valid: boolean; issues: EvidenceValidationIssue[] } => {
  const issues: EvidenceValidationIssue[] = [];
  for (const ref of refs) {
    const material = materials.find((candidate) => candidate.material.id === ref.materialId);
    if (!material) {
      issues.push({ code: "LC-EVIDENCE-001", evidenceRef: ref, message: `Material '${ref.materialId}' does not exist.` });
      continue;
    }
    const unit = material.units.find((candidate) => candidate.id === ref.unitId);
    if (!unit) {
      issues.push({ code: "LC-EVIDENCE-002", evidenceRef: ref, message: `Unit '${ref.unitId}' does not exist in material '${ref.materialId}'.` });
      continue;
    }
    const block = unit.blocks.find((candidate) => candidate.id === ref.blockId);
    if (!block) {
      issues.push({ code: "LC-EVIDENCE-002", evidenceRef: ref, message: `Block '${ref.blockId}' does not exist in unit '${ref.unitId}'.` });
      continue;
    }
    if (block.contentHash !== ref.contentHash) {
      issues.push({ code: "LC-EVIDENCE-003", evidenceRef: ref, message: `Evidence '${ref.blockId}' is stale: content hash does not match.` });
    }
  }
  return { valid: issues.length === 0, issues };
};
