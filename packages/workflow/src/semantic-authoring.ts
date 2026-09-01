import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "@livingcourse/core";
import { materialIrContentHash, type MaterialIR } from "@livingcourse/intake";
import {
  resolveKnowledgeDrafts,
  validateCoursePlanDraft,
  type CourseDesignCapability,
  type CoursePlanDraft,
  type KnowledgeCandidate,
  type KnowledgeCandidateDraft,
  type KnowledgeUnderstandingCapability,
  type SemanticCapabilityIdentity
} from "@livingcourse/generation";
import type { IntakePlanResult } from "./intake.js";

interface KnowledgeCacheEntry {
  sourceName: string;
  sourceSha256: string;
  parseFingerprint: string;
  materialIrHash: string;
  capabilityFingerprint: string;
  fingerprint: string;
  drafts: KnowledgeCandidateDraft[];
}

interface CourseDesignCacheEntry {
  fingerprint: string;
  planningFingerprint: string;
  candidateSetHash: string;
  capabilityFingerprint: string;
  plan: CoursePlanDraft;
}

interface SemanticCacheIndex {
  version: "0.1.0";
  knowledge: KnowledgeCacheEntry[];
  courseDesign: CourseDesignCacheEntry[];
}

export interface SemanticCallCounts {
  knowledgeUnderstanding: number;
  courseDesign: number;
  total: number;
}

export interface SemanticPlan {
  understandingMode: SemanticCapabilityIdentity["mode"];
  changedMaterials: string[];
  reusedMaterials: string[];
  knowledgeUnderstandingCalls: number;
  courseDesignCalls: number;
  totalAiCalls: number;
}

export interface SemanticExecution {
  candidates: KnowledgeCandidate[];
  coursePlan: CoursePlanDraft;
  calls: SemanticCallCounts;
  changedMaterials: string[];
  reusedMaterials: string[];
  candidateSetHash: string;
}

export interface SemanticAuthoringOptions {
  cacheRoot: string;
  title: string;
  audience: string;
  purpose: string;
  locale: string;
  maxSlides: number;
  knowledge: KnowledgeUnderstandingCapability;
  courseDesign: CourseDesignCapability;
}

const emptyCache = (): SemanticCacheIndex => ({ version: "0.1.0", knowledge: [], courseDesign: [] });

const readCache = async (cacheRoot: string): Promise<SemanticCacheIndex> => {
  try {
    const value = JSON.parse(await readFile(path.join(cacheRoot, "index.json"), "utf8")) as SemanticCacheIndex;
    return value.version === "0.1.0" && Array.isArray(value.knowledge) && Array.isArray(value.courseDesign) ? value : emptyCache();
  } catch {
    return emptyCache();
  }
};

const writeCache = async (cacheRoot: string, value: SemanticCacheIndex): Promise<void> => {
  await mkdir(cacheRoot, { recursive: true });
  const target = path.join(cacheRoot, "index.json");
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, target);
};

export const semanticCapabilityFingerprint = (identity: SemanticCapabilityIdentity): string => sha256({
  mode: identity.mode,
  provider: identity.provider,
  model: identity.model,
  promptTemplateVersion: identity.promptTemplateVersion,
  promptTemplateHash: identity.promptTemplateHash,
  profileVersion: identity.profileVersion
});

const planningContext = (options: SemanticAuthoringOptions): Record<string, unknown> => ({
  title: options.title,
  audience: options.audience,
  purpose: options.purpose,
  locale: options.locale,
  maxSlides: options.maxSlides,
  resolverVersion: "evidence-resolver-v1"
});

const planningFingerprint = (knowledgeFingerprints: readonly string[], options: SemanticAuthoringOptions): string => sha256({
  knowledgeFingerprints: [...knowledgeFingerprints].sort(),
  courseDesignCapability: semanticCapabilityFingerprint(options.courseDesign.identity),
  context: planningContext(options)
});

export const planSemanticAuthoring = async (intake: IntakePlanResult, options: SemanticAuthoringOptions): Promise<SemanticPlan> => {
  const cache = await readCache(options.cacheRoot);
  const capabilityFingerprint = semanticCapabilityFingerprint(options.knowledge.identity);
  const matchedEntries = intake.files.map((item) => cache.knowledge.find((entry) => entry.parseFingerprint === item.cacheFingerprint && entry.capabilityFingerprint === capabilityFingerprint));
  const changedMaterials = intake.files.filter((_, index) => !matchedEntries[index]).map((item) => item.input.originalName);
  const reusedMaterials = intake.files.filter((_, index) => Boolean(matchedEntries[index])).map((item) => item.input.originalName);
  const knownFingerprints = matchedEntries.filter((entry): entry is KnowledgeCacheEntry => entry !== undefined).map((entry) => entry.fingerprint);
  const canReuseCourseDesign = changedMaterials.length === 0 && cache.courseDesign.some((entry) => entry.planningFingerprint === planningFingerprint(knownFingerprints, options));
  const knowledgeUnderstandingCalls = options.knowledge.identity.mode === "semantic_ai" ? changedMaterials.length : 0;
  const courseDesignCalls = options.courseDesign.identity.mode === "semantic_ai" && !canReuseCourseDesign ? 1 : 0;
  return {
    understandingMode: options.knowledge.identity.mode,
    changedMaterials,
    reusedMaterials,
    knowledgeUnderstandingCalls,
    courseDesignCalls,
    totalAiCalls: knowledgeUnderstandingCalls + courseDesignCalls
  };
};

