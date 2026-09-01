import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DirectTextProvider,
  DocumentParsingProviderRegistry,
  discoverDocumentInputs,
  materialIrContentHash,
  parsingFingerprint,
  validateMaterialIR,
  type DocumentInput,
  type DocumentParsingProvider,
  type IntakeDiagnostic,
  type MaterialIR,
  type ParseProfile,
  type ProviderHealth,
  type SourceMetadata
} from "@livingcourse/intake";
import { MineruHttpProvider } from "@livingcourse/providers";
import type { RawParserArtifact } from "@livingcourse/intake";

interface IntakeCacheEntry {
  sourceName: string;
  sourceSha256: string;
  providerId: string;
  providerVersion: string;
  parseProfile: ParseProfile;
  fingerprint: string;
  materialIrPath: string;
  materialIrHash: string;
}

interface IntakeCacheIndex {
  version: "0.1.0";
  entries: IntakeCacheEntry[];
}

export interface IntakeWorkflowOptions {
  workspaceRoot?: string;
  cacheRoot?: string;
  profile?: ParseProfile;
  mineruEndpoint?: string;
  metadata?: Readonly<Record<string, SourceMetadata>>;
  providers?: readonly DocumentParsingProvider[];
  parsedAt?: string;
}

export interface IntakePlanItem {
  input: DocumentInput;
  parser: string;
  providerVersion: string | null;
  profile: ParseProfile;
  potentialEscalation: "high_fidelity only on parsing failure" | "none";
  processingMode: ProviderHealth["processingMode"];
  endpointClassification: ProviderHealth["endpointClassification"];
  health: ProviderHealth["status"];
  cacheFingerprint: string | null;
  action: "REUSE" | "PARSE" | "BLOCKED";
  blocker: string | null;
}

export interface IntakePlanResult {
  folder: string;
  files: IntakePlanItem[];
  parserCalls: 0;
  aiCalls: 0;
  blockers: string[];
  cacheRoot: string;
}

export interface IntakeExecutionResult {
  plan: IntakePlanResult;
  materials: MaterialIR[];
  diagnostics: IntakeDiagnostic[];
  parserCalls: number;
  materialRegenerations: number;
  reused: string[];
  parsed: string[];
  materialIrHashes: Record<string, string>;
}

const readCache = async (cacheRoot: string): Promise<IntakeCacheIndex> => {
  try {
    const value = JSON.parse(await readFile(path.join(cacheRoot, "index.json"), "utf8")) as IntakeCacheIndex;
    return value.version === "0.1.0" && Array.isArray(value.entries) ? value : { version: "0.1.0", entries: [] };
  } catch {
    return { version: "0.1.0", entries: [] };
  }
};

const atomicJson = async (target: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, target);
};

const registeredProviders = (options: IntakeWorkflowOptions): DocumentParsingProviderRegistry => {
  const registry = new DocumentParsingProviderRegistry();
  const providers = options.providers ?? [
    new DirectTextProvider(),
    new MineruHttpProvider({ endpoint: options.mineruEndpoint ?? process.env.MINERU_API_URL ?? "http://127.0.0.1:8000" })
  ];
  providers.forEach((provider) => registry.register(provider));
  return registry;
};

const relativeArtifactName = (name: string): string => name.replace(/\\/gu, "/").split("/").filter((part) => part && part !== "." && part !== "..").join("/");

const preserveRawArtifacts = async (workspaceRoot: string, providerId: string, fingerprint: string, artifacts: readonly RawParserArtifact[]): Promise<string[]> => {
  const stored: string[] = [];
  for (const artifact of artifacts) {
    const relative = relativeArtifactName(artifact.name);
    if (!relative) continue;
    const target = path.join(workspaceRoot, ".livingcourse", "providers", providerId, fingerprint, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, artifact.bytes);
    stored.push(path.relative(workspaceRoot, target).replace(/\\/gu, "/"));
  }
  return stored.sort();
};

