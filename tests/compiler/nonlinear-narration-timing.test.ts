import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256, type CourseSpec } from "@livingcourse/core";
import { compileCourse, normalizeNarrationTiming, type CompilerContext, type NarrationTimingProbeResult } from "@livingcourse/compiler";

const fixturePath = fileURLToPath(new URL("../fixtures/golden-v0.1/course-spec.json", import.meta.url));
const script = "进入车间前，请检查工作服、安全鞋和护目镜。";

const alignedTiming: NarrationTimingProbeResult = {
  audioDurationMs: 7000,
  method: "provider_aligned",
  sentenceSegments: [{ text: script, startMs: 0, endMs: 7000 }],
  characterSegments: [
    { text: "进入车间前", startMs: 0, endMs: 900 },
    { text: "请检查", startMs: 1500, endMs: 1900 },
    { text: "工作服", startMs: 2400, endMs: 2700 },
    { text: "、", startMs: 2700, endMs: 2800 },
    { text: "安全鞋", startMs: 3900, endMs: 4300 },
    { text: "和", startMs: 5000, endMs: 5100 },
    { text: "护目镜", startMs: 6200, endMs: 7000 }
  ]
};

const loadCourse = async (): Promise<CourseSpec> => {
  const golden = JSON.parse(await readFile(fixturePath, "utf8")) as CourseSpec;
  const step = structuredClone(golden.slides[1]);
  if (!step) throw new Error("Golden fixture must contain step_process.");
  step.order = 1;
  step.narration.script = script;
  step.narration.approvedDurationMs = 7000;
  step.narration.cues = [{ id: "eye-protection-cue", phrase: "护目镜", targetIds: ["slide-02-item-goggles"] }];
  step.presentation.motionIntent = [{ id: "eye-protection-motion", order: 1, targetIds: ["slide-02-item-goggles"], action: "synchronized_reveal" }];
  return { ...golden, course: { ...golden.course, id: "nonlinear-timing" }, slides: [step] };
};

const context = (timing: NarrationTimingProbeResult | null): Partial<CompilerContext> => ({
  assetProbe: { probe: (assetRef) => ({ exists: true, approved: true, sha256: sha256(assetRef) }) },
  timingProbe: { durationMs: () => 7000, narrationTiming: () => timing },
  reviewDecisionSource: { decisions: () => [] }
});

describe("provider-neutral nonlinear narration timing", () => {
  it("drives cue, caption and synchronized motion from supplied nonlinear timing", async () => {
    const course = await loadCourse();
    const first = compileCourse(course, context(alignedTiming));
    const second = compileCourse(course, context(alignedTiming));
    const slide = first.videoPlan.slides[0];
    expect(slide?.timingQuality).toBe("aligned");
    expect(slide?.requiresHumanAvSyncReview).toBe(false);
    expect(slide?.cues[0]).toMatchObject({ atMs: 6550, timingQuality: "aligned" });
    expect(slide?.motions[0]?.atMs).toBe(6550);
    expect(slide?.captions.map((caption) => [caption.text, caption.startMs, caption.endMs])).toEqual([
      ["进入车间前，", 350, 1250],
      ["请检查工作服、", 1850, 3050],
      ["安全鞋和护目镜。", 4250, 7350]
    ]);
    const oldLinearCue = 350 + Math.round(7000 * script.indexOf("护目镜") / script.length);
    expect(slide?.cues[0]?.atMs).not.toBe(oldLinearCue);
    expect(canonicalJson(second.videoPlan)).toBe(canonicalJson(first.videoPlan));
  });

  it("preserves raw independent timing and normalizes it to approved audio duration", () => {
    const independent: NarrationTimingProbeResult = {
      audioDurationMs: 3500,
      method: "independent_synthesis",
      sentenceSegments: [{ text: script, startMs: 0, endMs: 3500 }]
    };
    const result = normalizeNarrationTiming(script, 7000, independent);
    expect(result.timing).toMatchObject({
      audioDurationMs: 7000,
      timingSourceDurationMs: 3500,
      scaleFactor: 2,
      method: "duration_normalized_provider_timing",
      quality: "normalized",
      requiresHumanAvSyncReview: false
    });
    expect(result.timing.rawTiming?.sentenceSegments[0]?.endMs).toBe(3500);
    expect(result.timing.sentenceSegments[0]?.endMs).toBe(7000);
  });

  it("keeps Author Review buildable without timing but marks estimated AV review", async () => {
    const output = compileCourse(await loadCourse(), context(null));
    const slide = output.videoPlan.slides[0];
    expect(slide?.narrationTiming.method).toBe("estimated_linear");
    expect(slide?.timingQuality).toBe("estimated");
    expect(slide?.requiresHumanAvSyncReview).toBe(true);
    expect(slide?.captions.every((caption) => caption.timingQuality === "estimated")).toBe(true);
    expect(output.diagnostics.some((diagnostic) => diagnostic.code === "LC-AVSYNC-001")).toBe(true);
  });

  it("does not silently bind an ambiguous repeated phrase", async () => {
    const course = await loadCourse();
    const slide = course.slides[0];
    if (!slide) throw new Error("Test course must contain a slide.");
    slide.narration.script = "请检查护目镜。完成后再次检查护目镜。";
    slide.narration.cues = [{ id: "ambiguous", phrase: "护目镜", targetIds: ["slide-02-item-goggles"] }];
    const ambiguous = compileCourse(course, context(null));
    expect(ambiguous.videoPlan.slides[0]?.cues).toHaveLength(0);
    expect(ambiguous.diagnostics.some((diagnostic) => diagnostic.code === "LC-CUE-002")).toBe(true);
    slide.narration.cues[0] = { ...slide.narration.cues[0]!, occurrence: 2 };
    const resolved = compileCourse(course, context(null));
    expect(resolved.videoPlan.slides[0]?.cues).toHaveLength(1);
    expect(resolved.videoPlan.slides[0]?.cues[0]?.timingQuality).toBe("estimated");
  });
});
