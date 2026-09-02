import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DirectTextProvider,
  discoverDocumentInputs
} from "@livingcourse/intake";
import { executeCreate } from "@livingcourse/workflow";
import { SemanticFixtureParsingProvider, semanticManufacturingFixture } from "../support/semantic-manufacturing-fixture.js";

const fixture = path.resolve(semanticManufacturingFixture.folder);
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("complex semantic manufacturing fixture", () => {
  it("produces six evidence-linked slides and preserves human authority and grounding blockers", async () => {
    const discovered = await discoverDocumentInputs(fixture, semanticManufacturingFixture.metadata);
    expect(discovered.map((input) => input.originalName)).toEqual(["approved-sop.pdf", "archived-training.pptx", "employee-handbook.docx", "equipment-photo.jpg", "trainer-notes.md"]);
    const root = await mkdtemp(path.join(tmpdir(), "livingcourse-semantic-course-"));
    temporaryRoots.push(root);
    const parser = new SemanticFixtureParsingProvider();
    const result = await executeCreate(fixture, {
      workspaceRoot: root,
      cacheRoot: path.join(root, "intake-cache"),
      semanticCacheRoot: path.join(root, "semantic-cache"),
      outputRoot: path.join(root, "review"),
      providers: [new DirectTextProvider(), parser],
      parsedAt: "2026-09-01T00:00:00Z",
      metadata: semanticManufacturingFixture.metadata,
      title: "Synthetic Press Entry",
      audience: "Manufacturing new hires",
      purpose: "Understand supervised entry, safety, quality, and escalation requirements",
      locale: "en",
      maxSlides: 6
    });

    expect(result.candidate.draft.slides).toHaveLength(6);
    expect(result.candidate.knowledgeCandidates.length).toBeGreaterThanOrEqual(12);
    expect(result.candidate.conflicts).toHaveLength(1);
    expect(result.candidate.conflicts[0]).toMatchObject({ authorityStatus: "clear_hierarchy" });
    expect(result.candidate.groundingGaps.length).toBeGreaterThan(0);
    expect(result.candidate.authorityGaps).toHaveLength(1);
    expect(result.candidate.metrics).toMatchObject({ evidenceCoverage: 1, relevantKnowledgePrecision: 1, unsupportedFactualClaims: 0, numericFidelityErrors: 0, negationFidelityErrors: 0, irrelevantKnowledgeIncluded: 0, duplicateKnowledgeCandidates: 0, manualPromptCount: 0, manualJsonEditCount: 0 });
    expect(result.candidate.draft.slides.every((slide) => slide.knowledge.items.every((item) => result.candidate.knowledgeCandidates.some((candidate) => candidate.id === item.id && candidate.claim === item.text)))).toBe(true);

    const review = await readFile(result.reviewPackagePath, "utf8");
    expect(review).toContain("Which source should control this topic?");
    expect(review).toContain("[ ] Current approved SOP");
    expect(review).toContain("This does NOT block Author Review.");
    expect(review).toContain("This DOES block Production Release.");
    expect(review).toMatch(/approved-sop\.pdf — Page 1/u);
    expect(review).toContain("Semantic course understanding: NOT AVAILABLE");
    expect(review).toContain("Fallback: Literal deterministic extraction");
  });
});
