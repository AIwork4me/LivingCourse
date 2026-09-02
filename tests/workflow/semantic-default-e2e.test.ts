import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DirectTextProvider } from "@livingcourse/intake";
import { executeCreate, resolveSemanticCapabilitiesFromEnv } from "@livingcourse/workflow";

const temporaryRoots: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const requestBody = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
};

const userInput = (body: Record<string, unknown>): unknown => {
  const messages = body.messages as Array<Record<string, unknown>>;
  const content = messages.find((message) => message.role === "user")?.content;
  return JSON.parse(String(content)) as unknown;
};

const respond = (response: ServerResponse, content: unknown): void => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    id: "request-specific-provider-metadata",
    debug: "raw remote response metadata that must not persist",
    choices: [{ message: { content: JSON.stringify(content) } }]
  }));
};

describe("default configured semantic path", () => {
  it("runs intake through both semantic capabilities and reuses the exact second run without persisting secrets", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "livingcourse-semantic-default-"));
    temporaryRoots.push(root);
    const source = path.join(root, "source");
    await mkdir(source);
    await writeFile(path.join(source, "safety.md"), "Wear splash goggles before starting.", "utf8");

    let requests = 0;
    const server = createServer(async (request, response) => {
      requests += 1;
      expect(request.url).toBe("/v1/chat/completions");
      expect(request.headers.authorization).toBe("Bearer fixture-secret-key");
      const body = await requestBody(request);
      const input = userInput(body);
      if (Array.isArray(input)) {
        const material = input[0] as { material: { id: string }; units: Array<{ blocks: Array<{ id: string; content: string }> }> };
        const block = material.units[0]!.blocks[0]!;
        respond(response, [{ claim: block.content, category: "safety", sourceHints: [{ materialId: material.material.id, blockId: block.id }], confidence: 0.95 }]);
      } else {
        const design = input as { title: string; candidates: Array<{ id: string }> };
        respond(response, { title: design.title, learningObjectives: ["Apply the supported safety requirement."], slides: [{ title: "Safe start", purpose: "Explain the required protection.", candidateIds: [design.candidates[0]!.id], proposedSlideType: "safety_focus" }] });
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Fixture semantic server did not expose a TCP port.");
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_PROVIDER", "openai-compatible");
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_BASE_URL", `http://127.0.0.1:${address.port}`);
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_MODEL", "fixture-model");
    vi.stubEnv("LIVINGCOURSE_SEMANTIC_API_KEY", "fixture-secret-key");

    try {
      const semantic = await resolveSemanticCapabilitiesFromEnv();
      const options = {
        workspaceRoot: root,
        cacheRoot: path.join(root, "intake-cache"),
        semanticCacheRoot: path.join(root, "semantic-cache"),
        outputRoot: path.join(root, "review"),
        providers: [new DirectTextProvider()],
        title: "Safety induction",
        audience: "New hires",
        purpose: "Apply safe-start requirements",
        locale: "en",
        knowledgeUnderstanding: semantic.knowledgeUnderstanding,
        courseDesign: semantic.courseDesign,
        semanticProcessing: { mode: semantic.disclosure.processingMode, provider: semantic.disclosure.provider, model: semantic.disclosure.model }
      };
      const first = await executeCreate(source, options);
      expect(first.aiCalls).toEqual({ knowledgeUnderstanding: 1, courseDesign: 1, total: 2 });
      expect(requests).toBe(2);
      const second = await executeCreate(source, options);
      expect(second.aiCalls).toEqual({ knowledgeUnderstanding: 0, courseDesign: 0, total: 0 });
      expect(requests).toBe(2);

      const persisted = [
        JSON.stringify(second.candidate),
        await readFile(second.candidatePath, "utf8"),
        await readFile(second.reviewPackagePath, "utf8"),
        await readFile(path.join(root, "semantic-cache", "index.json"), "utf8")
      ].join("\n");
      expect(persisted).not.toContain("fixture-secret-key");
      expect(persisted).not.toContain("Bearer ");
      expect(persisted).not.toContain(`127.0.0.1:${address.port}`);
      expect(persisted).not.toContain("# Knowledge Understanding v1");
      expect(persisted).not.toContain("choices");
      expect(persisted).not.toContain("request-specific-provider-metadata");
      expect(persisted).not.toContain("raw remote response metadata");
      expect(persisted).toContain("Semantic provider: openai-compatible");
      expect(persisted).toContain("Processing: Local");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
