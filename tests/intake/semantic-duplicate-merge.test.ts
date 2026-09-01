import { describe, expect, it } from "vitest";
import { deterministicKnowledgeDrafts, resolveKnowledgeDrafts } from "@livingcourse/generation";
import { makeMaterial } from "./semantic-test-helpers.js";

describe("semantic duplicate merge", () => {
  it("merges duplicate claims while retaining every source location", () => {
    const repeated = "Wear splash goggles and safety shoes before starting.";
    const sop = makeMaterial({ id: "sop", name: "approved-sop.pdf", mediaType: "application/pdf", kind: "page", blocks: [{ content: repeated }] });
    const handbook = makeMaterial({ id: "handbook", name: "employee-handbook.docx", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "page", blocks: [{ content: repeated }] });

    const candidates = resolveKnowledgeDrafts(deterministicKnowledgeDrafts([sop, handbook]), [sop, handbook]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.evidenceRefs).toHaveLength(2);
    expect(new Set(candidates[0]?.evidenceRefs.map((ref) => ref.materialId))).toEqual(new Set([sop.material.id, handbook.material.id]));
  });
});
