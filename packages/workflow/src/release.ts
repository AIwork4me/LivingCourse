import { validateReleaseEligibility, type CourseSpec, type ValidationResult } from "@livingcourse/core";
import type { SecurityScanResult } from "./security.js";

export const validateProductionRelease = (course: CourseSpec, security: SecurityScanResult): ValidationResult => {
  const result = validateReleaseEligibility(course);
  if (!security.passed) {
    result.errors.push({
      code: "LC-RELEASE-SECURITY-001",
      path: "/",
      message: "Security scan failed; production release is blocked.",
      severity: "blocking"
    });
  }
  result.valid = result.errors.length === 0;
  return result;
};
