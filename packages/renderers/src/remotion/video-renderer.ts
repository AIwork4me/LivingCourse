import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import type { VideoPlan } from "@livingcourse/compiler";

export interface VideoRenderOptions {
  outputPath: string;
  courseRoot: string;
  stills?: Array<{ frame: number; outputPath: string }>;
  logLevel?: "error" | "warn" | "info" | "verbose";
}

export interface VideoRenderResult {
  outputPath: string;
  durationFrames: number;
  stills: string[];
}

const safeSource = (courseRoot: string, ref: string): string => {
  const root = path.resolve(courseRoot);
  const source = path.resolve(root, ref);
  if (!source.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) throw new Error(`Media reference escapes course root: '${ref}'.`);
  return source;
};

const stagePlan = async (plan: VideoPlan, courseRoot: string, publicDir: string): Promise<VideoPlan> => {
  const staged = structuredClone(plan);
  const refs = new Set<string>();
  for (const slide of staged.slides) {
    for (const layer of slide.layers) if (layer.assetRef) refs.add(layer.assetRef);
    if (slide.audio.assetRef) refs.add(slide.audio.assetRef);
  }
  for (const ref of refs) {
    const target = path.resolve(publicDir, ref);
    if (!target.toLowerCase().startsWith(`${path.resolve(publicDir).toLowerCase()}${path.sep}`)) throw new Error(`Staged media escapes public directory: '${ref}'.`);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(safeSource(courseRoot, ref), target);
  }
  return staged;
};

export const renderVideoPlan = async (plan: VideoPlan, options: VideoRenderOptions): Promise<VideoRenderResult> => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "livingcourse-remotion-"));
  const publicDir = path.join(temp, "public");
  const bundleDir = path.join(temp, "bundle");
  await mkdir(publicDir, { recursive: true });
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  const stagedPlan = await stagePlan(plan, options.courseRoot, publicDir);
  try {
    const serveUrl = await bundle({
      entryPoint: fileURLToPath(new URL("./entry.tsx", import.meta.url)),
      publicDir,
      outDir: bundleDir,
      enableCaching: true
    });
    const inputProps = { plan: stagedPlan };
    const composition = await selectComposition({
      serveUrl,
      id: "LivingCourseVideo",
      inputProps,
      logLevel: options.logLevel ?? "info"
    });
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      audioCodec: "aac",
      enforceAudioTrack: true,
      outputLocation: options.outputPath,
      inputProps,
      overwrite: true,
      logLevel: options.logLevel ?? "info"
    });
    const stills: string[] = [];
    for (const still of options.stills ?? []) {
      await mkdir(path.dirname(still.outputPath), { recursive: true });
      await renderStill({ composition, serveUrl, inputProps, frame: still.frame, output: still.outputPath, imageFormat: "png", logLevel: options.logLevel ?? "info" });
      stills.push(still.outputPath);
    }
    return { outputPath: options.outputPath, durationFrames: composition.durationInFrames, stills };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
};
