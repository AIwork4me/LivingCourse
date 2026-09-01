import { sha256 } from "@livingcourse/core";
import type { MaterialIR } from "@livingcourse/intake";
import type { AuthorityGap, KnowledgeCandidate, KnowledgeConflict } from "./capabilities.js";
import { deterministicKnowledgeDrafts, resolveKnowledgeDrafts } from "./semantic.js";

/** Backward-compatible literal fallback. The create workflow now invokes the capability explicitly. */
export const extractKnowledgeCandidates = (materials: readonly MaterialIR[]): KnowledgeCandidate[] =>
  resolveKnowledgeDrafts(deterministicKnowledgeDrafts(materials), materials);

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
    if (!candidate.comparableFact || candidate.status === "unsupported_candidate" || candidate.status === "stale_evidence") continue;
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
