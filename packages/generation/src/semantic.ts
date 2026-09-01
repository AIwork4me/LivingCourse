import { sha256 } from "@livingcourse/core";
import { evidenceRefForBlock, validateEvidenceRefs, type EvidenceRef, type MaterialBlock, type MaterialIR, type MaterialUnit } from "@livingcourse/intake";
import type {
  KnowledgeCandidate,
  KnowledgeCandidateDraft,
  KnowledgeCategory,
  KnowledgeFidelityIssue,
  KnowledgeSourceHint,
  KnowledgeUnderstandingCapability
} from "./capabilities.js";

interface BlockRecord {
  material: MaterialIR;
  unit: MaterialUnit;
  block: MaterialBlock;
}

interface ResolvedHint {
  ref: EvidenceRef;
  method: KnowledgeCandidate["evidenceResolution"];
}

const clampConfidence = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export const normalizeEvidenceText = (value: string): string => value
  .normalize("NFKC")
  .toLocaleLowerCase()
  .replace(/\s+/gu, " ")
  .trim();

const categoryRank: Record<KnowledgeCategory, number> = {
  general: 0,
  policy: 1,
  quality: 2,
  process: 3,
  safety: 4,
  device_operation: 5
};

export const categoryForClaim = (claim: string): KnowledgeCategory => {
  if (/\b(machine|equipment|pressure|torque|voltage|current|operation|parameter)\b|设备|机器|压力|扭矩|电压|电流|参数|操作/iu.test(claim)) return "device_operation";
  if (/\b(safety|ppe|hazard|emergency|prohibited|must not|do not)\b|安全|防护|异常|停机|禁止|不得|严禁|不要/iu.test(claim)) return "safety";
  if (/\b(quality|inspection|defect|tolerance|acceptance)\b|质量|检验|缺陷|公差|验收/iu.test(claim)) return "quality";
  if (/\b(step|sequence|process|before|after|record)\b|步骤|流程|顺序|记录/iu.test(claim)) return "process";
  if (/\b(policy|rule|responsible|approval|report)\b|政策|规定|负责|批准|报告/iu.test(claim)) return "policy";
  return "general";
};

export const comparableFactForClaim = (claim: string): KnowledgeCandidate["comparableFact"] => {
  const match = claim.match(/(synthetic training (?:pressure setting|parameter)|training pressure setting|模拟训练(?:压力设定|参数)|某参数)\s*(?:=|:|is)\s*([A-Z0-9._-]+(?:\s*(?:MPa|kPa|bar))?)/iu);
  if (!match?.[1] || !match[2]) return null;
  return { key: normalizeEvidenceText(match[1]), value: match[2].trim().toLocaleUpperCase() };
};

const numberTokens = (value: string): string[] => {
  const matches = value.normalize("NFKC").match(/[-+]?\d+(?:[.,]\d+)?\s*(?:%|°\s*[CF]|MPa|kPa|bar|mm|cm|m|ms|s|min|h|V|A|Hz|N\s*[·.]\s*m)?/giu) ?? [];
  return matches.map((match) => match
    .toLocaleLowerCase()
    .replace(/,/gu, ".")
    .replace(/\s+/gu, "")
    .replace(/n\.m/gu, "n·m"));
};

const negativePolarity = (value: string): boolean => /禁止|不得|严禁|不要|\bmust\s+not\b|\b(?:do|does|did)\s+not\b|\bcannot\b|\bnever\b|\bprohibited\b/iu.test(value);

const evidenceScopeForClaim = (claim: string, evidenceText: readonly string[]): string[] => {
  const fragments = evidenceText.flatMap((value) => value
    .split(/\n+|(?<=[。！？!?])\s*|(?<=[A-Za-z])\.\s+(?=[A-Z])/gu)
    .map((part) => part.trim())
    .filter(Boolean));
  if (fragments.length === 0) return [...evidenceText];
  const normalizedClaim = normalizeEvidenceText(claim).replace(/[.!。！？?]+$/gu, "");
  const direct = fragments.filter((fragment) => {
    const normalized = normalizeEvidenceText(fragment).replace(/[.!。！？?]+$/gu, "");
    return normalized === normalizedClaim || normalized.includes(normalizedClaim) || normalizedClaim.includes(normalized);
  });
  if (direct.length) return direct;
  const ranked = fragments.map((fragment) => ({ fragment, score: diceSimilarity(claim, fragment) })).sort((left, right) => right.score - left.score);
  return (ranked[0]?.score ?? 0) >= 0.55 && ranked[0] ? [ranked[0].fragment] : [...evidenceText];
};

