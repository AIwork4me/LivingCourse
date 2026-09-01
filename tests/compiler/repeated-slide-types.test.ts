import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256, type CourseSpec, type SlideSpec } from "@livingcourse/core";
import { compileCourse, presentationElementId, type CompilerContext } from "@livingcourse/compiler";

const fixturePath = fileURLToPath(new URL("../fixtures/golden-v0.1/course-spec.json", import.meta.url));

const context: Partial<CompilerContext> = {
  assetProbe: { probe: (assetRef) => ({ exists: true, approved: true, sha256: sha256(assetRef) }) },
  timingProbe: { durationMs: () => null },
  reviewDecisionSource: { decisions: () => [] }
};

const remapSlide = (source: SlideSpec, slideId: string, order: number): SlideSpec => {
  const slide = structuredClone(source);
  const requirementIds = new Map(slide.presentation.visualIntent.requirements.map((requirement, index) => [requirement.id, `${slideId}-requirement-${index + 1}`]));
  const itemIds = new Map(slide.knowledge.items.map((item, index) => [item.id, `${slideId}-item-${index + 1}`]));
  const remapTarget = (targetId: string): string => requirementIds.get(targetId) ?? itemIds.get(targetId) ?? targetId;
  slide.id = slideId;
  slide.order = order;
  for (const requirement of slide.presentation.visualIntent.requirements) requirement.id = requirementIds.get(requirement.id) ?? requirement.id;
  for (const item of slide.knowledge.items) {
    item.id = itemIds.get(item.id) ?? item.id;
    if (item.visualRequirementRef) item.visualRequirementRef = requirementIds.get(item.visualRequirementRef) ?? item.visualRequirementRef;
  }
  for (const [index, cue] of slide.narration.cues.entries()) {
    cue.id = `${slideId}-cue-${index + 1}`;
    cue.targetIds = cue.targetIds.map(remapTarget);
  }
  for (const [index, motion] of slide.presentation.motionIntent.entries()) {
    motion.id = `${slideId}-motion-${index + 1}`;
    motion.targetIds = motion.targetIds.map(remapTarget);
  }
  if (slide.grounding.anchor) slide.grounding.anchor.id = `${slideId}-anchor`;
  return slide;
};

describe("de-Goldenized repeated slide types", () => {
  it("compiles repeated layouts with stable slide-scoped element IDs", async () => {
    const golden = JSON.parse(await readFile(fixturePath, "utf8")) as CourseSpec;
    const [hero, step, focus] = golden.slides;
    if (!hero || !step || !focus) throw new Error("Golden fixture must provide the three existing slide types.");
    const course: CourseSpec = {
      ...structuredClone(golden),
      course: { ...golden.course, id: "repeated-slide-types" },
      slides: [
        remapSlide(hero, "orientation-hero", 1),
        remapSlide(step, "safety-preparation", 2),
        remapSlide(step, "quality-preparation", 3),
        remapSlide(focus, "abnormality-focus", 4),
        remapSlide(step, "entry-confirmation", 5)
      ]
    };

    const first = compileCourse(course, context);
    const second = compileCourse(course, context);
    expect(first.presentationPlan.slides.map((slide) => slide.slideId)).toEqual(course.slides.map((slide) => slide.id));
    expect(first.presentationPlan.slides.filter((slide) => slide.layout === "step_process")).toHaveLength(3);
    const elementIds = first.presentationPlan.slides.flatMap((slide) => slide.elements.map((element) => element.id));
    expect(new Set(elementIds).size).toBe(elementIds.length);
    for (const slide of first.presentationPlan.slides) {
      expect(slide.elements.some((element) => element.id === presentationElementId(slide.slideId, "role", "title"))).toBe(true);
    }
    expect(elementIds.some((id) => /^slide-0[123]-/u.test(id))).toBe(false);
    expect(canonicalJson(second.presentationPlan)).toBe(canonicalJson(first.presentationPlan));
    expect(canonicalJson(second.videoPlan)).toBe(canonicalJson(first.videoPlan));
    expect(first.videoPlan.slides).toHaveLength(5);
  });
});