export const planIntake = async (folder: string, options: IntakeWorkflowOptions = {}): Promise<IntakePlanResult> => {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const cacheRoot = path.resolve(options.cacheRoot ?? path.join(workspaceRoot, ".livingcourse", "intake"));
  const profile = options.profile ?? "balanced";
  const inputs = await discoverDocumentInputs(folder, options.metadata);
  const cache = await readCache(cacheRoot);
  const registry = registeredProviders(options);
  const healthByProvider = new Map<string, ProviderHealth>();
  const files: IntakePlanItem[] = [];
  for (const input of inputs) {
    let provider: DocumentParsingProvider;
    try {
      provider = registry.resolve(input);
    } catch (error) {
      files.push({ input, parser: "none", providerVersion: null, profile, potentialEscalation: "none", processingMode: "local", endpointClassification: "not_applicable", health: "not_available", cacheFingerprint: null, action: "BLOCKED", blocker: (error as Error).message });
      continue;
    }
    let health = healthByProvider.get(provider.id);
    if (!health) {
      health = await provider.health();
      healthByProvider.set(provider.id, health);
    }
    const fingerprint = health.version ? parsingFingerprint({ sourceSha256: input.sha256, providerId: provider.id, providerVersion: health.version, parseProfile: profile }) : null;
    const hit = fingerprint ? cache.entries.find((entry) => entry.fingerprint === fingerprint) : undefined;
    const blocker = health.status === "not_available" && !hit ? health.detail : null;
    files.push({
      input,
      parser: provider.id,
      providerVersion: health.version,
      profile,
      potentialEscalation: provider.id === "built-in-text" || profile === "high_fidelity" ? "none" : "high_fidelity only on parsing failure",
      processingMode: health.processingMode,
      endpointClassification: health.endpointClassification,
      health: health.status,
      cacheFingerprint: fingerprint,
      action: hit ? "REUSE" : blocker ? "BLOCKED" : "PARSE",
      blocker
    });
  }
  return { folder: path.resolve(folder), files, parserCalls: 0, aiCalls: 0, blockers: files.flatMap((file) => file.blocker ? [`${file.input.originalName}: ${file.blocker}`] : []), cacheRoot };
};

export const executeIntake = async (folder: string, options: IntakeWorkflowOptions = {}): Promise<IntakeExecutionResult> => {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const plan = await planIntake(folder, options);
  if (plan.blockers.length) throw new Error(`LC-INTAKE-WORKFLOW-001: ${plan.blockers.join("; ")}`);
  const cache = await readCache(plan.cacheRoot);
  const registry = registeredProviders(options);
  const materials: MaterialIR[] = [];
  const diagnostics: IntakeDiagnostic[] = [];
  const reused: string[] = [];
  const parsed: string[] = [];
  let parserCalls = 0;
  for (const item of plan.files) {
    if (!item.cacheFingerprint || !item.providerVersion) throw new Error(`LC-INTAKE-WORKFLOW-002: no stable provider fingerprint for '${item.input.originalName}'.`);
    const cached = cache.entries.find((entry) => entry.fingerprint === item.cacheFingerprint);
    if (cached) {
      const material = JSON.parse(await readFile(path.join(plan.cacheRoot, cached.materialIrPath), "utf8")) as MaterialIR;
      materials.push(material);
      diagnostics.push(...material.diagnostics);
      reused.push(item.input.originalName);
      continue;
    }
    const provider = registry.get(item.parser);
    parserCalls += 1;
    const result = await provider.parse({ input: item.input, profile: item.profile, parsedAt: options.parsedAt ?? new Date().toISOString() });
    const validation = validateMaterialIR(result.materialIr);
    if (!validation.valid) throw new Error(`LC-INTAKE-WORKFLOW-003: invalid MaterialIR for '${item.input.originalName}': ${validation.issues.map((issue) => issue.message).join("; ")}`);
    await preserveRawArtifacts(workspaceRoot, provider.id, item.cacheFingerprint, result.rawArtifacts);
    const relativeMaterial = path.join("cache", item.cacheFingerprint, "material-ir.json");
    await atomicJson(path.join(plan.cacheRoot, relativeMaterial), result.materialIr);
    cache.entries = cache.entries.filter((entry) => entry.sourceName !== item.input.originalName);
    cache.entries.push({ sourceName: item.input.originalName, sourceSha256: item.input.sha256, providerId: provider.id, providerVersion: item.providerVersion, parseProfile: item.profile, fingerprint: item.cacheFingerprint, materialIrPath: relativeMaterial, materialIrHash: materialIrContentHash(result.materialIr) });
    materials.push(result.materialIr);
    diagnostics.push(...result.diagnostics);
    parsed.push(item.input.originalName);
  }
  cache.entries.sort((left, right) => left.sourceName.localeCompare(right.sourceName));
  await atomicJson(path.join(plan.cacheRoot, "index.json"), cache);
  materials.sort((left, right) => left.material.originalName.localeCompare(right.material.originalName));
  return { plan, materials, diagnostics, parserCalls, materialRegenerations: parsed.length, reused, parsed, materialIrHashes: Object.fromEntries(materials.map((material) => [material.material.originalName, materialIrContentHash(material)])) };
};
