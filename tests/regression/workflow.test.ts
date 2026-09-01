import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runAiOutputFirewall, withRetry, type ProviderErrorLike } from "@livingcourse/generation";
import { ApprovedReferenceProvider } from "@livingcourse/providers";
import { validateCourseSpec, type CourseSpec } from "@livingcourse/core";
import {
  ArtifactRegistry,
  executeBuild,
  planBuild,
  scanPublicPackage,
  validateProductionRelease,
  WorkflowError,
  type WorkflowRenderers
} from "@livingcourse/workflow";

const fixtureRoot = fileURLToPath(new URL("../fixtures/golden-v0.1", import.meta.url));
const coursePath = path.join(fixtureRoot, "course-spec.json");
const temporaryRoots: string[] = [];

const temporary = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "livingcourse-workflow-test-"));
  temporaryRoots.push(root);
  return root;
};

afterEach(async () => {
  while (temporaryRoots.length) {
    const root = temporaryRoots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

const fakeRenderers = (counts: { ppt: number; video: number }, failVideoOnce = false): WorkflowRenderers => ({
  renderPpt: async (_plan, outputPath) => {
    counts.ppt += 1;
    await writeFile(outputPath, "deterministic-ppt", "utf8");
  },
  renderVideo: async (_plan, outputPath) => {
    counts.video += 1;
    if (failVideoOnce && counts.video === 1) throw new Error("simulated video failure");
    await writeFile(outputPath, "deterministic-video", "utf8");
  }
});

describe("M4 one-pass workflow", () => {
  it("uses the AI output firewall without repairing business facts", () => {
    const raw = "```json\n{“ppe”:“wrong-value”,}\n```";
    const result = runAiOutputFirewall<{ ppe: string }>(raw, {
      normalize: (value) => ({ ppe: value.ppe.trim() }),
      validateSchema: (value) => {
        const candidate = value as { ppe?: unknown };
        return typeof candidate.ppe === "string" ? { valid: true, value: { ppe: candidate.ppe }, errors: [] } : { valid: false, errors: ["ppe must be a string"] };
      },
      validateBusiness: (value) => value.ppe === "approved-value" ? [] : ["PPE fact is not grounded"]
    });
    expect(result.repairedSyntax).toBe(true);
    expect(result.accepted).toBe(false);
    expect(result.value).toBeNull();
    expect(result.issues[0]?.stage).toBe("business");
  });

  it("retries only retryable provider failures with a finite budget", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("busy"), { status: 429 }) as ProviderErrorLike;
      return "ok";
    }, { maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 2, jitterRatio: 0 }, { sleep: async () => undefined, random: () => 0.5 });
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
    await expect(withRetry(async () => { throw Object.assign(new Error("unauthorized"), { status: 401 }) as ProviderErrorLike; }, undefined, { sleep: async () => undefined })).rejects.toThrow("unauthorized");
  });

  it("keeps VoiceProfile separate from provider voice IDs", () => {
    const provider = new ApprovedReferenceProvider({ findByFingerprint: () => null }, { "manufacturing-training-default": "provider-internal-voice-17" });
    expect(provider.resolveVoiceId("manufacturing-training-default")).toBe("provider-internal-voice-17");
    expect(() => provider.resolveVoiceId("unknown-profile")).toThrow(/LC-PROVIDER-002/);
  });

  it("reuses all approved artifacts and performs zero provider calls on an identical second build", async () => {
    const workspaceRoot = await temporary();
    const outputRoot = path.join(workspaceRoot, "out");
    const counts = { ppt: 0, video: 0 };
    const renderers = fakeRenderers(counts);
    const firstPlan = await planBuild(coursePath, { workspaceRoot, outputRoot });
    expect(firstPlan.buildPlan.aiCalls).toEqual({ llm: 0, image: 0, tts: 0 });
    const first = await executeBuild(coursePath, { workspaceRoot, outputRoot, renderers });
    expect(first.status).toBe("complete");
    expect(first.reused).toHaveLength(10);
    expect(first.regenerated).toHaveLength(0);
    expect(counts).toEqual({ ppt: 1, video: 1 });
    expect(first.reviewPackage.gates).toHaveLength(5);
    expect(first.reviewPackage.gates.every((gate) => gate.actions.join(",") === "approve,reject,comment")).toBe(true);
    expect(first.qa).toBeNull();
    const secondPlan = await planBuild(coursePath, { workspaceRoot, outputRoot });
    expect(secondPlan.cacheHit).toBe(true);
    expect(secondPlan.buildPlan.regenerate).toHaveLength(0);
    const second = await executeBuild(coursePath, { workspaceRoot, outputRoot, renderers });
    expect(second.aiCalls).toEqual({ llm: 0, image: 0, tts: 0 });
    expect(second.rebuilt).toHaveLength(0);
    expect(counts).toEqual({ ppt: 1, video: 1 });
    expect(second.reviewPackage.buildSummary.regenerate).toBe(0);
    const registry = new ArtifactRegistry(path.join(workspaceRoot, ".livingcourse"));
    await registry.load();
    expect(registry.all().filter((artifact) => artifact.kind === "visual" || artifact.kind === "audio")).toHaveLength(10);
    expect(registry.all().filter((artifact) => artifact.kind === "pptx" || artifact.kind === "video")).toHaveLength(2);
  });

  it("resumes after a failed node without rebuilding completed predecessors", async () => {
    const workspaceRoot = await temporary();
    const outputRoot = path.join(workspaceRoot, "out");
    const counts = { ppt: 0, video: 0 };
    const renderers = fakeRenderers(counts, true);
    await expect(executeBuild(coursePath, { workspaceRoot, outputRoot, renderers })).rejects.toBeInstanceOf(WorkflowError);
    const resumed = await executeBuild(coursePath, { workspaceRoot, outputRoot, renderers });
    expect(resumed.resumed).toBe(true);
    expect(counts).toEqual({ ppt: 1, video: 2 });
  });

  it("hard-blocks Golden production release and fails a real secret scan", async () => {
    const course = JSON.parse(await readFile(coursePath, "utf8")) as CourseSpec;
    expect(validateCourseSpec(course).valid).toBe(true);
    const release = validateProductionRelease(course, { passed: true, scannedFiles: 1, findings: [] });
    expect(release.valid).toBe(false);
    expect(release.errors.some((error) => error.code === "LC-RELEASE-001")).toBe(true);
    const root = await temporary();
    await mkdir(path.join(root, "public"), { recursive: true });
    const simulatedSecret = ["Authorization:", "Bearer", "abcdefghijklmnopqrstuvwxyz123456"].join(" ");
    await writeFile(path.join(root, "public", "bad.txt"), simulatedSecret, "utf8");
    const simulatedCustomerRecord = ["customer", "_id", "=", "PRIVATE938492"].join("");
    await writeFile(path.join(root, "public", "customer.txt"), simulatedCustomerRecord, "utf8");
    const security = await scanPublicPackage(root);
    expect(security.passed).toBe(false);
    expect(security.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "LC-SECURITY-001", pattern: "bearer-token" }),
      expect.objectContaining({ code: "LC-SECURITY-001", pattern: "private-customer-record" })
    ]));
  });
});
