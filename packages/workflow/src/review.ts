import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  validateReleaseEligibility,
  validateStateTransition,
  type CourseLifecycleState,
  type CourseSpec,
  type ReleaseScope,
  type ReviewDecision,
  type ReviewStatus
} from "@livingcourse/core";
import type { BuildPlan } from "@livingcourse/compiler";
import { WorkflowError, type ReviewPackage } from "./types.js";

export const createReviewPackage = (course: CourseSpec, plan: BuildPlan): ReviewPackage => {
  const gates = [...new Set(course.slides.flatMap((slide) => slide.governance.requiredReviewGates))].sort();
  return {
    courseId: course.course.id,
    gates: gates.map((gateId) => ({
      gateId,
      artifactIds: course.slides.filter((slide) => slide.governance.requiredReviewGates.includes(gateId)).map((slide) => slide.id),
      status: course.governance.reviewDecisions.some((decision) => decision.gateId === gateId && decision.decision.startsWith("approved")) ? "satisfied" : "pending",
      actions: ["approve", "reject", "comment"]
    })),
    buildSummary: { reuse: plan.reuse.length, regenerate: plan.regenerate.length, rebuild: plan.rebuild.length, blocked: plan.blocked.length }
  };
};

const nextState = (decision: ReviewStatus): CourseLifecycleState => {
  if (decision === "approved_for_poc_use") return "approved_for_poc_use";
  if (decision === "approved_for_release") return "approved_for_release";
  if (decision === "changes_required") return "changes_required";
  if (decision === "rejected") return "rejected";
  return "review_required";
};

export const recordReviewDecision = async (options: {
  coursePath: string;
  gateId: string;
  decision: ReviewStatus;
  reviewer: string;
  scope: ReleaseScope;
  comments?: string;
}): Promise<ReviewDecision> => {
  const coursePath = path.resolve(options.coursePath);
  const course = JSON.parse(await readFile(coursePath, "utf8")) as CourseSpec;
  const targetState = nextState(options.decision);
  const transition = validateStateTransition(course.governance.lifecycleState, targetState);
  if (!transition.valid) throw new WorkflowError({
    code: "LC-STATE-001",
    whatHappened: "Review decision would cause an illegal state transition.",
    why: transition.errors[0]?.message ?? "Unknown state transition error.",
    canAutoFix: false,
    userAction: "Complete the required preceding review gates.",
    retryRequiresAi: false
  });
  const decision: ReviewDecision = {
    artifactId: course.course.id,
    gateId: options.gateId,
    decision: options.decision,
    reviewer: options.reviewer,
    reviewedAt: new Date().toISOString(),
    scope: options.scope,
    comments: options.comments ?? "",
    acceptedRisks: []
  };
  const candidate = structuredClone(course);
  candidate.governance.reviewDecisions.push(decision);
  candidate.governance.lifecycleState = targetState;
  if (options.decision === "approved_for_release") {
    for (const slide of candidate.slides) slide.governance.reviewStatus = "approved_for_release";
    const release = validateReleaseEligibility(candidate);
    if (!release.valid) throw new WorkflowError({
      code: "LC-RELEASE-001",
      whatHappened: "Production release approval is blocked.",
      why: release.errors.map((error) => `${error.path}: ${error.message}`).join("; "),
      canAutoFix: false,
      userAction: "Resolve grounding, synthetic-content, source, and release-gate blockers before approval.",
      retryRequiresAi: false
    });
  }
  const temporary = `${coursePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  await rename(temporary, coursePath);
  return decision;
};
