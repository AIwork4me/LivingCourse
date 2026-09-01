import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  compileCourse,
  type BuildFingerprints,
  type BuildPlan,
  type CompilerContext,
  type PresentationPlan,
  type VideoPlan
} from "@livingcourse/compiler";
import { canonicalJson, sha256, validateCourseSpec, type CourseSpec, type ReviewStatus } from "@livingcourse/core";
import { inspectPptxStructure, inspectRenderedVideo, renderPresentationPlan, renderVideoPlan } from "@livingcourse/renderers";
import { ArtifactRegistry, fileSha256 } from "./registry.js";
import { createReviewPackage } from "./review.js";
import { resolveWorkflowBuildFingerprints } from "./fingerprints.js";
import type {
  WorkflowExecutionResult,
  WorkflowPlanResult,
  WorkflowRenderers,
  WorkflowRunState
} from "./types.js";
import { WorkflowError } from "./types.js";

export interface PlanBuildOptions {
  workspaceRoot?: string;
  outputRoot?: string;
  buildFingerprints?: Partial<BuildFingerprints>;
}

export interface ExecuteBuildOptions extends PlanBuildOptions {
  renderers?: WorkflowRenderers;
}

const exists = async (target: string): Promise<boolean> => {
  try { await stat(target); return true; } catch { return false; }
};

const binarySha256Sync = (target: string): string => createHash("sha256").update(readFileSync(target)).digest("hex");

const approvedRefs = (course: CourseSpec): Map<string, ReviewStatus> => {
  const refs = new Map<string, ReviewStatus>();
  for (const slide of course.slides) {
    if (slide.governance.reviewStatus !== "approved_for_poc_use" && slide.governance.reviewStatus !== "approved_for_release") continue;
    for (const requirement of slide.presentation.visualIntent.requirements) if (requirement.assetRef) refs.set(requirement.assetRef, slide.governance.reviewStatus);
    if (slide.narration.audioAssetRef) refs.set(slide.narration.audioAssetRef, slide.governance.reviewStatus);
  }
  return refs;
};

const filesystemContext = (course: CourseSpec, courseRoot: string, buildFingerprints: BuildFingerprints): Partial<CompilerContext> => {
  const approved = approvedRefs(course);
  return {
    assetProbe: {
      probe: (assetRef) => {
        const target = path.resolve(courseRoot, assetRef);
        const exists = existsSync(target);
        return { exists, approved: exists && approved.has(assetRef), sha256: exists ? binarySha256Sync(target) : null };
      }
    },
    timingProbe: { durationMs: () => null },
    reviewDecisionSource: { decisions: () => course.governance.reviewDecisions },
    buildFingerprints
  };
};

const runIdentity = (course: CourseSpec, buildFingerprints: BuildFingerprints): { runId: string; inputHash: string } => {
  const inputHash = sha256(course);
  const runId = sha256({
    inputHash,
    buildFingerprints
  }).slice(0, 24);
  return { runId, inputHash };
};

const cloneBuildPlan = (plan: BuildPlan): BuildPlan => structuredClone(plan);

