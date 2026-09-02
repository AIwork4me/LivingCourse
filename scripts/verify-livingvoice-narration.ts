/**
 * Real-server narration verification (v0.1.1 production closure).
 *
 * Drive the real LivingCourse build engine against a REAL running LivingVoice
 * server over HTTP:
 *
 *   1. boot:  LivingVoice must already be running at
 *             LIVINGCOURSE_NARRATION_BASE_URL (default http://127.0.0.1:4310)
 *   2. this script pins a course's narration to a LivingVoice voice config id,
 *      removes the audio files, and executes the build
 *   3. pass:   narration WAVs materialize at the declared audioAssetRef paths,
 *              the build completes, and a second build reuses with zero calls
 *
 * Usage (from the LivingCourse repo root):
 *   LIVINGCOURSE_NARRATION_BASE_URL=http://127.0.0.1:4310 \
 *     corepack pnpm exec tsx scripts/verify-livingvoice-narration.ts <courseRoot>
 *
 * <courseRoot> must contain a course-spec.json whose narration.voiceProfile
 * values are LivingVoice voice config ids and whose declared audio files do
 * NOT exist yet. The TTS vendor behind the LivingVoice profile may be the
 * offline mock adapter — this script verifies the LivingCourse → LivingVoice
 * production path, not vendor fidelity.
 */
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { executeBuild, resolveNarrationProviderFromEnv, type WorkflowRenderers } from "@livingcourse/workflow";

const courseSource = process.argv[2];
if (courseSource === undefined) {
  console.error("usage: tsx scripts/verify-livingvoice-narration.ts <courseRoot>");
  process.exit(2);
}

const baseUrl = process.env.LIVINGCOURSE_NARRATION_BASE_URL?.trim();
if (baseUrl === undefined || baseUrl.length === 0) {
  console.error("LIVINGCOURSE_NARRATION_BASE_URL must point at a running LivingVoice server.");
  process.exit(2);
}

const resolved = resolveNarrationProviderFromEnv();
if (!resolved.enabled || resolved.narration === null) {
  console.error("narration provider did not resolve from the environment.");
  process.exit(2);
}

// Stage a disposable copy so the build writes synthesized audio outside the
// original fixture.
const staging = await mkdtemp(path.join(os.tmpdir(), "livingvoice-narration-verify-"));
const courseRoot = path.join(staging, "course");
await mkdir(courseRoot, { recursive: true });
await cp(courseSource, courseRoot, { recursive: true });

// Strip existing audio so the build MUST regenerate it through LivingVoice.
const audioDir = path.join(courseRoot, "audio");
await rm(audioDir, { recursive: true, force: true }).catch(() => undefined);

const coursePath = path.join(courseRoot, "course-spec.json");
const course = JSON.parse(await readFile(coursePath, "utf8")) as {
  course: { id: string };
  slides: Array<{ id: string; narration: { voiceProfile: string; audioAssetRef: string | null } }>;
};
const pinnedConfigs = [...new Set(course.slides.map((slide) => slide.narration.voiceProfile))];
console.log(`course: ${course.course.id} (${course.slides.length} slides)`);
console.log(`pinned voice configs: ${pinnedConfigs.join(", ")}`);
for (const voiceConfigId of pinnedConfigs) {
  const response = await fetch(`${baseUrl.replace(/\/+$/u, "")}/v1/voice-configs/${encodeURIComponent(voiceConfigId)}`);
  if (!response.ok) {
    console.error(`voice config ${voiceConfigId} is not available on ${baseUrl} (HTTP ${response.status}).`);
    await rm(staging, { recursive: true, force: true });
    process.exit(1);
  }
}

const renderers: WorkflowRenderers = {
  renderPpt: async (_plan, outputPath) => {
    await writeFile(outputPath, `pptx-bytes:${course.course.id}`, "utf8");
  },
  renderVideo: async (_plan, outputPath) => {
    // A real MP4 render additionally requires ffmpeg + a headless browser;
    // this script's scope is the LivingCourse → LivingVoice audio path.
    await writeFile(outputPath, `video-container:${course.course.id}`, "utf8");
  }
};

const first = await executeBuild(coursePath, {
  workspaceRoot: path.join(staging, "workspace"),
  renderers,
  narration: resolved.narration
});
console.log(`first build: status=${first.status} tts=${first.aiCalls.tts} regenerated=${first.regenerated.length}`);

let failures = 0;
for (const slide of course.slides) {
  const assetRef = slide.narration.audioAssetRef;
  if (assetRef === null) continue;
  try {
    const info = await stat(path.resolve(courseRoot, assetRef));
    if (info.size <= 44) throw new Error("file too small to be narration audio");
    console.log(`  ok ${assetRef} (${info.size} bytes)`);
  } catch (error) {
    failures += 1;
    console.error(`  MISSING ${assetRef}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const second = await executeBuild(coursePath, {
  workspaceRoot: path.join(staging, "workspace"),
  renderers,
  narration: resolved.narration
});
const reusedEverything = second.aiCalls.tts === 0 && second.regenerated.length === 0;
console.log(`second build: status=${second.status} tts=${second.aiCalls.tts} reused=${second.reused.length}`);

await rm(staging, { recursive: true, force: true });
if (failures > 0 || first.status !== "complete" || !reusedEverything) {
  console.error("LIVINGVOICE NARRATION VERIFICATION = FAIL");
  process.exit(1);
}
console.log(`LIVINGVOICE NARRATION VERIFICATION = PASS (against ${baseUrl})`);
