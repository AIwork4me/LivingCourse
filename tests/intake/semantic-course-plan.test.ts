import { describe, expect, it } from "vitest";
import {
  buildCourseSpecCandidate,
  deterministicCoursePlan,
  resolveKnowledgeDrafts,
  validateCoursePlanDraft,
  type CoursePlanDraft,
  type KnowledgeCandidateDraft
} from "@livingcourse/generation";
import { makeMaterial } from "./semantic-test-helpers.js";

describe("semantic course planning", () => {
  it("creates six content-driven slides from twelve linked candidates", () => {
    const claims = [
      ["Wear splash goggles before entry.", "safety"],
      ["Do not open the guard during operation.", "safety"],
      ["Record the pre-start inspection.", "process"],
      ["Wait for trainer release after inspection.", "process"],
      ["Keep a minimum 10 mm clearance.", "quality"],
      ["A reading outside 5% requires review.", "quality"],
      ["Synthetic training pressure setting = 0.55 MPa.", "device_operation"],
      ["The simulated warning beacon requires a stop.", "device_operation"],
      ["The trainer owns the practice session.", "policy"],
      ["Report uncertainty to the trainer.", "policy"],
      ["This course is for supervised training.", "general"],
      ["The fixture contains no real equipment instruction.", "general"]
    ] as const;
    const material = makeMaterial({ id: "course-evidence", blocks: claims.map(([content]) => ({ content })) });
    const drafts: KnowledgeCandidateDraft[] = material.units[0]!.blocks.map((block, index) => ({
      claim: block.content,
      category: claims[index]![1],
      sourceHints: [{ materialId: material.material.id, blockId: block.id }],
      confidence: 0.9
    }));
    const candidates = resolveKnowledgeDrafts(drafts, [material]);
    const plan = deterministicCoursePlan({ title: "Synthetic induction", audience: "New hires", purpose: "Training", locale: "en", candidates, maxSlides: 20 });

    expect(plan.slides).toHaveLength(6);
    expect(validateCoursePlanDraft(plan, candidates)).toEqual([]);
    expect(plan.slides.flatMap((slide) => slide.candidateIds).sort()).toEqual(candidates.map((candidate) => candidate.id).sort());
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    for (const slide of plan.slides) {
      const categories = slide.candidateIds.map((id) => byId.get(id)!.category);
      const expected = categories.includes("safety") ? "safety_focus"
        : categories.some((category) => ["process", "device_operation", "quality"].includes(category)) ? "step_process"
          : "hero";
      expect(slide.proposedSlideType).toBe(expected);
    }
  });

  it("rejects unlinked candidates and never turns a planning narration draft into course knowledge", () => {
    const material = makeMaterial({ id: "linked", blocks: [{ content: "Wear splash goggles before entry." }] });
    const block = material.units[0]!.blocks[0]!;
    const [candidate] = resolveKnowledgeDrafts([{ claim: block.content, category: "safety", sourceHints: [{ materialId: material.material.id, blockId: block.id }], confidence: 0.9 }], [material]);
    const invalid: CoursePlanDraft = { title: "Course", learningObjectives: [], slides: [{ title: "Safety", purpose: "Review safety", candidateIds: ["missing"], proposedSlideType: "safety_focus" }] };
    expect(validateCoursePlanDraft(invalid, [candidate!])).toContain("Slide 1 references unknown candidate 'missing'.");

    const valid: CoursePlanDraft = { title: "Course", learningObjectives: [], slides: [{ title: "Safety", purpose: "Review safety", candidateIds: [candidate!.id], proposedSlideType: "safety_focus", narrationDraft: "Invented fact." }] };
    const built = buildCourseSpecCandidate({ title: "Course", audience: "New hires", purpose: "Training", materials: [material], knowledgeCandidates: [candidate!], conflicts: [], groundingRequirements: [], groundingGaps: [], authorityGaps: [], coursePlan: valid });
    expect(built.draft.slides[0]?.knowledge.items.map((item) => item.text)).toEqual([candidate!.claim]);
    expect(built.draft.slides[0]?.narration.script).toBe(candidate!.claim);
  });
});