export const planBuild = async (coursePath: string, options: PlanBuildOptions = {}): Promise<WorkflowPlanResult> => {
  const resolvedCoursePath = path.resolve(coursePath);
  const courseRoot = path.dirname(resolvedCoursePath);
  const workspaceRoot = path.resolve(options.workspaceRoot ?? courseRoot);
  const course = JSON.parse(await readFile(resolvedCoursePath, "utf8")) as CourseSpec;
  const validation = validateCourseSpec(course);
  if (!validation.valid) throw new WorkflowError({
    code: "LC-SCHEMA-001",
    whatHappened: "CourseSpec validation failed.",
    why: validation.errors.map((error) => `${error.path}: ${error.message}`).join("; "),
    canAutoFix: false,
    userAction: "Correct the reported CourseSpec fields and run validate again.",
    retryRequiresAi: false
  });
  const resolvedFingerprints = await resolveWorkflowBuildFingerprints();
  const buildFingerprints = { ...resolvedFingerprints, ...options.buildFingerprints };
  const output = compileCourse(course, filesystemContext(course, courseRoot, buildFingerprints));
  const identity = runIdentity(output.courseSpec, buildFingerprints);
  const outputRoot = path.resolve(options.outputRoot ?? path.join(workspaceRoot, "dist", course.course.id));
  const registry = new ArtifactRegistry(path.join(workspaceRoot, ".livingcourse"));
  await registry.load();
  const previous = await registry.readRun(identity.runId);
  const expectedPptx = path.join(outputRoot, "course.pptx");
  const expectedVideo = path.join(outputRoot, "author-review.mp4");
  const buildPlan = cloneBuildPlan(output.buildPlan);
  for (const outputItem of buildPlan.rebuild.filter((entry) => entry.kind === "pptx" || entry.kind === "video")) {
    const reusable = registry.findReusable(outputItem.fingerprint);
    if (reusable && await exists(reusable.path)) {
      buildPlan.reuse.push({ ...outputItem, reason: "Matching deterministic renderer fingerprint is reusable." });
      buildPlan.rebuild = buildPlan.rebuild.filter((entry) => entry.id !== outputItem.id);
    }
  }
  const cacheHit = previous?.status === "complete"
    && await exists(expectedPptx)
    && await exists(expectedVideo)
    && !buildPlan.rebuild.some((entry) => entry.kind === "pptx" || entry.kind === "video");
  return {
    runId: identity.runId,
    inputHash: identity.inputHash,
    buildPlan,
    presentationPlan: output.presentationPlan,
    videoPlan: output.videoPlan,
    coursePath: resolvedCoursePath,
    courseRoot,
    outputRoot,
    cacheHit,
    buildFingerprints,
    reviewPackage: createReviewPackage(course, buildPlan)
  };
};

const defaultRenderers: WorkflowRenderers = {
  renderPpt: async (plan: PresentationPlan, outputPath: string, courseRoot: string) => {
    await renderPresentationPlan(plan, { outputPath, courseRoot });
  },
  renderVideo: async (plan: VideoPlan, outputPath: string, courseRoot: string) => {
    await renderVideoPlan(plan, { outputPath, courseRoot, logLevel: "warn" });
  },
  qa: async (pptxPath: string, videoPath: string) => {
    const [ppt, video] = await Promise.all([inspectPptxStructure(pptxPath), inspectRenderedVideo(videoPath)]);
    const checks = [
      { id: "ppt-slide-count", passed: ppt.slideCount > 0, detail: `${ppt.slideCount} slide(s).` },
      { id: "ppt-speaker-notes", passed: ppt.notesCount === ppt.slideCount, detail: `${ppt.notesCount} note part(s).` },
      { id: "ppt-editable-text", passed: ppt.editable, detail: `${ppt.nativeText.length} native text object(s).` },
      { id: "video-frame", passed: video.width === 1280 && video.height === 720 && video.fps === 30, detail: `${video.width}x${video.height} @ ${video.fps} fps.` },
      { id: "video-codecs", passed: video.videoCodec === "h264" && video.audioCodec === "aac" && video.audioPresent, detail: `${video.videoCodec} + ${video.audioCodec ?? "no audio"}.` }
    ];
    return {
      passed: checks.every((check) => check.passed),
      ppt: { slideCount: ppt.slideCount, notesCount: ppt.notesCount, editable: ppt.editable, nativeTextCount: ppt.nativeText.length },
      video,
      checks
    };
  }
};

const seedApprovedArtifacts = async (course: CourseSpec, courseRoot: string, registry: ArtifactRegistry): Promise<string[]> => {
  const seeded: string[] = [];
  for (const slide of course.slides) {
    const reviewStatus = slide.governance.reviewStatus === "approved_for_release" ? "approved_for_release" : "approved_for_poc_use";
    for (const requirement of slide.presentation.visualIntent.requirements) {
      if (!requirement.assetRef) continue;
      const sourcePath = path.resolve(courseRoot, requirement.assetRef);
      if (!await exists(sourcePath)) continue;
      const sourceHash = await fileSha256(sourcePath);
      const generationFingerprint = sha256({
        sourceHash,
        structuredInput: requirement,
        promptTemplateVersion: "approved-reference-v1",
        profileVersion: "livingcourse-light-tech-comic-v1",
        provider: "approved-reference-reuse",
        model: "content-addressed-artifact"
      });
      if (!registry.findReusable(generationFingerprint)) await registry.registerSource({
        id: `visual:${slide.id}:${requirement.id}`,
        kind: "visual",
        sourceHash,
        generationFingerprint,
        sourcePath,
        provider: "approved-reference-reuse",
        model: "content-addressed-artifact",
        reviewStatus,
        dependencies: [...slide.grounding.sourceRefs]
      });
      seeded.push(`visual:${slide.id}:${requirement.id}`);
    }
    if (slide.narration.audioAssetRef) {
      const sourcePath = path.resolve(courseRoot, slide.narration.audioAssetRef);
      if (!await exists(sourcePath)) continue;
      const sourceHash = await fileSha256(sourcePath);
      const generationFingerprint = sha256({
        sourceHash,
        structuredInput: { script: slide.narration.script, voiceProfile: slide.narration.voiceProfile },
        promptTemplateVersion: "approved-reference-v1",
        profileVersion: slide.narration.voiceProfile,
        provider: "approved-reference-reuse",
        model: "content-addressed-artifact"
      });
      if (!registry.findReusable(generationFingerprint)) await registry.registerSource({
        id: `audio:${slide.id}`,
        kind: "audio",
        sourceHash,
        generationFingerprint,
        sourcePath,
        provider: "approved-reference-reuse",
        model: "content-addressed-artifact",
        reviewStatus,
        dependencies: [sha256(slide.narration.script)]
      });
      seeded.push(`audio:${slide.id}`);
    }
  }
  return seeded.sort();
};

