import type { CourseLifecycleState, ValidationResult } from "./types.js";

const transitions: Readonly<Record<CourseLifecycleState, readonly CourseLifecycleState[]>> = {
  candidate: ["normalized", "rejected"],
  normalized: ["validated", "changes_required", "rejected"],
  validated: ["review_required", "changes_required", "rejected"],
  review_required: ["approved_for_poc_use", "approved_for_release", "changes_required", "rejected"],
  approved_for_poc_use: ["review_required", "approved_for_release", "changes_required", "rejected"],
  approved_for_release: ["review_required", "changes_required"],
  changes_required: ["candidate", "rejected"],
  rejected: ["candidate"]
};

export const validateStateTransition = (
  from: CourseLifecycleState,
  to: CourseLifecycleState
): ValidationResult => {
  const valid = transitions[from].includes(to);
  return valid
    ? { valid: true, errors: [] }
    : {
        valid: false,
        errors: [{
          code: "LC-STATE-001",
          path: "/governance/lifecycleState",
          message: `Illegal CourseSpec transition: ${from} -> ${to}.`,
          severity: "blocking"
        }]
      };
};
