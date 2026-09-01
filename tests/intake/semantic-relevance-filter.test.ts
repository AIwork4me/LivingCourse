import { describe, expect, it } from "vitest";
import { deterministicKnowledgeDrafts } from "@livingcourse/generation";
import { makeMaterial } from "./semantic-test-helpers.js";

describe("semantic relevance filter", () => {
  it("excludes document furniture and intentionally irrelevant policy text", () => {
    const material = makeMaterial({
      id: "handbook",
      blocks: [
        { type: "title", content: "Synthetic Press Entry Handbook" },
        { type: "paragraph", content: "Revision history: formatting refresh." },
        { type: "paragraph", content: "Office lunch policy permits breaks at noon." },
        { type: "paragraph", content: "Wear splash goggles before entering the practice zone." }
      ]
    });

    const claims = deterministicKnowledgeDrafts([material]).map((draft) => draft.claim);
    expect(claims).toEqual(["Wear splash goggles before entering the practice zone."]);
  });
});
