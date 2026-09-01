import { sha256, type SlideType } from "@livingcourse/core";
import type { CourseDesignCapability, CourseDesignInput, CoursePlanDraft, KnowledgeCandidate } from "./capabilities.js";

const existingSlideTypes = new Set<SlideType>(["hero", "step_process", "safety_focus"]);

const slideTypeFor = (candidates: readonly KnowledgeCandidate[]): SlideType => {
  if (candidates.some((candidate) => candidate.category === "safety")) return "safety_focus";
  if (candidates.some((candidate) => ["process", "device_operation", "quality"].includes(candidate.category))) return "step_process";
  return "hero";
};

const purposeFor = (candidates: readonly KnowledgeCandidate[]): string => {
  if (candidates.some((candidate) => candidate.category === "safety")) return "Help employees recognize and follow the relevant safety requirement.";
  if (candidates.some((candidate) => ["process", "device_operation"].includes(candidate.category))) return "Help employees understand the required sequence and operating boundary.";
  if (candidates.some((candidate) => candidate.category === "quality")) return "Help employees preserve the required quality condition.";
  return "Give employees the context needed for the reviewed training objective.";
};

const eligibleCandidates = (candidates: readonly KnowledgeCandidate[]): KnowledgeCandidate[] => candidates
  .filter((candidate) => candidate.evidenceRefs.length > 0 && !["unsupported_candidate", "stale_evidence"].includes(candidate.status))
  .sort((left, right) => left.id.localeCompare(right.id));

export const deterministicCoursePlan = (input: CourseDesignInput): CoursePlanDraft => {
  const eligible = eligibleCandidates(input.candidates);
  const groups: KnowledgeCandidate[][] = [];
  for (let index = 0; index < eligible.length; index += 2) groups.push(eligible.slice(index, index + 2));
  return {
    title: input.title,
    learningObjectives: eligible.slice(0, 8).map((candidate) => `Understand and apply: ${candidate.claim}`),
    slides: groups.slice(0, input.maxSlides).map((group, index) => ({
      id: `planned-slide-${String(index + 1).padStart(2, "0")}`,
      title: group[0]?.claim.slice(0, 80) ?? `Course topic ${index + 1}`,
      purpose: purposeFor(group),
      candidateIds: group.map((candidate) => candidate.id),
      proposedSlideType: slideTypeFor(group),
      visualIntent: "Use only reviewed source-grounded visuals after author approval."
    }))
  };
};

export const validateCoursePlanDraft = (plan: CoursePlanDraft, candidates: readonly KnowledgeCandidate[], maxSlides = 20): string[] => {
  const errors: string[] = [];
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  if (!plan.title.trim()) errors.push("Course plan title is required.");
  if (plan.slides.length < 1 || plan.slides.length > maxSlides) errors.push(`Course plan must contain 1..${maxSlides} slides.`);
  const referenced = new Set<string>();
  for (const [index, slide] of plan.slides.entries()) {
    if (!slide.title.trim() || !slide.purpose.trim()) errors.push(`Slide ${index + 1} requires title and purpose.`);
    if (!existingSlideTypes.has(slide.proposedSlideType)) errors.push(`Slide ${index + 1} uses an unsupported slide type.`);
    if (slide.candidateIds.length === 0) errors.push(`Slide ${index + 1} must reference at least one KnowledgeCandidate.`);
    for (const id of slide.candidateIds) {
      const candidate = candidateById.get(id);
      if (!candidate) errors.push(`Slide ${index + 1} references unknown candidate '${id}'.`);
      else if (candidate.status === "unsupported_candidate" || candidate.status === "stale_evidence" || candidate.evidenceRefs.length === 0) errors.push(`Slide ${index + 1} references ineligible candidate '${id}'.`);
      if (referenced.has(id)) errors.push(`KnowledgeCandidate '${id}' is assigned to more than one slide.`);
      referenced.add(id);
    }
  }
  return errors;
};

export class DeterministicCourseDesignProvider implements CourseDesignCapability {
  readonly identity = {
    mode: "literal_deterministic" as const,
    provider: "livingcourse",
    model: "deterministic-course-plan-v2",
    promptTemplateVersion: "not-applicable",
    promptTemplateHash: sha256("deterministic-course-plan-v2"),
    profileVersion: "candidate-chunking-v2"
  };

  async design(input: CourseDesignInput): Promise<CoursePlanDraft> {
    return deterministicCoursePlan(input);
  }
}