export const executeSemanticAuthoring = async (
  materials: readonly MaterialIR[],
  parseFingerprints: Readonly<Record<string, string>>,
  options: SemanticAuthoringOptions,
  prepareCandidatesForDesign: (candidates: readonly KnowledgeCandidate[]) => KnowledgeCandidate[] = (candidates) => candidates.map((candidate) => structuredClone(candidate))
): Promise<SemanticExecution> => {
  const cache = await readCache(options.cacheRoot);
  const knowledgeCapabilityFingerprint = semanticCapabilityFingerprint(options.knowledge.identity);
  const drafts: KnowledgeCandidateDraft[] = [];
  const knowledgeFingerprints: string[] = [];
  const changedMaterials: string[] = [];
  const reusedMaterials: string[] = [];
  let knowledgeCalls = 0;
  for (const material of [...materials].sort((left, right) => left.material.originalName.localeCompare(right.material.originalName))) {
    const sourceName = material.material.originalName;
    const parseFingerprint = parseFingerprints[sourceName];
    if (!parseFingerprint) throw new Error(`LC-SEMANTIC-CACHE-001: parse fingerprint missing for '${sourceName}'.`);
    const materialHash = materialIrContentHash(material);
    const fingerprint = sha256({ materialIrHash: materialHash, capability: knowledgeCapabilityFingerprint, resolverVersion: "evidence-resolver-v1" });
    const hit = cache.knowledge.find((entry) => entry.fingerprint === fingerprint && entry.parseFingerprint === parseFingerprint);
    if (hit) {
      drafts.push(...hit.drafts.map((draft) => structuredClone(draft)));
      knowledgeFingerprints.push(hit.fingerprint);
      reusedMaterials.push(sourceName);
      continue;
    }
    const generated = await options.knowledge.understand([material]);
    drafts.push(...generated);
    knowledgeFingerprints.push(fingerprint);
    changedMaterials.push(sourceName);
    if (options.knowledge.identity.mode === "semantic_ai") knowledgeCalls += 1;
    cache.knowledge = cache.knowledge.filter((entry) => entry.sourceName !== sourceName || entry.capabilityFingerprint !== knowledgeCapabilityFingerprint);
    cache.knowledge.push({
      sourceName,
      sourceSha256: material.material.sha256,
      parseFingerprint,
      materialIrHash: materialHash,
      capabilityFingerprint: knowledgeCapabilityFingerprint,
      fingerprint,
      drafts: generated.map((draft) => structuredClone(draft))
    });
  }
  const candidates = prepareCandidatesForDesign(resolveKnowledgeDrafts(drafts, materials));
  const designCandidates = candidates.filter((candidate) => candidate.evidenceRefs.length > 0 && !["unsupported_candidate", "stale_evidence"].includes(candidate.status));
  const candidateSetHash = sha256([...designCandidates]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((candidate) => ({ id: candidate.id, claim: candidate.claim, category: candidate.category, confidence: candidate.confidence, status: candidate.status })));
  const courseCapabilityFingerprint = semanticCapabilityFingerprint(options.courseDesign.identity);
  const courseFingerprint = sha256({ candidateSetHash, capability: courseCapabilityFingerprint, context: planningContext(options) });
  const planFingerprint = planningFingerprint(knowledgeFingerprints, options);
  const courseHit = cache.courseDesign.find((entry) => entry.fingerprint === courseFingerprint);
  let coursePlan: CoursePlanDraft;
  let courseCalls = 0;
  if (courseHit) coursePlan = structuredClone(courseHit.plan);
  else {
    coursePlan = await options.courseDesign.design({ title: options.title, audience: options.audience, purpose: options.purpose, locale: options.locale, candidates: designCandidates, maxSlides: options.maxSlides });
    const errors = validateCoursePlanDraft(coursePlan, designCandidates, options.maxSlides);
    if (errors.length) throw new Error(`LC-SEMANTIC-COURSE-001: ${errors.join("; ")}`);
    if (options.courseDesign.identity.mode === "semantic_ai") courseCalls += 1;
    cache.courseDesign.push({ fingerprint: courseFingerprint, planningFingerprint: planFingerprint, candidateSetHash, capabilityFingerprint: courseCapabilityFingerprint, plan: structuredClone(coursePlan) });
  }
  cache.knowledge.sort((left, right) => left.sourceName.localeCompare(right.sourceName) || left.fingerprint.localeCompare(right.fingerprint));
  cache.courseDesign.sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));
  await writeCache(options.cacheRoot, cache);
  return {
    candidates,
    coursePlan,
    calls: { knowledgeUnderstanding: knowledgeCalls, courseDesign: courseCalls, total: knowledgeCalls + courseCalls },
    changedMaterials,
    reusedMaterials,
    candidateSetHash
  };
};
