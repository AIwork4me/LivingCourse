import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { KnowledgeCandidateDraft } from "@livingcourse/generation";
import { executeSemanticAuthoring, planSemanticAuthoring, type IntakePlanResult } from "@livingcourse/workflow";
import { FakeCourseDesignProvider, FakeKnowledgeUnderstandingProvider, makeMaterial } from "./semantic-test-helpers.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const cacheRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "livingcourse-semantic-"));
  temporaryRoots.push(root);
  return root;
};

const firstBlockOnly = (materials: readonly ReturnType<typeof makeMaterial>[]): KnowledgeCandidateDraft[] => materials.map((material) => {
  const block = material.units[0]!.blocks[0]!;
  return { claim: block.content, category: "safety", sourceHints: [{ materialId: material.material.id, blockId: block.id }], confidence: 0.9 };
});

const options = (root: string, knowledge: FakeKnowledgeUnderstandingProvider, courseDesign: FakeCourseDesignProvider) => ({
  cacheRoot: root,
  title: "Synthetic induction",
  audience: "New hires",
  purpose: "Practice safe entry",
  locale: "en",
  maxSlides: 20,
  knowledge,
  courseDesign
});

describe("semantic incremental cache", () => {
  it("reuses unchanged materials and invalidates only the changed material", async () => {
    const root = await cacheRoot();
    const a1 = makeMaterial({ id: "a", name: "a.md", blocks: [{ content: "Wear splash goggles." }] });
    const b1 = makeMaterial({ id: "b", name: "b.md", blocks: [{ content: "Wear safety shoes." }] });
    const knowledge = new FakeKnowledgeUnderstandingProvider(firstBlockOnly);
    const course = new FakeCourseDesignProvider();

    const first = await executeSemanticAuthoring([a1, b1], { "a.md": "parse-a1", "b.md": "parse-b1" }, options(root, knowledge, course));
    expect(first.calls).toEqual({ knowledgeUnderstanding: 2, courseDesign: 1, total: 3 });

    const second = await executeSemanticAuthoring([a1, b1], { "a.md": "parse-a1", "b.md": "parse-b1" }, options(root, knowledge, course));
    expect(second.calls).toEqual({ knowledgeUnderstanding: 0, courseDesign: 0, total: 0 });
    expect(second.reusedMaterials).toEqual(["a.md", "b.md"]);

    const a2 = makeMaterial({ id: "a", name: "a.md", blocks: [{ content: "Wear splash goggles." }, { content: "Revision history: metadata-only change." }] });
    const third = await executeSemanticAuthoring([a2, b1], { "a.md": "parse-a2", "b.md": "parse-b1" }, options(root, knowledge, course));
    expect(third.calls).toEqual({ knowledgeUnderstanding: 1, courseDesign: 0, total: 1 });
    expect(third.changedMaterials).toEqual(["a.md"]);
    expect(third.reusedMaterials).toEqual(["b.md"]);
    expect(course.calls).toHaveLength(1);
  });

  it("invalidates provider/prompt identity independently from course-design identity", async () => {
    const root = await cacheRoot();
    const material = makeMaterial({ id: "a", name: "a.md", blocks: [{ content: "Wear splash goggles." }] });
    const v1 = new FakeKnowledgeUnderstandingProvider(firstBlockOnly);
    const courseV1 = new FakeCourseDesignProvider();
    await executeSemanticAuthoring([material], { "a.md": "parse-a1" }, options(root, v1, courseV1));

    const promptV2 = new FakeKnowledgeUnderstandingProvider(firstBlockOnly, { promptTemplateVersion: "knowledge-test-v2", promptTemplateHash: "b".repeat(64) });
    const knowledgeChanged = await executeSemanticAuthoring([material], { "a.md": "parse-a1" }, options(root, promptV2, courseV1));
    expect(knowledgeChanged.calls).toEqual({ knowledgeUnderstanding: 1, courseDesign: 0, total: 1 });

    const courseV2 = new FakeCourseDesignProvider(undefined, { model: "fake-course-design-2" });
    const courseChanged = await executeSemanticAuthoring([material], { "a.md": "parse-a1" }, options(root, promptV2, courseV2));
    expect(courseChanged.calls).toEqual({ knowledgeUnderstanding: 0, courseDesign: 1, total: 1 });
  });

  it("reports predicted capability calls in dry-run planning", async () => {
    const root = await cacheRoot();
    const material = makeMaterial({ id: "a", name: "a.md", blocks: [{ content: "Wear splash goggles." }] });
    const knowledge = new FakeKnowledgeUnderstandingProvider(firstBlockOnly);
    const course = new FakeCourseDesignProvider();
    await executeSemanticAuthoring([material], { "a.md": "parse-a1" }, options(root, knowledge, course));
    const intake: IntakePlanResult = {
      folder: "fixture",
      files: [{
        input: { materialId: "a", path: "a.md", originalName: "a.md", mediaType: "text/markdown", sha256: material.material.sha256, sizeBytes: 1, authority: { sourceClass: "controlled_internal", authority: "Fixture", version: "1", effectiveDate: "2026-09-01" } },
        parser: "fixture",
        providerVersion: "1",
        profile: "balanced",
        potentialEscalation: "none",
        processingMode: "local",
        endpointClassification: "local",
        health: "available",
        cacheFingerprint: "parse-a1",
        action: "REUSE",
        blocker: null,
        confidentialityWarning: null
      }],
      parserCalls: 0,
      aiCalls: 0,
      blockers: [],
      cacheRoot: "unused"
    };

    await expect(planSemanticAuthoring(intake, options(root, knowledge, course))).resolves.toMatchObject({
      changedMaterials: [],
      reusedMaterials: ["a.md"],
      knowledgeUnderstandingCalls: 0,
      courseDesignCalls: 0,
      totalAiCalls: 0
    });
  });
});
