import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256, type CourseSpec } from "@livingcourse/core";
import { compileCourse, type CompilerContext } from "@livingcourse/compiler";

const fixturePath = fileURLToPath(new URL("../fixtures/golden-v0.1/course-spec.json", import.meta.url));
const loadFixture = async (): Promise<CourseSpec> => JSON.parse(await readFile(fixturePath, "utf8")) as CourseSpec;

const context: Partial<CompilerContext> = {
  assetProbe: {
    probe: (assetRef) => ({ exists: true, approved: true, sha256: sha256(assetRef) })
  },
  timingProbe: {
    durationMs: () => null
  },
  reviewDecisionSource: {
    decisions: () => []
  }
};

describe("M1 deterministic compiler", () => {
  it("compiles the same CourseSpec to byte-identical canonical IR", async () => {
    const fixture = await loadFixture();
    const first = compileCourse(fixture, context);
    const second = compileCourse(fixture, context);
    expect(canonicalJson(second.presentationPlan)).toBe(canonicalJson(first.presentationPlan));
    expect(canonicalJson(second.videoPlan)).toBe(canonicalJson(first.videoPlan));
    expect(canonicalJson(second.buildPlan)).toBe(canonicalJson(first.buildPlan));
  });

  it("produces all three explicit IRs without provider data", async () => {
    const output = compileCourse(await loadFixture(), context);
    expect(output.presentationPlan.slides).toHaveLength(3);
    expect(output.videoPlan.slides).toHaveLength(3);
    expect(output.videoPlan.durationFrames).toBe(1665);
    expect(output.videoPlan.durationMs).toBe(55500);
    expect(output.buildPlan.reuse).toHaveLength(10);
    expect(output.buildPlan.regenerate).toHaveLength(0);
    expect(output.buildPlan.aiCalls).toEqual({ llm: 0, image: 0, tts: 0 });
    expect(JSON.stringify(output.videoPlan).toLowerCase()).not.toMatch(/minimax|speech-2\.8|male-qn|openai/);
  });

  it("makes layout, timing, caption and motion decisions before renderers", async () => {
    const output = compileCourse(await loadFixture(), context);
    const slide2 = output.presentationPlan.slides[1];
    const video2 = output.videoPlan.slides[1];
    expect(slide2?.elements.some((element) => element.text === "护目镜与防护面罩")).toBe(true);
    expect(video2?.globalStartMs).toBe(12633);
    expect(video2?.captions.every((caption) => caption.maxLines === 2)).toBe(true);
    expect(video2?.motions.find((motion) => motion.id === "slide-02-motion-goggles")?.atMs).toBeGreaterThan(0);
  });
});
