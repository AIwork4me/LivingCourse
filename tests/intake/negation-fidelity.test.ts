import { describe, expect, it } from "vitest";
import { resolveKnowledgeDrafts } from "@livingcourse/generation";
import { makeMaterial } from "./semantic-test-helpers.js";

describe("negation fidelity", () => {
  it.each([
    ["Do not open the guard door while the machine is running.", "Open the guard door while the machine is running.", "evidence-prohibition-lost"],
    ["Open the guard door only after shutdown.", "Do not open the guard door after shutdown.", "claim-prohibition-without-evidence"],
    ["禁止在设备运行时打开防护门。", "在设备运行时打开防护门。", "evidence-prohibition-lost"]
  ])("blocks polarity drift from %s", (evidence, claim, expected) => {
    const material = makeMaterial({ id: "guard-sop", blocks: [{ content: evidence }] });
    const block = material.units[0]?.blocks[0];
    const [candidate] = resolveKnowledgeDrafts([{
      claim,
      category: "safety",
      sourceHints: [{ materialId: material.material.id, blockId: block!.id }],
      confidence: 0.95
    }], [material]);

    expect(candidate).toMatchObject({ status: "unsupported_candidate", confidence: 0 });
    expect(candidate?.fidelityIssues).toContainEqual(expect.objectContaining({ kind: "negation", value: expected }));
  });
});
