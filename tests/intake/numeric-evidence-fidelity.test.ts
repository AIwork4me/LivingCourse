import { describe, expect, it } from "vitest";
import { auditKnowledgeEvidence, resolveKnowledgeDrafts } from "@livingcourse/generation";
import { makeMaterial } from "./semantic-test-helpers.js";

describe("numeric evidence fidelity", () => {
  it("fails closed when a semantic draft changes a number or unit", () => {
    const material = makeMaterial({ id: "approved-sop", blocks: [{ content: "Synthetic training pressure setting = 0.55 MPa." }] });
    const block = material.units[0]?.blocks[0];
    expect(block).toBeDefined();
    const [candidate] = resolveKnowledgeDrafts([{
      claim: "Synthetic training pressure setting = 0.65 MPa.",
      category: "device_operation",
      sourceHints: [{ materialId: material.material.id, blockId: block!.id }],
      confidence: 0.99
    }], [material]);

    expect(candidate).toMatchObject({ status: "unsupported_candidate", confidence: 0 });
    expect(candidate?.fidelityIssues).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "numeric", value: "0.65mpa" })]));
  });

  it("preserves exact numeric evidence and detects stale content hashes", () => {
    const material = makeMaterial({ id: "approved-sop", blocks: [{ content: "Keep a minimum 10 mm clearance." }] });
    const block = material.units[0]?.blocks[0];
    const [candidate] = resolveKnowledgeDrafts([{
      claim: "Keep a minimum 10 mm clearance.",
      category: "quality",
      sourceHints: [{ materialId: material.material.id, blockId: block!.id }],
      confidence: 1.4
    }], [material]);

    expect(candidate).toMatchObject({ status: "supported_candidate", confidence: 1, fidelityIssues: [] });

    const changed = makeMaterial({ id: "approved-sop", blocks: [{ content: "Keep a minimum 12 mm clearance." }] });
    expect(auditKnowledgeEvidence([candidate!], [changed])[0]).toMatchObject({ status: "stale_evidence", confidence: 0 });
  });

  it.each(["10 mm", "80 °C", "5%"])('accepts the exact normalized value "%s"', (value) => {
    const sentence = `The synthetic evidence records ${value} as the reviewed threshold.`;
    const material = makeMaterial({ id: `numeric-${value}`, blocks: [{ content: sentence }] });
    const block = material.units[0]!.blocks[0]!;
    const [candidate] = resolveKnowledgeDrafts([{ claim: sentence, category: "quality", sourceHints: [{ materialId: material.material.id, blockId: block.id }], confidence: 0.87 }], [material]);
    expect(candidate).toMatchObject({ status: "supported_candidate", confidence: 0.87, fidelityIssues: [] });
  });
});