const makeRunState = (plan: WorkflowPlanResult, previous: WorkflowRunState | null): WorkflowRunState => ({
  version: "0.1.0",
  runId: plan.runId,
  inputHash: plan.inputHash,
  status: "running",
  completedNodes: previous?.inputHash === plan.inputHash ? [...previous.completedNodes] : [],
  outputs: previous?.inputHash === plan.inputHash ? structuredClone(previous.outputs) : { pptx: null, video: null },
  error: null,
  updatedAt: new Date().toISOString()
});

const deterministicOutputItem = (plan: WorkflowPlanResult, id: "course-pptx" | "author-review-mp4") =>
  [...plan.buildPlan.reuse, ...plan.buildPlan.rebuild].find((entry) => entry.id === id);

const materializeReusableOutput = async (
  plan: WorkflowPlanResult,
  registry: ArtifactRegistry,
  state: WorkflowRunState,
  id: "course-pptx" | "author-review-mp4",
  nodeId: "pptx" | "video",
  targetPath: string
): Promise<boolean> => {
  const item = plan.buildPlan.reuse.find((entry) => entry.id === id);
  if (!item) return false;
  const artifact = registry.findReusable(item.fingerprint);
  if (!artifact || !await exists(artifact.path)) return false;
  if (!await exists(targetPath) || await fileSha256(targetPath) !== artifact.sha256) await copyFile(artifact.path, targetPath);
  if (!state.completedNodes.includes(nodeId)) state.completedNodes.push(nodeId);
  state.outputs[nodeId] = targetPath;
  return true;
};

const registerDeterministicOutput = async (
  plan: WorkflowPlanResult,
  registry: ArtifactRegistry,
  id: "course-pptx" | "author-review-mp4",
  sourcePath: string
): Promise<void> => {
  const item = deterministicOutputItem(plan, id);
  if (!item) throw new Error(`Missing deterministic output plan item '${id}'.`);
  await registry.registerSource({
    id: `output:${id}:${item.fingerprint}`,
    kind: id === "course-pptx" ? "pptx" : "video",
    sourceHash: plan.inputHash,
    generationFingerprint: item.fingerprint,
    sourcePath,
    provider: "deterministic-renderer",
    model: id === "course-pptx" ? plan.buildFingerprints.presentationRendererFingerprint : plan.buildFingerprints.videoRendererFingerprint,
    reviewStatus: "approved_for_poc_use",
    dependencies: [plan.inputHash]
  });
};

