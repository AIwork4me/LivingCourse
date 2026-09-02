import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("create CLI semantic configuration", () => {
  it("automatically resolves configured semantic capabilities during a zero-call dry run", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "livingcourse-cli-semantic-"));
    temporaryRoots.push(root);
    const source = path.join(root, "source");
    await mkdir(source);
    await writeFile(path.join(source, "safe.md"), "Wear splash goggles.", "utf8");
    const result = spawnSync(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", "create", source, "--dry-run"], {
      cwd: path.resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        LIVINGCOURSE_SEMANTIC_PROVIDER: "openai-compatible",
        LIVINGCOURSE_SEMANTIC_BASE_URL: "https://semantic.invalid/v1",
        LIVINGCOURSE_SEMANTIC_MODEL: "fixture-model",
        LIVINGCOURSE_SEMANTIC_API_KEY: "fixture-secret-key"
      }
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(output.SEMANTIC_AUTHORING).toMatchObject({ status: "CONFIGURED", mode: "semantic_ai", provider: "openai-compatible", model: "fixture-model", processingMode: "remote", totalPredictedAiCalls: 2 });
    expect(output.KNOWLEDGE_UNDERSTANDING).toMatchObject({ status: "CONFIGURED", mode: "semantic_ai", provider: "openai-compatible", model: "fixture-model", processingMode: "remote", predictedAiCalls: 1 });
    expect(output.COURSE_DESIGN).toMatchObject({ status: "CONFIGURED", mode: "semantic_ai", provider: "openai-compatible", model: "fixture-model", processingMode: "remote", predictedAiCalls: 1 });
    expect(output.AI_CALL_PLAN).toEqual({ knowledgeUnderstanding: 1, courseDesign: 1, total: 2 });
    expect(output.callsMade).toEqual({ parser: 0, ai: 0, semanticAi: 0, tts: 0, image: 0 });
    expect(result.stdout).not.toContain("fixture-secret-key");
  });

  it("discloses literal deterministic fallback and all zero-call categories when unconfigured", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "livingcourse-cli-fallback-"));
    temporaryRoots.push(root);
    const source = path.join(root, "source");
    await mkdir(source);
    await writeFile(path.join(source, "safe.md"), "Wear splash goggles.", "utf8");
    const result = spawnSync(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", "create", source, "--dry-run"], {
      cwd: path.resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        LIVINGCOURSE_SEMANTIC_PROVIDER: "",
        LIVINGCOURSE_SEMANTIC_BASE_URL: "",
        LIVINGCOURSE_SEMANTIC_MODEL: "",
        LIVINGCOURSE_SEMANTIC_API_KEY: ""
      }
    });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(output.SEMANTIC_AUTHORING).toMatchObject({
      status: "NOT_CONFIGURED",
      mode: "literal_deterministic",
      provider: "literal",
      fallback: "Literal deterministic extraction; no semantic model call will be made.",
      totalPredictedAiCalls: 0
    });
    expect(output.callsMade).toEqual({ parser: 0, ai: 0, semanticAi: 0, tts: 0, image: 0 });
  });

  it("fails loudly with a safe structured code for incomplete explicit configuration", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", "create", "tests/fixtures/semantic-manufacturing-course", "--dry-run"], {
      cwd: path.resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        LIVINGCOURSE_SEMANTIC_PROVIDER: "openai-compatible",
        LIVINGCOURSE_SEMANTIC_BASE_URL: "",
        LIVINGCOURSE_SEMANTIC_MODEL: "",
        LIVINGCOURSE_SEMANTIC_API_KEY: ""
      }
    });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ code: "LC-SEMANTIC-CONFIG-002", retryRequiresAi: false });
    expect(result.stdout).not.toContain("Bearer");
  });
});
