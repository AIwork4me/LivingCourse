import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

interface Finding { rule: string; file: string; detail: string }

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json"]);

const walk = async (root: string): Promise<string[]> => {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(target);
  }
  return files.sort();
};

const root = process.cwd();
const findings: Finding[] = [];

const scan = async (relativeRoot: string, rule: string, forbidden: readonly RegExp[]): Promise<void> => {
  const absoluteRoot = path.join(root, relativeRoot);
  for (const file of await walk(absoluteRoot)) {
    const source = await readFile(file, "utf8");
    for (const expression of forbidden) {
      if (expression.test(source)) findings.push({
        rule,
        file: path.relative(root, file).replaceAll("\\", "/"),
        detail: `Matched forbidden architecture pattern: ${expression.source}`
      });
    }
  }
};

await scan("packages/core", "core-isolation", [
  /@livingcourse\/(?:providers|renderers|workflow)/u,
  /(?:minimax|openai|remotion|react|ffmpeg|pptxgenjs|speech-2\.8|male-qn)/iu
]);

await scan("packages/compiler", "compiler-purity", [
  /@livingcourse\/(?:intake|providers|renderers|workflow)/u,
  /from\s+["'](?:node:)?(?:http|https|net|tls|dns)["']/u,
  /\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(/u,
  /(?:playwright|puppeteer)/iu
]);

await scan("packages/intake/src", "material-ir-provider-neutral", [
  /(?:content_list_v2|middle_json|hybrid-engine|\beffort\b)/iu,
  /@livingcourse\/providers/u
]);

await scan("packages/generation/src", "generation-material-ir-boundary", [
  /(?:content_list_v2|middle_json|hybrid-engine|@livingcourse\/providers|\bmineru\b)/iu
]);

await scan("packages/workflow/src", "workflow-no-concrete-llm-sdk", [
  /from\s+["'](?:openai|@anthropic-ai\/sdk|@google\/generative-ai|ollama)["']/iu,
  /require\(["'](?:openai|@anthropic-ai\/sdk|@google\/generative-ai|ollama)["']\)/iu
]);

await scan("packages/compiler/src", "golden-page-id-isolation", [
  /slide-0[123]-/u
]);

await scan("packages/renderers/src", "golden-page-id-isolation", [
  /slide-0[123]-/u
]);

await scan("packages/renderers/src", "renderer-course-neutrality", [
  /(?:护目镜|防护面罩|麦麦|制造车间入口安全)/u,
  /@livingcourse\/(?:providers|workflow)/u
]);

const semanticTransportVocabulary = [
  /LIVINGCOURSE_SEMANTIC_/u,
  /openai-compatible/iu,
  /chat\/completions/iu,
  /OpenAICompatibleStructuredGenerationTransport/u
];
for (const target of ["packages/core/src", "packages/compiler/src", "packages/renderers/src"]) {
  await scan(target, "semantic-transport-isolation", semanticTransportVocabulary);
}

const courseContract = [
  await readFile(path.join(root, "packages/core/src/types.ts"), "utf8"),
  await readFile(path.join(root, "packages/core/src/schema/course-spec.schema.json"), "utf8")
].join("\n");
if (/(?:mineru|content_list_v2|middle_json|hybrid-engine|\beffort\b|minimax|openai|remotion|react|ffmpeg|pptxgenjs|speech-2\.8|male-qn)/iu.test(courseContract)) {
  findings.push({ rule: "course-spec-provider-neutral", file: "packages/core", detail: "CourseSpec contract contains provider or renderer vocabulary." });
}
if (/["']?(?:provider|model|promptTemplateVersion|promptTemplateHash|endpoint|apiKey|baseUrl)["']?\s*:/iu.test(courseContract)) {
  findings.push({ rule: "course-spec-no-semantic-provider-metadata", file: "packages/core", detail: "CourseSpec cannot contain semantic provider, model, prompt, endpoint, or credential fields; those belong only to workflow or CourseSpecCandidate metadata." });
}

const capabilitySource = await readFile(path.join(root, "packages/generation/src/capabilities.ts"), "utf8");
const knowledgeDraftSection = capabilitySource.slice(capabilitySource.indexOf("export interface KnowledgeCandidateDraft"), capabilitySource.indexOf("export interface KnowledgeFidelityIssue"));
if (!/sourceHints:\s*KnowledgeSourceHint\[\]/u.test(knowledgeDraftSection) || /evidenceRefs|groundingStatus|authorityAssessment|approved/u.test(knowledgeDraftSection)) {
  findings.push({ rule: "knowledge-ai-draft-authority-boundary", file: "packages/generation/src/capabilities.ts", detail: "KnowledgeCandidateDraft must expose source hints but cannot assign evidence, grounding, authority, or approval fields." });
}

const coursePlanSection = capabilitySource.slice(capabilitySource.indexOf("export interface CoursePlanSlideDraft"), capabilitySource.indexOf("export interface CoursePlanDraft"));
if (!/candidateIds:\s*string\[\]/u.test(coursePlanSection) || /\b(?:knowledge|items|evidenceRefs)\s*:/u.test(coursePlanSection)) {
  findings.push({ rule: "course-design-candidate-reference-only", file: "packages/generation/src/capabilities.ts", detail: "CourseDesign slides must reference facts only through candidateIds." });
}

const candidateSource = await readFile(path.join(root, "packages/generation/src/candidate.ts"), "utf8");
if (/slideTypeAt|general\s*(?:→|->)\s*slide\s*1|safety\s*(?:→|->)\s*slide\s*2|device(?:_operation)?\s*(?:→|->)\s*slide\s*3/iu.test(candidateSource)) {
  findings.push({ rule: "candidate-no-golden-page-mapping", file: "packages/generation/src/candidate.ts", detail: "Candidate generation cannot hardcode the legacy three-page category or index mapping." });
}

const generationSources = (await Promise.all((await walk(path.join(root, "packages/generation/src"))).map((file) => readFile(file, "utf8")))).join("\n");
if (!/@livingcourse\/intake/u.test(generationSources) || !/\bMaterialIR\b/u.test(generationSources)) {
  findings.push({ rule: "generation-consumes-material-ir", file: "packages/generation/src", detail: "Generation must consume the provider-neutral MaterialIR contract." });
}

const compilerTypes = await readFile(path.join(root, "packages/compiler/src/types.ts"), "utf8");
const videoPlanSection = compilerTypes.slice(compilerTypes.indexOf("export interface VideoPlan"), compilerTypes.indexOf("export interface BuildPlanItem"));
if (/(?:minimax|voice_id|audio_setting|subtitle_enable)/iu.test(videoPlanSection)) {
  findings.push({ rule: "video-plan-provider-neutral", file: "packages/compiler/src/types.ts", detail: "VideoPlan contains provider-specific schema." });
}

console.log(JSON.stringify({ passed: findings.length === 0, rules: 16, findings }, null, 2));
if (findings.length > 0) process.exitCode = 1;