export const executeBuild = async (coursePath: string, options: ExecuteBuildOptions = {}): Promise<WorkflowExecutionResult> => {
  const plan = await planBuild(coursePath, options);
  const workspaceRoot = path.resolve(options.workspaceRoot ?? plan.courseRoot);
  const registry = new ArtifactRegistry(path.join(workspaceRoot, ".livingcourse"));
  await registry.load();
  const previous = await registry.readRun(plan.runId);
  const renderers = options.renderers ?? defaultRenderers;
  if (plan.cacheHit && previous) {
    if (!previous.qa && renderers.qa && previous.outputs.pptx && previous.outputs.video) {
      previous.qa = await renderers.qa(previous.outputs.pptx, previous.outputs.video);
      if (!previous.completedNodes.includes("qa")) previous.completedNodes.push("qa");
      previous.updatedAt = new Date().toISOString();
      await registry.writeRun(previous);
    }
    return {
      runId: plan.runId,
      status: "complete",
      buildPlan: plan.buildPlan,
      aiCalls: { llm: 0, image: 0, tts: 0 },
      reused: plan.buildPlan.reuse.map((entry) => entry.id),
      regenerated: [],
      rebuilt: [],
      outputs: structuredClone(previous.outputs),
      resumed: false,
      qa: previous.qa ?? null,
      reviewPackage: plan.reviewPackage
    };
  }
  if (plan.buildPlan.regenerate.length > 0) throw new WorkflowError({
    code: "LC-PROVIDER-001",
    whatHappened: "Build requires probabilistic generation that is not configured.",
    why: `${plan.buildPlan.regenerate.length} artifact(s) require generation.`,
    canAutoFix: false,
    userAction: "Configure a generation provider or approve a matching cached artifact, then retry.",
    retryRequiresAi: true
  });
  const course = JSON.parse(await readFile(plan.coursePath, "utf8")) as CourseSpec;
  const reused = await seedApprovedArtifacts(course, plan.courseRoot, registry);
  const state = makeRunState(plan, previous);
  const resumed = previous?.status === "failed" && state.completedNodes.length > 0;
  await registry.writeRun(state);
  const pptxPath = path.join(plan.outputRoot, "course.pptx");
  const videoPath = path.join(plan.outputRoot, "author-review.mp4");
  await mkdir(plan.outputRoot, { recursive: true });
  if (await materializeReusableOutput(plan, registry, state, "course-pptx", "pptx", pptxPath)) reused.push("course-pptx");
  if (await materializeReusableOutput(plan, registry, state, "author-review-mp4", "video", videoPath)) reused.push("author-review-mp4");
  await registry.writeRun(state);
  const rebuilt: string[] = [];
  try {
    if (!state.completedNodes.includes("pptx") || !await exists(pptxPath)) {
      await renderers.renderPpt(plan.presentationPlan, pptxPath, plan.courseRoot);
      await registerDeterministicOutput(plan, registry, "course-pptx", pptxPath);
      state.completedNodes.push("pptx");
      state.outputs.pptx = pptxPath;
      state.updatedAt = new Date().toISOString();
      await registry.writeRun(state);
      rebuilt.push("course-pptx");
    }
    if (!state.completedNodes.includes("video") || !await exists(videoPath)) {
      await renderers.renderVideo(plan.videoPlan, videoPath, plan.courseRoot);
      await registerDeterministicOutput(plan, registry, "author-review-mp4", videoPath);
      state.completedNodes.push("video");
      state.outputs.video = videoPath;
      state.updatedAt = new Date().toISOString();
      await registry.writeRun(state);
      rebuilt.push("author-review-mp4");
    }
    if (renderers.qa) {
      state.qa = await renderers.qa(pptxPath, videoPath);
      if (!state.qa.passed) throw new Error("Deterministic output QA failed.");
      if (!state.completedNodes.includes("qa")) state.completedNodes.push("qa");
    }
    state.status = "complete";
    state.error = null;
    state.updatedAt = new Date().toISOString();
    await registry.writeRun(state);
    return {
      runId: plan.runId,
      status: "complete",
      buildPlan: plan.buildPlan,
      aiCalls: { llm: 0, image: 0, tts: 0 },
      reused,
      regenerated: [],
      rebuilt,
      outputs: structuredClone(state.outputs),
      resumed,
      qa: state.qa ?? null,
      reviewPackage: plan.reviewPackage
    };
  } catch (error) {
    state.status = "failed";
    state.error = { code: "LC-BUILD-001", message: (error as Error).message };
    state.updatedAt = new Date().toISOString();
    await registry.writeRun(state);
    throw new WorkflowError({
      code: "LC-BUILD-001",
      whatHappened: "A deterministic renderer failed.",
      why: (error as Error).message,
      canAutoFix: false,
      userAction: "Fix the renderer or environment issue and rerun; completed nodes will be reused.",
      retryRequiresAi: false
    });
  }
};

export const canonicalWorkflowPlan = (plan: WorkflowPlanResult): string => canonicalJson({
  runId: plan.runId,
  inputHash: plan.inputHash,
  buildPlan: plan.buildPlan,
  presentationPlan: plan.presentationPlan,
  videoPlan: plan.videoPlan
});
