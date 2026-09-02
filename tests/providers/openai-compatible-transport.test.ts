import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpenAICompatibleStructuredGenerationTransport,
  classifySemanticEndpoint,
  normalizeOpenAICompatibleBaseUrl
} from "@livingcourse/providers";
import { ConfiguredLLMKnowledgeProvider } from "@livingcourse/generation";
import { makeMaterial } from "../intake/semantic-test-helpers.js";

const response = (status: number, body: unknown): Response => new Response(
  typeof body === "string" ? body : JSON.stringify(body),
  { status, headers: { "content-type": "application/json" } }
);

const policy = { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2, jitterRatio: 0 };

const capturedError = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error : new Error("Non-Error rejection");
  }
  throw new Error("Expected promise to reject");
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OpenAI-compatible structured generation transport", () => {
  it("normalizes root and v1 base URLs without duplicating v1", () => {
    expect(normalizeOpenAICompatibleBaseUrl("https://example.test")).toBe("https://example.test/v1");
    expect(normalizeOpenAICompatibleBaseUrl("https://example.test/v1/")).toBe("https://example.test/v1");
    expect(normalizeOpenAICompatibleBaseUrl("http://localhost:11434/api")).toBe("http://localhost:11434/api/v1");
  });

  it("rejects unsafe base URLs", () => {
    expect(() => normalizeOpenAICompatibleBaseUrl("file:///tmp/model")).toThrow("LC-SEMANTIC-TRANSPORT-001");
    expect(() => normalizeOpenAICompatibleBaseUrl("https://user:secret@example.test/v1")).toThrow("must not contain credentials");
    expect(() => normalizeOpenAICompatibleBaseUrl("https://example.test/v1?key=secret")).toThrow("must not contain a query string");
    expect(() => normalizeOpenAICompatibleBaseUrl("https://example.test/v1#secret")).toThrow("must not contain a query string");
  });

  it("classifies loopback endpoints as local and other endpoints as remote", () => {
    expect(classifySemanticEndpoint("http://localhost:11434/v1")).toBe("local");
    expect(classifySemanticEndpoint("http://127.0.0.1:8000")).toBe("local");
    expect(classifySemanticEndpoint("http://127.12.34.56:8000")).toBe("local");
    expect(classifySemanticEndpoint("http://[::1]:8000/v1")).toBe("local");
    expect(classifySemanticEndpoint("https://models.example.test/v1")).toBe("remote");
  });

  it("posts the standard chat-completions request and returns content", async () => {
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_API_KEY", "fixture-secret-key");
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const transport = new OpenAICompatibleStructuredGenerationTransport({
      baseUrl: "https://example.test",
      model: "fixture-model",
      fetchImplementation: async (input, init = {}) => {
        requests.push({ url: String(input), init });
        return response(200, { choices: [{ message: { content: "{\"ok\":true}" } }] });
      }
    });
    await expect(transport.generate({ systemPrompt: "system", inputJson: "{\"input\":1}" })).resolves.toBe("{\"ok\":true}");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://example.test/v1/chat/completions");
    expect(requests[0]?.init.headers).toEqual({ authorization: "Bearer fixture-secret-key", "content-type": "application/json" });
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      model: "fixture-model",
      messages: [{ role: "system", content: "system" }, { role: "user", content: "{\"input\":1}" }],
      temperature: 0
    });
  });

  it.each([400, 401, 403, 404, 422])("does not retry HTTP %i", async (status) => {
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_API_KEY", "fixture-secret-key");
    let calls = 0;
    const transport = new OpenAICompatibleStructuredGenerationTransport({
      baseUrl: "https://example.test/v1",
      model: "fixture-model",
      retryPolicy: policy,
      sleep: async () => undefined,
      fetchImplementation: async () => { calls += 1; return response(status, { error: "fixture-secret-key raw upstream failure" }); }
    });
    const error = await capturedError(transport.generate({ systemPrompt: "s", inputJson: "{}" }));
    expect(calls).toBe(1);
    expect(error.message).toContain(`HTTP ${status}`);
    expect(error.message).not.toContain("fixture-secret-key");
    expect(error.message).not.toContain("raw upstream failure");
  });

  it.each([429, 500])("retries HTTP %i and then succeeds", async (status) => {
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_API_KEY", "fixture-secret-key");
    let calls = 0;
    const transport = new OpenAICompatibleStructuredGenerationTransport({
      baseUrl: "https://example.test/v1",
      model: "fixture-model",
      retryPolicy: policy,
      sleep: async () => undefined,
      fetchImplementation: async () => {
        calls += 1;
        return calls < 3 ? response(status, { error: "retry" }) : response(200, { choices: [{ message: { content: "{}" } }] });
      }
    });
    await expect(transport.generate({ systemPrompt: "s", inputJson: "{}" })).resolves.toBe("{}");
    expect(calls).toBe(3);
  });

  it("retries a timeout with a finite attempt limit", async () => {
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_API_KEY", "fixture-secret-key");
    let calls = 0;
    const transport = new OpenAICompatibleStructuredGenerationTransport({
      baseUrl: "https://example.test/v1",
      model: "fixture-model",
      requestTimeoutMs: 1,
      retryPolicy: { ...policy, maxAttempts: 2 },
      sleep: async () => undefined,
      fetchImplementation: async (_input, init) => {
        calls += 1;
        return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
      }
    });
    await expect(transport.generate({ systemPrompt: "s", inputJson: "{}" })).rejects.toThrow("LC-SEMANTIC-TRANSPORT-004");
    expect(calls).toBe(2);
  });

  it("retries a network reset with a finite attempt limit", async () => {
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_API_KEY", "fixture-secret-key");
    let calls = 0;
    const transport = new OpenAICompatibleStructuredGenerationTransport({
      baseUrl: "https://example.test/v1",
      model: "fixture-model",
      retryPolicy: { ...policy, maxAttempts: 2 },
      sleep: async () => undefined,
      fetchImplementation: async () => { calls += 1; throw new TypeError("connection reset with raw upstream detail"); }
    });
    const error = await capturedError(transport.generate({ systemPrompt: "s", inputJson: "{}" }));
    expect(error.message).toBe("LC-SEMANTIC-TRANSPORT-004: request failed because of a transient network error.");
    expect(calls).toBe(2);
  });

  it("reports malformed JSON, missing choices, and missing content without raw data", async () => {
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_API_KEY", "fixture-secret-key");
    const bodies: unknown[] = ["not-json fixture-secret-key", {}, { choices: [{ message: {} }] }];
    const expected = ["LC-SEMANTIC-TRANSPORT-005", "LC-SEMANTIC-TRANSPORT-006", "LC-SEMANTIC-TRANSPORT-007"];
    for (const [index, body] of bodies.entries()) {
      const transport = new OpenAICompatibleStructuredGenerationTransport({
        baseUrl: "https://example.test/v1",
        model: "fixture-model",
        fetchImplementation: async () => response(200, body)
      });
      const error = await capturedError(transport.generate({ systemPrompt: "s", inputJson: "{}" }));
      expect(error.message).toContain(expected[index]);
      expect(error.message).not.toContain("fixture-secret-key");
    }
  });

  it("leaves code-fence and reasoning extraction to the existing AI firewall", async () => {
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_API_KEY", "fixture-secret-key");
    const material = makeMaterial({ id: "sop", blocks: [{ content: "Wear splash goggles." }] });
    const transport = new OpenAICompatibleStructuredGenerationTransport({
      baseUrl: "https://example.test/v1",
      model: "fixture-model",
      fetchImplementation: async () => response(200, { choices: [{ message: { content: `Reasoning omitted.\n\`\`\`json\n[{"claim":"Wear splash goggles.","category":"safety","sourceHints":[{"materialId":"${material.material.id}"}],"confidence":0.9}]\n\`\`\`` } }] })
    });
    const provider = new ConfiguredLLMKnowledgeProvider({ provider: "openai-compatible", model: "fixture-model", profileVersion: "1", promptTemplate: "fixture prompt", transport });
    await expect(provider.understand([material])).resolves.toHaveLength(1);
  });
});
