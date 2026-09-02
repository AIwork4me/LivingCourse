import { describe, expect, it } from "vitest";
import { ConfiguredLLMKnowledgeProvider, resolveKnowledgeDrafts } from "@livingcourse/generation";
import { makeMaterial } from "./semantic-test-helpers.js";

describe("semantic AI authority boundary", () => {
  it("rejects AI attempts to emit EvidenceRefs or authority decisions", async () => {
    const material = makeMaterial({ id: "sop", blocks: [{ content: "Wear splash goggles." }] });
    const provider = new ConfiguredLLMKnowledgeProvider({
      provider: "generic-test",
      model: "structured-test",
      profileVersion: "1",
      promptTemplate: "fixture knowledge prompt",
      transport: {
        generate: async () => JSON.stringify([{
          claim: "Wear splash goggles.",
          category: "safety",
          sourceHints: [{ materialId: material.material.id }],
          confidence: 0.9,
          evidenceRefs: [{ materialId: material.material.id }],
          authorityAssessment: "recorded"
        }])
      }
    });

    await expect(provider.understand([material])).rejects.toThrow("LC-KNOWLEDGE-AI-001");
  });

  it("lets deterministic code resolve a valid hint into an EvidenceRef", async () => {
    const material = makeMaterial({ id: "sop", blocks: [{ content: "Wear splash goggles." }] });
    const provider = new ConfiguredLLMKnowledgeProvider({
      provider: "generic-test",
      model: "structured-test",
      profileVersion: "1",
      promptTemplate: "fixture knowledge prompt",
      transport: { generate: async () => JSON.stringify([{ claim: "Wear splash goggles.", category: "safety", sourceHints: [{ materialId: material.material.id, quoteOrText: "Wear splash goggles." }], confidence: 2 }]) }
    });

    const drafts = await provider.understand([material]);
    expect(drafts[0]?.confidence).toBe(1);
    const [candidate] = resolveKnowledgeDrafts(drafts, [material]);
    expect(candidate).toMatchObject({ status: "supported_candidate", evidenceResolution: "normalized_text", confidence: 1 });
    expect(candidate?.evidenceRefs).toHaveLength(1);
  });
});