export const numericEvidenceFidelity = (claim: string, evidenceText: readonly string[]): KnowledgeFidelityIssue[] => {
  const evidenceNumbers = new Set(evidenceScopeForClaim(claim, evidenceText).flatMap(numberTokens));
  return [...new Set(numberTokens(claim))]
    .filter((value) => !evidenceNumbers.has(value))
    .map((value) => ({ kind: "numeric" as const, value, message: `Claim numeric value '${value}' is not present in its resolved evidence.` }));
};

export const negationEvidenceFidelity = (claim: string, evidenceText: readonly string[]): KnowledgeFidelityIssue[] => {
  if (evidenceText.length === 0) return [];
  const claimNegative = negativePolarity(claim);
  const evidenceNegative = evidenceScopeForClaim(claim, evidenceText).some(negativePolarity);
  if (claimNegative === evidenceNegative) return [];
  return [{
    kind: "negation",
    value: claimNegative ? "claim-prohibition-without-evidence" : "evidence-prohibition-lost",
    message: claimNegative
      ? "Claim introduces a prohibition that is absent from its resolved evidence."
      : "Claim loses a prohibition or negation present in its resolved evidence."
  }];
};

const blocksBelow = (materials: readonly MaterialIR[]): BlockRecord[] => materials.flatMap((material) =>
  material.units.flatMap((unit) => unit.blocks.map((block) => ({ material, unit, block }))));

const ngrams = (value: string): Set<string> => {
  const normalized = normalizeEvidenceText(value).replace(/[^\p{L}\p{N}]+/gu, "");
  if (normalized.length < 2) return new Set(normalized ? [normalized] : []);
  return new Set([...normalized.slice(0, -1)].map((_, index) => normalized.slice(index, index + 2)));
};

const diceSimilarity = (left: string, right: string): number => {
  const leftSet = ngrams(left);
  const rightSet = ngrams(right);
  if (leftSet.size === 0 || rightSet.size === 0) return 0;
  const overlap = [...leftSet].filter((value) => rightSet.has(value)).length;
  return (2 * overlap) / (leftSet.size + rightSet.size);
};

const resolveHint = (hint: KnowledgeSourceHint, records: readonly BlockRecord[]): ResolvedHint | null => {
  const scoped = records.filter((record) => record.material.material.id === hint.materialId
    && (hint.unitId === undefined || record.unit.id === hint.unitId));
  if (hint.blockId) {
    const exact = scoped.find((record) => record.block.id === hint.blockId);
    if (exact) return { ref: evidenceRefForBlock(exact.material, exact.block), method: "exact_block" };
  }
  if (!hint.quoteOrText?.trim()) return null;
  const quote = normalizeEvidenceText(hint.quoteOrText);
  const normalized = scoped.filter((record) => {
    const content = normalizeEvidenceText(record.block.content);
    return content === quote || content.includes(quote) || quote.includes(content);
  });
  if (normalized.length === 1 && normalized[0]) return { ref: evidenceRefForBlock(normalized[0].material, normalized[0].block), method: "normalized_text" };
  const fuzzy = scoped
    .map((record) => ({ record, score: diceSimilarity(quote, record.block.content) }))
    .sort((left, right) => right.score - left.score || left.record.block.id.localeCompare(right.record.block.id));
  if ((fuzzy[0]?.score ?? 0) < 0.82 || (fuzzy[1]?.score ?? 0) === fuzzy[0]?.score) return null;
  const record = fuzzy[0]?.record;
  return record ? { ref: evidenceRefForBlock(record.material, record.block), method: "fuzzy_text" } : null;
};

export const mergeKnowledgeDrafts = (drafts: readonly KnowledgeCandidateDraft[]): KnowledgeCandidateDraft[] => {
  const groups = new Map<string, KnowledgeCandidateDraft[]>();
  for (const draft of drafts) {
    const key = normalizeEvidenceText(draft.claim).replace(/[.!。！？?]+$/gu, "");
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(draft);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, group]) => {
    const ordered = [...group].sort((left, right) => categoryRank[right.category] - categoryRank[left.category]);
    const first = ordered[0];
    if (!first) throw new Error("LC-SEMANTIC-001: empty draft merge group.");
    const hints = group.flatMap((draft) => draft.sourceHints);
    const uniqueHints = [...new Map(hints.map((hint) => [JSON.stringify(hint), hint])).values()];
    return {
      ...(first.id === undefined ? {} : { id: first.id }),
      claim: first.claim.trim(),
      category: first.category,
      sourceHints: uniqueHints,
      confidence: Math.max(...group.map((draft) => clampConfidence(draft.confidence))),
      ...(first.rationale === undefined ? {} : { rationale: first.rationale })
    };
  });
};

