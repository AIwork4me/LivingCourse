import { describe, expect, it } from "vitest";
import { normalizeMaterialIR } from "@livingcourse/intake";
import { buildCourseSpecCandidate, detectKnowledgeConflicts, extractKnowledgeCandidates, findAuthorityGaps, resolveGrounding } from "@livingcourse/generation";

describe("manual authoring KPI", () => {
  it("creates a reviewable candidate without asking the user to write prompts or JSON", () => {
    const materials = [normalizeMaterialIR({
      document: { materialId: "handbook", path: "handbook.txt", originalName: "handbook.txt", mediaType: "text/plain", sha256: "handbook-sha", sizeBytes: 10, authority: { sourceClass: "controlled_internal", authority: "HR", version: "1", effectiveDate: "2026-09-01" } },
      units: [{ kind: "section", index: 0, blocks: [{ type: "paragraph", content: "Report hazards to the trainer." }] }],
      provenance: { provider: "fake", providerVersion: "1", parseProfile: "balanced", processingMode: "local", endpointClassification: "local", parsedAt: "2026-09-01T00:00:00Z", rawArtifactRefs: [] }
    })];
    const conflict = detectKnowledgeConflicts(extractKnowledgeCandidates(materials), materials);
    const grounding = resolveGrounding(conflict.candidates, materials);
    const candidate = buildCourseSpecCandidate({ title: "Safety", audience: "New hires", purpose: "Learn reporting", materials, knowledgeCandidates: grounding.candidates, conflicts: conflict.conflicts, groundingRequirements: grounding.requirements, groundingGaps: grounding.gaps, authorityGaps: findAuthorityGaps(materials) });
    expect(candidate.metrics.manualPromptCount).toBe(0);
    expect(candidate.metrics.manualJsonEditCount).toBe(0);
    expect(candidate.metrics.evidenceCoverage).toBe(1);
  });
});
