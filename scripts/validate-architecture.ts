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
  /@livingcourse\/(?:providers|renderers|workflow)/u,
  /from\s+["'](?:node:)?(?:http|https|net|tls|dns)["']/u,
  /\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(/u,
  /(?:playwright|puppeteer)/iu
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

const courseContract = [
  await readFile(path.join(root, "packages/core/src/types.ts"), "utf8"),
  await readFile(path.join(root, "packages/core/src/schema/course-spec.schema.json"), "utf8")
].join("\n");
if (/(?:minimax|openai|remotion|react|ffmpeg|pptxgenjs|speech-2\.8|male-qn)/iu.test(courseContract)) {
  findings.push({ rule: "course-spec-provider-neutral", file: "packages/core", detail: "CourseSpec contract contains provider or renderer vocabulary." });
}

const compilerTypes = await readFile(path.join(root, "packages/compiler/src/types.ts"), "utf8");
const videoPlanSection = compilerTypes.slice(compilerTypes.indexOf("export interface VideoPlan"), compilerTypes.indexOf("export interface BuildPlanItem"));
if (/(?:minimax|voice_id|audio_setting|subtitle_enable)/iu.test(videoPlanSection)) {
  findings.push({ rule: "video-plan-provider-neutral", file: "packages/compiler/src/types.ts", detail: "VideoPlan contains provider-specific schema." });
}

console.log(JSON.stringify({ passed: findings.length === 0, rules: 6, findings }, null, 2));
if (findings.length > 0) process.exitCode = 1;