export const resolveKnowledgeDrafts = (drafts: readonly KnowledgeCandidateDraft[], materials: readonly MaterialIR[]): KnowledgeCandidate[] => {
  const records = blocksBelow(materials);
  const materialById = new Map(materials.map((material) => [material.material.id, material]));
  return mergeKnowledgeDrafts(drafts).map((draft) => {
    const resolved = draft.sourceHints.map((hint) => resolveHint(hint, records)).filter((value): value is ResolvedHint => value !== null);
    const refs = [...new Map(resolved.map((value) => [`${value.ref.materialId}/${value.ref.unitId}/${value.ref.blockId}`, value.ref])).values()];
    const evidenceTexts = refs.map((ref) => records.find((record) => record.material.material.id === ref.materialId && record.block.id === ref.blockId)?.block.content).filter((value): value is string => value !== undefined);
    const fidelityIssues = [...numericEvidenceFidelity(draft.claim, evidenceTexts), ...negationEvidenceFidelity(draft.claim, evidenceTexts)];
    const validation = validateEvidenceRefs(materials, refs);
    const stale = validation.issues.length > 0;
    const method = resolved.some((value) => value.method === "fuzzy_text")
      ? "fuzzy_text" as const
      : resolved.some((value) => value.method === "normalized_text")
        ? "normalized_text" as const
        : refs.length > 0 ? "exact_block" as const : "unresolved" as const;
    const sourceMaterials = refs.map((ref) => materialById.get(ref.materialId)).filter((value): value is MaterialIR => value !== undefined);
    const supported = refs.length > 0 && !stale && fidelityIssues.length === 0;
    const confidence = !supported ? 0 : method === "fuzzy_text" ? Math.min(clampConfidence(draft.confidence), 0.8) : clampConfidence(draft.confidence);
    return {
      id: draft.id ?? `knowledge-${sha256({ claim: normalizeEvidenceText(draft.claim), materialIds: [...new Set(refs.map((ref) => ref.materialId))].sort() }).slice(0, 24)}`,
      claim: draft.claim.trim(),
      category: draft.category,
      evidenceRefs: refs,
      confidence,
      evidenceResolution: method,
      fidelityIssues,
      authorityAssessment: sourceMaterials.length > 0 && sourceMaterials.every((material) => material.material.sourceClass !== "unknown" && Boolean(material.material.authority)) ? "recorded" : "authority_gap",
      conflictStatus: "none",
      groundingStatus: draft.category === "device_operation" ? "blocked" : "satisfied",
      status: stale ? "stale_evidence" : supported ? "supported_candidate" : "unsupported_candidate",
      factual: true,
      comparableFact: comparableFactForClaim(draft.claim)
    };
  });
};

export const auditKnowledgeEvidence = (candidates: readonly KnowledgeCandidate[], materials: readonly MaterialIR[]): KnowledgeCandidate[] => candidates.map((candidate) => {
  const validation = validateEvidenceRefs(materials, candidate.evidenceRefs);
  return validation.issues.length
    ? { ...structuredClone(candidate), status: "stale_evidence", confidence: 0 }
    : structuredClone(candidate);
});

const irrelevantContent = (value: string): boolean => /revision history|copyright|all rights reserved|office lunch policy|document owner|effective date|source class|synthetic public-safe test material|修订历史|版权所有|午餐政策/iu.test(value);

const eligibleBlock = (block: MaterialBlock): boolean =>
  !["title", "header", "footer", "footnote", "page_number"].includes(block.type)
  && block.content.trim().length >= 6
  && !irrelevantContent(block.content);

const claimsFromBlock = (block: MaterialBlock): string[] => block.content
  .split(/\n+|(?<=[。！？!?])\s*|(?<=[A-Za-z])\.\s+(?=[A-Z])/gu)
  .map((part) => part.trim())
  .filter((part) => part.length >= 6 && !irrelevantContent(part));

export const deterministicKnowledgeDrafts = (materials: readonly MaterialIR[]): KnowledgeCandidateDraft[] => [...materials]
  .sort((left, right) => left.material.id.localeCompare(right.material.id))
  .flatMap((material) => material.units.flatMap((unit) => unit.blocks
    .filter(eligibleBlock)
    .flatMap((block) => claimsFromBlock(block).map((claim) => ({
      claim,
      category: categoryForClaim(claim),
      sourceHints: [{ materialId: material.material.id, unitId: unit.id, blockId: block.id, quoteOrText: block.content }],
      confidence: 0.72,
      rationale: "Literal deterministic extraction from an eligible source block."
    })))));

export class DeterministicBlockKnowledgeProvider implements KnowledgeUnderstandingCapability {
  readonly identity = {
    mode: "literal_deterministic" as const,
    provider: "livingcourse",
    model: "deterministic-block-knowledge-v2",
    promptTemplateVersion: "not-applicable",
    promptTemplateHash: sha256("deterministic-block-knowledge-v2"),
    profileVersion: "literal-extraction-v2"
  };

  async understand(materials: readonly MaterialIR[]): Promise<KnowledgeCandidateDraft[]> {
    return deterministicKnowledgeDrafts(materials);
  }
}
