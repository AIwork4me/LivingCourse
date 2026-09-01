import { access, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sha256, type CourseSpec } from "@livingcourse/core";
import { compileCourse, type CompilerContext } from "@livingcourse/compiler";
import { inspectPptxStructure, inspectRenderedVideo, renderPresentationPlan, renderVideoPlan } from "@livingcourse/renderers";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const fixtureRoot = path.join(projectRoot, "tests", "fixtures", "golden-v0.1");
const outputRoot = path.join(projectRoot, "dist", "golden-v0.2");

const context: Partial<CompilerContext> = {
  assetProbe: { probe: (assetRef) => ({ exists: true, approved: true, sha256: sha256(assetRef) }) },
  timingProbe: { durationMs: () => null },
  reviewDecisionSource: { decisions: () => [] }
};

const compile = async () => {
  const course = JSON.parse(await readFile(path.join(fixtureRoot, "course-spec.json"), "utf8")) as CourseSpec;
  return compileCourse(course, context);
};

describe("M2 renderer adapters", () => {
  it("renders an editable three-slide PPTX from PresentationPlan only", async () => {
    await mkdir(outputRoot, { recursive: true });
    const output = await compile();
    const pptxPath = path.join(outputRoot, "livingcourse-three-slide.pptx");
    const result = await renderPresentationPlan(output.presentationPlan, { outputPath: pptxPath, courseRoot: fixtureRoot });
    const qa = await inspectPptxStructure(pptxPath);
    expect(result.slideCount).toBe(3);
    expect(qa.slideCount).toBe(3);
    expect(qa.notesCount).toBe(3);
    expect(qa.editable).toBe(true);
    expect(qa.nativeText).toContain("护目镜与防护面罩");
    expect(qa.nativeText).toContain("模拟培训示意｜正式使用请替换为现场真实设备与已批准 SOP");
  }, 60_000);

  it("renders a narrated Author Review MP4 and representative stills from VideoPlan only", async () => {
    await mkdir(outputRoot, { recursive: true });
    const output = await compile();
    const videoPath = path.join(outputRoot, "livingcourse-author-review.mp4");
    const stillRoot = path.join(outputRoot, "qa-stills");
    const result = await renderVideoPlan(output.videoPlan, {
      outputPath: videoPath,
      courseRoot: fixtureRoot,
      logLevel: "warn",
      stills: [
        { frame: 120, outputPath: path.join(stillRoot, "slide-01.png") },
        { frame: 820, outputPath: path.join(stillRoot, "slide-02.png") },
        { frame: 1100, outputPath: path.join(stillRoot, "slide-03.png") },
        { frame: 1500, outputPath: path.join(stillRoot, "caption-style.png") }
      ]
    });
    expect(result.durationFrames).toBe(1665);
    expect((await stat(videoPath)).size).toBeGreaterThan(100_000);
    const qa = await inspectRenderedVideo(videoPath);
    expect(qa).toMatchObject({ width: 1280, height: 720, fps: 30, videoCodec: "h264", audioCodec: "aac", audioPresent: true });
    expect(qa.durationSeconds).toBeCloseTo(55.5, 1);
    for (const still of result.stills) await expect(access(still)).resolves.toBeUndefined();
  }, 600_000);
});
