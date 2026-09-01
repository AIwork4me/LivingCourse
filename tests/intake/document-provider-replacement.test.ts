import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeCreate } from "@livingcourse/workflow";
import { FakeDocumentParsingProvider } from "./fake-document-provider.js";

const temporary: string[] = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("document provider replacement", () => {
  it("runs intake, knowledge, grounding, and CourseSpecCandidate unchanged with a fake provider", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "livingcourse-provider-replacement-"));
    temporary.push(root);
    const source = path.join(root, "materials");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(source));
    await writeFile(path.join(source, "synthetic.pdf"), "Synthetic training pressure setting = B", "utf8");
    const fake = new FakeDocumentParsingProvider();
    const result = await executeCreate(source, { workspaceRoot: root, cacheRoot: path.join(root, "cache"), outputRoot: path.join(root, "review"), providers: [fake], parsedAt: "2026-09-01T00:00:00Z", metadata: { "synthetic.pdf": { sourceClass: "controlled_internal", authority: "Fixture owner", version: "1", effectiveDate: "2026-09-01" } } });

    expect(fake.parseCalls).toEqual(["synthetic.pdf"]);
    expect(result.intake.materials[0]?.provenance.provider).toBe("fake-document-parser");
    expect(result.candidate.knowledgeCandidates.length).toBeGreaterThan(0);
    expect(result.candidate.reviewStatus).toBe("pending");
    expect(result.manualPromptCount).toBe(0);
  });
});
