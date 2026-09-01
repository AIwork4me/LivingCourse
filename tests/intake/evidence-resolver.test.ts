import { describe, expect, it } from "vitest";
import { resolveKnowledgeDrafts } from "@livingcourse/generation";
import { makeMaterial } from "./semantic-test-helpers.js";

describe("deterministic EvidenceResolver", () => {
  it("fails closed when no source hint can be resolved", () => {
    const material = makeMaterial({ id: "sop", blocks: [{ content: "Wear splash goggles before entry." }] });
    const [candidate] = resolveKnowledgeDrafts([{
      claim: "Use an invented training control.",
      category: "device_operation",
      sourceHints: [{ materialId: material.material.id, quoteOrText: "This sentence is absent from the source." }],
      confidence: 0.99
    }], [material]);

    expect(candidate).toMatchObject({ evidenceRefs: [], evidenceResolution: "unresolved", status: "unsupported_candidate", confidence: 0 });
  });

  it("caps confidence when a unique fuzzy source-text match is used", () => {
    const material = makeMaterial({ id: "sop", blocks: [{ content: "Wear splash goggles and safety shoes before starting the supervised exercise." }] });
    const [candidate] = resolveKnowledgeDrafts([{
      claim: "Wear splash goggles and safety shoes before starting the supervised exercise.",
      category: "safety",
      sourceHints: [{ materialId: material.material.id, quoteOrText: "Wear splash goggles & safety shoes before starting the supervised exercise" }],
      confidence: 0.97
    }], [material]);

    expect(candidate).toMatchObject({ evidenceResolution: "fuzzy_text", status: "supported_candidate", confidence: 0.8 });
    expect(candidate?.evidenceRefs).toHaveLength(1);
  });
});
