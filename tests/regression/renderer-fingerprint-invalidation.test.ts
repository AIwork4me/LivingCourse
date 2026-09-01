import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { sha256 } from "@livingcourse/core";
import { executeBuild, planBuild, type WorkflowRenderers } from "@livingcourse/workflow";
import type { BuildFingerprints } from "@livingcourse/compiler";

const fixturePath = fileURLToPath(new URL("../fixtures/golden-v0.1/course-spec.json", import.meta.url));
const temporaryRoots: string[] = [];

const temporary = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "livingcourse-fingerprint-test-"));
  temporaryRoots.push(root);
  return root;
};

afterEach(async () => {
  while (temporaryRoots.length) {
    const root = temporaryRoots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

const fingerprints = (presentation: string, video: string): BuildFingerprints => ({
  presentationRendererFingerprint: sha256(presentation),
  videoRendererFingerprint: sha256(video),
  vocabularyFingerprint: sha256("vocabulary"),
  profileFingerprint: sha256("profile"),
  compilerFingerprint: sha256("compiler")
});

describe("renderer content fingerprint invalidation", () => {
  it("rebuilds only the deterministic output owned by the changed renderer", async () => {
    const workspaceRoot = await temporary();
    const outputRoot = path.join(workspaceRoot, "out");
    const calls = { ppt: 0, video: 0 };
    const renderers: WorkflowRenderers = {
      renderPpt: async (_plan, outputPath) => { calls.ppt += 1; await writeFile(outputPath, `ppt-${calls.ppt}`, "utf8"); },
      renderVideo: async (_plan, outputPath) => { calls.video += 1; await writeFile(outputPath, `video-${calls.video}`, "utf8"); }
    };

    const baseline = fingerprints("presentation-A", "video-B");
    const first = await executeBuild(fixturePath, { workspaceRoot, outputRoot, renderers, buildFingerprints: baseline });
    expect(first.rebuilt.sort()).toEqual(["author-review-mp4", "course-pptx"]);
    expect(calls).toEqual({ ppt: 1, video: 1 });

    const presentationChanged = fingerprints("presentation-A2", "video-B");
    const presentationPlan = await planBuild(fixturePath, { workspaceRoot, outputRoot, buildFingerprints: presentationChanged });
    expect(presentationPlan.buildPlan.rebuild.some((entry) => entry.id === "course-pptx")).toBe(true);
    expect(presentationPlan.buildPlan.reuse.some((entry) => entry.id === "author-review-mp4")).toBe(true);
    expect(presentationPlan.buildPlan.regenerate).toHaveLength(0);
    const second = await executeBuild(fixturePath, { workspaceRoot, outputRoot, renderers, buildFingerprints: presentationChanged });
    expect(second.rebuilt).toEqual(["course-pptx"]);
    expect(second.aiCalls).toEqual({ llm: 0, image: 0, tts: 0 });
    expect(calls).toEqual({ ppt: 2, video: 1 });

    const videoChanged = fingerprints("presentation-A2", "video-B2");
    const videoPlan = await planBuild(fixturePath, { workspaceRoot, outputRoot, buildFingerprints: videoChanged });
    expect(videoPlan.buildPlan.reuse.some((entry) => entry.id === "course-pptx")).toBe(true);
    expect(videoPlan.buildPlan.rebuild.some((entry) => entry.id === "author-review-mp4")).toBe(true);
    expect(videoPlan.buildPlan.regenerate).toHaveLength(0);
    const third = await executeBuild(fixturePath, { workspaceRoot, outputRoot, renderers, buildFingerprints: videoChanged });
    expect(third.rebuilt).toEqual(["author-review-mp4"]);
    expect(third.aiCalls).toEqual({ llm: 0, image: 0, tts: 0 });
    expect(calls).toEqual({ ppt: 2, video: 2 });
  });
});
