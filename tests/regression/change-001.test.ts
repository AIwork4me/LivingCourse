import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sha256, validateCourseSpec, type CourseSpec } from "@livingcourse/core";
import {
  applyCourseSpecChangeSet,
  buildDependencyGraph,
  ChangeSetError,
  planImpact,
  type ChangeSet
} from "@livingcourse/compiler";

const fixtureRoot = fileURLToPath(new URL("../fixtures/golden-v0.1", import.meta.url));
const load = async <T>(name: string): Promise<T> => JSON.parse(await readFile(path.join(fixtureRoot, name), "utf8")) as T;

const beforeChange = (current: CourseSpec): CourseSpec => {
  const old = structuredClone(current);
  const item = old.slides[1]?.knowledge.items[2];
  if (!item) throw new Error("Golden fixture is missing the Change-001 target.");
  item.text = "护目镜";
  const narration = old.slides[1]?.narration;
  if (!narration) throw new Error("Golden fixture is missing Slide 2 narration.");
  narration.script = narration.script.replace("护目镜与防护面罩", "护目镜");
  return old;
};

describe("M3 Change-001 smallest patch", () => {
  it("verifies expected old value, applies one leaf patch, and validates the result", async () => {
    const current = await load<CourseSpec>("course-spec.json");
    const change = await load<ChangeSet>("change-001.json");
    const old = beforeChange(current);
    const patched = applyCourseSpecChangeSet(old, change);
    expect(patched.slides[1]?.knowledge.items[2]?.text).toBe("护目镜与防护面罩");
    expect(validateCourseSpec(patched).valid).toBe(true);
    expect(() => applyCourseSpecChangeSet(patched, change)).toThrow(ChangeSetError);
    try {
      applyCourseSpecChangeSet(patched, change);
    } catch (error) {
      expect((error as ChangeSetError).code).toBe("LC-CHANGE-001");
    }
  });

  it("affects only the Slide 2 dependency subtree and regenerates no unrelated artifact", async () => {
    const current = await load<CourseSpec>("course-spec.json");
    const old = beforeChange(current);
    const change = await load<ChangeSet>("change-001.json");
    const graph = buildDependencyGraph(old);
    const impact = planImpact(old, current, change, graph);
    expect(impact.changedNodes.map((node) => node.id)).toEqual(["knowledge:slide-02-step-process:slide-02-item-goggles"]);
    expect(impact.affectedNodes.filter((node) => node.slideId !== null).every((node) => node.slideId === "slide-02-step-process")).toBe(true);
    expect(impact.affectedNodes.some((node) => node.slideId === "slide-01-hero" || node.slideId === "slide-03-safety-focus")).toBe(false);
    expect(impact.buildPlan.regenerate.map((item) => item.id).sort()).toEqual([
      "audio:slide-02-step-process",
      "visual-asset:slide-02-step-process:goggles-face-shield"
    ]);
    expect(impact.buildPlan.aiCalls).toEqual({ llm: 0, image: 1, tts: 1 });
    expect(impact.unnecessaryRegeneration).toBe(0);
    expect(impact.unchangedNodes.map((node) => node.id)).toEqual(expect.arrayContaining(["renderer:ppt", "renderer:video", "vocabulary:core"]));
  });

  it("preserves Slide 1 and Slide 3 content hashes", async () => {
    const current = await load<CourseSpec>("course-spec.json");
    const old = beforeChange(current);
    expect(sha256(old.slides[0])).toBe(sha256(current.slides[0]));
    expect(sha256(old.slides[2])).toBe(sha256(current.slides[2]));
    expect(sha256(old.slides[1])).not.toBe(sha256(current.slides[1]));
  });
});
