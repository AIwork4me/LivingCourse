import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sha256, type CourseSpec } from "@livingcourse/core";
import {
  applyCourseSpecChangeSet,
  buildDependencyGraph,
  ChangeSetError,
  createSemanticReplaceChangeSet,
  planImpact,
  resolveKnowledgeItemTextLocator,
  SemanticLocatorError
} from "@livingcourse/compiler";

const fixtureRoot = fileURLToPath(new URL("../fixtures/golden-v0.1", import.meta.url));

const loadCourse = async (): Promise<CourseSpec> =>
  JSON.parse(await readFile(path.join(fixtureRoot, "course-spec.json"), "utf8")) as CourseSpec;

const withStableSemanticIds = (course: CourseSpec): CourseSpec => {
  const next = structuredClone(course);
  const targetSlide = next.slides.find((slide) => slide.id === "slide-02-step-process");
  if (!targetSlide) throw new Error("Golden fixture is missing the target slide.");
  targetSlide.id = "safety-preparation";
  const targetItem = targetSlide.knowledge.items.find((item) => item.id === "slide-02-item-goggles");
  if (!targetItem) throw new Error("Golden fixture is missing the target knowledge item.");
  targetItem.id = "eye-face-protection";
  targetItem.text = "护目镜";
  for (const motion of targetSlide.presentation.motionIntent) {
    motion.targetIds = motion.targetIds.map((id) => id === "slide-02-item-goggles" ? targetItem.id : id);
  }
  for (const cue of targetSlide.narration.cues) {
    cue.targetIds = cue.targetIds.map((id) => id === "slide-02-item-goggles" ? targetItem.id : id);
  }
  const readingOrder = targetSlide.presentation.layout.readingOrder;
  if (readingOrder) {
    targetSlide.presentation.layout.readingOrder = readingOrder.map((id) => id === "slide-02-item-goggles" ? targetItem.id : id);
  }
  return next;
};

const reorderSerializedSlides = (course: CourseSpec): CourseSpec => {
  const next = structuredClone(course);
  const targetIndex = next.slides.findIndex((slide) => slide.id === "safety-preparation");
  const [target] = next.slides.splice(targetIndex, 1);
  if (!target) throw new Error("Course is missing the semantic target slide.");
  next.slides.unshift(target);
  return next;
};

describe("semantic patch after slide reorder", () => {
  it("resolves the current JSON Pointer from stable slide and item IDs", async () => {
    const initial = withStableSemanticIds(await loadCourse());
    const reordered = reorderSerializedSlides(initial);
    const locator = {
      slideId: "safety-preparation",
      section: "knowledge" as const,
      itemId: "eye-face-protection",
      field: "text" as const
    };

    expect(resolveKnowledgeItemTextLocator(initial, locator)).toBe("/slides/1/knowledge/items/2/text");
    expect(resolveKnowledgeItemTextLocator(reordered, locator)).toBe("/slides/0/knowledge/items/2/text");
  });

  it("applies only the semantic leaf and keeps dependency identity stable across reorder", async () => {
    const initial = withStableSemanticIds(await loadCourse());
    const reordered = reorderSerializedSlides(initial);
    const target = reordered.slides[0];
    if (!target) throw new Error("Course is missing the reordered target slide.");
    const nonTargetHashes = new Map(reordered.slides.slice(1).map((slide) => [slide.id, sha256(slide)]));
    const change = createSemanticReplaceChangeSet(reordered, {
      id: "semantic-eye-face-protection",
      locator: {
        slideId: "safety-preparation",
        section: "knowledge",
        itemId: "eye-face-protection",
        field: "text"
      },
      old: "护目镜",
      new: "护目镜与防护面罩",
      reason: "Add the approved face-protection requirement.",
      requestedBy: "regression-test",
      requestedAt: "2026-09-01T00:00:00.000Z"
    });

    const initialNode = buildDependencyGraph(initial).nodes.find((node) => node.id === "knowledge:safety-preparation:eye-face-protection");
    const reorderedGraph = buildDependencyGraph(reordered);
    const reorderedNode = reorderedGraph.nodes.find((node) => node.id === "knowledge:safety-preparation:eye-face-protection");
    expect(initialNode?.id).toBe(reorderedNode?.id);
    expect(initialNode?.path).toBe("/slides/1/knowledge/items/2/text");
    expect(reorderedNode?.path).toBe("/slides/0/knowledge/items/2/text");
    expect(change.operations).toEqual([{
      op: "replace",
      path: "/slides/0/knowledge/items/2/text",
      old: "护目镜",
      new: "护目镜与防护面罩"
    }]);

    const patched = applyCourseSpecChangeSet(reordered, change);
    expect(patched.slides[0]?.knowledge.items[2]?.text).toBe("护目镜与防护面罩");
    for (const slide of patched.slides.slice(1)) {
      expect(sha256(slide)).toBe(nonTargetHashes.get(slide.id));
    }

    const impact = planImpact(reordered, patched, change, reorderedGraph);
    expect(impact.changedNodes.map((node) => node.id)).toEqual(["knowledge:safety-preparation:eye-face-protection"]);
    expect(impact.affectedNodes.filter((node) => node.slideId !== null).every((node) => node.slideId === "safety-preparation")).toBe(true);
    expect(impact.unnecessaryRegeneration).toBe(0);
    expect(() => applyCourseSpecChangeSet(patched, change)).toThrow(ChangeSetError);
  });

  it("fails explicitly when stable IDs cannot be resolved", async () => {
    const course = await loadCourse();
    expect(() => resolveKnowledgeItemTextLocator(course, {
      slideId: "missing-slide",
      section: "knowledge",
      itemId: "missing-item",
      field: "text"
    })).toThrow(SemanticLocatorError);
  });
});
