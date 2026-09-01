import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeCreate, executeIntake } from "@livingcourse/workflow";
import { FakeDocumentParsingProvider } from "./fake-document-provider.js";

const temporary: string[] = [];
afterEach(async () => Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("source update impact", () => {
  it("reparses only the changed source and preserves unrelated MaterialIR and candidate identities", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "livingcourse-source-update-"));
    temporary.push(root);
    const source = path.join(root, "materials");
    await mkdir(source);
    await Promise.all([
      writeFile(path.join(source, "a.pdf"), "Synthetic topic alpha revision one\n\nStable alpha guidance", "utf8"),
      writeFile(path.join(source, "b.pdf"), "Synthetic topic bravo", "utf8"),
      writeFile(path.join(source, "c.pdf"), "Synthetic topic charlie", "utf8")
    ]);
    const fake = new FakeDocumentParsingProvider();
    const options = { workspaceRoot: root, cacheRoot: path.join(root, "cache"), outputRoot: path.join(root, "review"), providers: [fake], parsedAt: "2026-09-01T00:00:00Z" } as const;

    const first = await executeCreate(source, options);
    const firstCalls = [...fake.parseCalls];
    fake.parseCalls = [];
    const second = await executeIntake(source, options);
    expect(firstCalls).toEqual(["a.pdf", "b.pdf", "c.pdf"]);
    expect(second.parserCalls).toBe(0);
    expect(second.materialRegenerations).toBe(0);
    expect(second.materialIrHashes).toEqual(first.intake.materialIrHashes);

    await writeFile(path.join(source, "a.pdf"), "Synthetic topic alpha revision two\n\nStable alpha guidance", "utf8");
    fake.parseCalls = [];
    const updated = await executeCreate(source, options);
    expect(fake.parseCalls).toEqual(["a.pdf"]);
    expect(updated.intake.materialIrHashes["b.pdf"]).toBe(first.intake.materialIrHashes["b.pdf"]);
    expect(updated.intake.materialIrHashes["c.pdf"]).toBe(first.intake.materialIrHashes["c.pdf"]);
    expect(updated.intake.materialIrHashes["a.pdf"]).not.toBe(first.intake.materialIrHashes["a.pdf"]);

    const unchangedMaterialIds = new Set(first.intake.materials.filter((material) => material.material.originalName !== "a.pdf").map((material) => material.material.id));
    const candidatesFor = (result: typeof first) => result.candidate.knowledgeCandidates.filter((candidate) => candidate.evidenceRefs.some((ref) => unchangedMaterialIds.has(ref.materialId))).map((candidate) => candidate.id).sort();
    expect(candidatesFor(updated)).toEqual(candidatesFor(first));
    const firstStableAlpha = first.candidate.knowledgeCandidates.find((candidate) => candidate.claim === "Stable alpha guidance");
    const updatedStableAlpha = updated.candidate.knowledgeCandidates.find((candidate) => candidate.claim === "Stable alpha guidance");
    expect(updatedStableAlpha?.id).toBe(firstStableAlpha?.id);
    expect(updated.candidate.knowledgeCandidates.some((candidate) => candidate.claim.includes("revision one"))).toBe(false);
    expect(updated.candidate.knowledgeCandidates.some((candidate) => candidate.claim.includes("revision two"))).toBe(true);
  });
});
