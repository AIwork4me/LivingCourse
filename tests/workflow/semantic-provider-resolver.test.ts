import { afterEach, describe, expect, it, vi } from "vitest";
import { runDoctor, loadSemanticPromptTemplates, resolveSemanticCapabilitiesFromEnv } from "@livingcourse/workflow";
import { sha256 } from "@livingcourse/core";

const semanticEnvNames = [
  "LIVINGCOURSE_SEMANTIC_PROVIDER",
  "LIVINGCOURSE_SEMANTIC_BASE_URL",
  "LIVINGCOURSE_SEMANTIC_MODEL",
  "LIVINGCOURSE_SEMANTIC_API_KEY",
  "LIVINGCOURSE_SEMANTIC_TIMEOUT_MS"
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const clearSemanticEnv = (): void => {
  for (const name of semanticEnvNames) vi.stubEnv(name, "");
};

describe("semantic provider environment resolver", () => {
  it("uses an explicit zero-call literal fallback when the provider is absent", async () => {
    clearSemanticEnv();
    const result = await resolveSemanticCapabilitiesFromEnv();
    expect(result.disclosure).toEqual({
      status: "NOT_CONFIGURED",
      mode: "literal_deterministic",
      provider: "literal",
      model: null,
      processingMode: "local_deterministic",
      fallback: "Literal deterministic extraction; no semantic model call will be made.",
      reachability: "NOT_APPLICABLE"
    });
  });

  it("fails loudly for an explicitly selected but incomplete provider", async () => {
    clearSemanticEnv();
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_PROVIDER", "openai-compatible");
    await expect(resolveSemanticCapabilitiesFromEnv()).rejects.toThrow("LC-SEMANTIC-CONFIG-002");
  });

  it("constructs distinct identities from the authoritative prompt files", async () => {
    clearSemanticEnv();
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_PROVIDER", "openai-compatible");
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_BASE_URL", "http://127.0.0.1:8080/v1");
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_MODEL", "fixture-model");
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_API_KEY", "fixture-secret-key");
    const prompts = await loadSemanticPromptTemplates();
    const result = await resolveSemanticCapabilitiesFromEnv();
    expect(result.disclosure).toMatchObject({ status: "CONFIGURED", provider: "openai-compatible", model: "fixture-model", processingMode: "local", reachability: "NOT_VERIFIED" });
    expect(result.knowledgeUnderstanding.identity).toMatchObject({ promptTemplateVersion: "knowledge-understanding-v1", promptTemplateHash: sha256(prompts.knowledge) });
    expect(result.courseDesign.identity).toMatchObject({ promptTemplateVersion: "course-design-v1", promptTemplateHash: sha256(prompts.courseDesign) });
    expect(result.knowledgeUnderstanding.identity.promptTemplateHash).not.toBe(result.courseDesign.identity.promptTemplateHash);
  });

  it("doctor reports an unconfigured semantic provider without consuming a token", async () => {
    clearSemanticEnv();
    const report = await runDoctor({ workspaceRoot: process.cwd() });
    expect(report.checks.find((check) => check.id === "semantic-provider")).toMatchObject({ status: "WARN" });
    expect(report.checks.find((check) => check.id === "semantic-provider")?.detail).toContain("NOT CONFIGURED");
  });

  it("doctor validates configured semantic settings without making a model request", async () => {
    clearSemanticEnv();
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_PROVIDER", "openai-compatible");
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_BASE_URL", "https://semantic.example.test/v1");
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_MODEL", "fixture-model");
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_API_KEY", "fixture-secret-key");
    vi.stubEnv("LIVINGCOURSE_DOCUMENT_PROVIDER", "mineru-cloud");
    vi.stubEnv("MINERU_API_TOKEN", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const report = await runDoctor({ workspaceRoot: process.cwd() });
    expect(report.checks.find((check) => check.id === "semantic-provider")).toMatchObject({ status: "PASS" });
    expect(report.checks.find((check) => check.id === "semantic-provider")?.detail).toContain("REACHABILITY NOT VERIFIED");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
