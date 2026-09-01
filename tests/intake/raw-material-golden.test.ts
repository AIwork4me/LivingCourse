import path from "node:path";
import { describe, expect, it } from "vitest";
import { DirectTextProvider, discoverDocumentInputs } from "@livingcourse/intake";
import { executeCreate } from "@livingcourse/workflow";
import { FakeDocumentParsingProvider } from "./fake-document-provider.js";

const fixture = path.resolve("tests/fixtures/raw-manufacturing-course");
const metadata = {
  "training-old.pptx": { sourceClass: "reference" as const, authority: "Synthetic training archive", version: "1.0", effectiveDate: "2025-01-01" },
  "sop.pdf": { sourceClass: "controlled_internal" as const, authority: "Fixture Safety Owner", version: "2.0", effectiveDate: "2026-09-01" },
  "employee-handbook.docx": { sourceClass: "reference" as const, authority: "Synthetic HR Training", version: "1.0", effectiveDate: "2026-09-01" },
  "equipment-photo.jpg": { sourceClass: "synthetic" as const, authority: "LivingCourse fixture generator", version: "1.0", effectiveDate: "2026-09-01" },
  "trainer-notes.md": { sourceClass: "reference" as const, authority: "Synthetic trainer", version: "1.0", effectiveDate: "2026-09-01" }
};

describe("raw manufacturing course fixture", () => {
  it("discovers five verified formats and stops at a conflict-aware, grounded human-review candidate", async () => {
    const discovered = await discoverDocumentInputs(fixture, metadata);
    expect(discovered.map((input) => input.originalName)).toEqual(["employee-handbook.docx", "equipment-photo.jpg", "sop.pdf", "trainer-notes.md", "training-old.pptx"]);
    const fake = new FakeDocumentParsingProvider();
    const result = await executeCreate(fixture, {
      workspaceRoot: path.resolve("."),
      cacheRoot: path.resolve(".livingcourse/test-raw-golden-cache"),
      outputRoot: path.resolve(".livingcourse/test-raw-golden-review"),
      providers: [new DirectTextProvider(), fake],
      parsedAt: "2026-09-01T00:00:00Z",
      metadata,
      title: "Synthetic Training Machine Entry",
      audience: "Synthetic manufacturing new hires",
      purpose: "Review safe entry and escalation knowledge"
    });

    expect(result.intake.materials).toHaveLength(5);
    expect(result.candidate.conflicts).toHaveLength(1);
    expect(result.candidate.conflicts[0]).toMatchObject({ authorityStatus: "clear_hierarchy" });
    expect(result.candidate.groundingGaps.length).toBeGreaterThan(0);
    expect(result.candidate.metrics.evidenceCoverage).toBe(1);
    expect(result.candidate.reviewStatus).toBe("pending");
    expect(result.candidate.draft.governance.lifecycleState).toBe("candidate");
    expect(result.manualPromptCount).toBe(0);
    expect(result.manualJsonEditCount).toBe(0);
  });
});
