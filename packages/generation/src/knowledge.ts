import { sha256 } from "@livingcourse/core";
import { evidenceRefForBlock, type MaterialBlock, type MaterialIR } from "@livingcourse/intake";
import type { AuthorityGap, KnowledgeCandidate, KnowledgeConflict } from "./capabilities.js";

const categoryOf = (claim: string): KnowledgeCandidate["category"] => {
  if (/\b(machine|equipment|pressure|operation|parameter)\b|设备|机器|压力|参数|操作/iu.test(claim)) return "device_operation";
  if (/\b(safety|ppe|hazard|emergency)\b|安全|防护|异常|停机/iu.test(claim)) return "safety";
  return "general";
};

const comparableFactOf = (claim: string): KnowledgeCandidate["comparableFact"] => {
  const match = claim.match(/(synthetic training (?:pressure setting|parameter)|training pressure setting|模拟训练(?:压力设定|参数)|某参数)\s*(?:=|:|is)\s*([A-Z0-9._-]+(?:\s*(?:MPa|kPa|bar))?)/iu);
  if (!match?.[1] || !match[2]) return null;
  return { key: match[1].toLocaleLowerCase().replace(/\s+/gu, " "), value: match[2].trim().toLocaleUpperCase() };
};

const eligibleBlock = (block: MaterialBlock): boolean =>
  !["header", "footer", "footnote", "page_number"].includes(block.type) && block.content.trim().length > 0;

export const extractKnowledgeCandidates = (materials: readonly MaterialIR[]): KnowledgeCandidate[] =>
  [...materials]
    .sort((left, right) => left.material.id.localeCompare(right.material.id))
    .flatMap((material) => material.units.flatMap((unit) => unit.blocks
      .filter(eligibleBlock)
      .map((block, blockIndex) => {
        const factual = block.type !== "title";
        const evidenceRefs = [evidenceRefForBlock(material, block)];
        return {
          id: `knowledge-${sha256({ materialId: material.material.id, unit: { kind: unit.kind, index: unit.index, label: unit.label ?? null }, blockIndex, claim: block.content }).slice(0, 24)}`,
          claim: block.content,
          category: categoryOf(block.content),
          evidenceRefs,
          confidence: 1,
          authorityAssessment: material.material.sourceClass === "unknown" || !material.material.authority ? "authority_gap" as const : "recorded" as const,
          conflictStatus: "none" as const,
          groundingStatus: "satisfied" as const,
          status: factual && evidenceRefs.length === 0 ? "unsupported_candidate" as const : "supported_candidate" as const,
          factual,
          comparableFact: comparableFactOf(block.content)
        };
      })));

const sourceRank = (sourceClass: MaterialIR["material"]["sourceClass"]): number => ({
  controlled_internal: 5,
  external_authoritative: 4,
  reference: 3,
  synthetic: 2,
  unknown: 1
})[sourceClass];

export const detectKnowledgeConflicts = (
  candidates: readonly KnowledgeCandidate[],
  materials: readonly MaterialIR[]
): { candidates: KnowledgeCandidate[]; conflicts: KnowledgeConflict[] } => {
  const materialById = new Map(materials.map((material) => [material.material.id, material]));
  const groups = new Map<string, KnowledgeCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate.comparableFact) continue;
    const group = groups.get(candidate.comparableFact.key) ?? [];
    group.push(candidate);
    groups.set(candidate.comparableFact.key, group);
  }
  const conflicts: KnowledgeConflict[] = [];
  const conflictedIds = new Set<string>();
  for (const [key, group] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (new Set(group.map((candidate) => candidate.comparableFact?.value)).size < 2) continue;
    const ranked = group.map((candidate) => ({
      candidate,
      rank: Math.max(...candidate.evidenceRefs.map((ref) => sourceRank(materialById.get(ref.materialId)?.material.sourceClass ?? "unknown")))
    })).sort((left, right) => right.rank - left.rank || left.candidate.id.localeCompare(right.candidate.id));
    const clear = ranked.length > 1 && (ranked[0]?.rank ?? 0) > (ranked[1]?.rank ?? 0);
    const recommended = clear ? ranked[0]?.candidate.id ?? null : null;
    group.forEach((candidate) => conflictedIds.add(candidate.id));
    conflicts.push({
      id: `conflict-${sha256({ key, candidateIds: group.map((candidate) => candidate.id).sort() }).slice(0, 20)}`,
      comparableFactKey: key,
      candidateIds: group.map((candidate) => candidate.id).sort(),
      evidenceRefs: group.flatMap((candidate) => candidate.evidenceRefs),
      authorityStatus: clear ? "clear_hierarchy" : "ambiguous",
      recommendedAction: clear
        ? "Prefer the controlled source as a deterministic recommendation, then obtain human factual approval."
        : "Ask the author to choose the current authoritative source before approval.",
      recommendedCandidateId: recommended
    });
  }
  return {
    candidates: candidates.map((candidate) => conflictedIds.has(candidate.id)
      ? { ...candidate, conflictStatus: "candidate_conflict", status: "conflicted_candidate" }
      : structuredClone(candidate)),
    conflicts
  };
};

export const findAuthorityGaps = (materials: readonly MaterialIR[]): AuthorityGap[] => materials
  .filter((material) => material.material.sourceClass === "unknown" || !material.material.authority)
  .sort((left, right) => left.material.id.localeCompare(right.material.id))
  .map((material) => ({
    id: `authority-gap-${sha256(material.material.id).slice(0, 16)}`,
    materialId: material.material.id,
    message: `${material.material.originalName} has no confirmed source authority.`,
    resolutionAction: "Select the source class and identify the responsible document owner; LivingCourse will not infer authority."
  }));
