import type { CourseSpec, SlideSpec, ValidationError, ValidationResult } from "../types.js";

export interface ReleasePolicyConfig {
  version: string;
  riskRequirements: Record<"illustrative" | "procedural_general" | "device_specific", {
    humanReview: boolean;
    grounding: "reviewed" | "verified" | "verified_real_device";
  }>;
  syntheticProductionAllowed: false;
}

export const DEFAULT_RELEASE_POLICY: ReleasePolicyConfig = {
  version: "1.0.0",
  riskRequirements: {
    illustrative: { humanReview: true, grounding: "reviewed" },
    procedural_general: { humanReview: true, grounding: "verified" },
    device_specific: { humanReview: true, grounding: "verified_real_device" }
  },
  syntheticProductionAllowed: false
};

const slideReleaseErrors = (slide: SlideSpec, index: number): ValidationError[] => {
  const path = `/slides/${index}`;
  const errors: ValidationError[] = [];
  const synthetic = slide.grounding.sourceClass === "synthetic"
    || slide.presentation.visualIntent.requirements.some((requirement) => requirement.synthetic || requirement.pocOnly);
  if (synthetic) {
    errors.push({
      code: "LC-RELEASE-001",
      path: `${path}/grounding/sourceClass`,
      message: "Synthetic or PoC-only content cannot be released to production.",
      severity: "blocking"
    });
  }
  if (slide.governance.reviewStatus !== "approved_for_release") {
    errors.push({
      code: "LC-RELEASE-002",
      path: `${path}/governance/reviewStatus`,
      message: "Slide has no approved_for_release human decision.",
      severity: "blocking"
    });
  }
  if (slide.governance.riskLevel !== "illustrative" && !slide.grounding.verified) {
    errors.push({
      code: "LC-GROUNDING-001",
      path: `${path}/grounding/verified`,
      message: "Procedural content requires verified grounding for production release.",
      severity: "blocking"
    });
  }
  if (slide.governance.riskLevel === "device_specific") {
    const validAnchor = slide.grounding.anchor?.status === "verified"
      && slide.grounding.anchor.assetRef !== null
      && slide.grounding.anchor.confirmedBy !== null;
    if (slide.grounding.sourceClass !== "controlled_internal" || !validAnchor) {
      errors.push({
        code: "LC-GROUNDING-002",
        path: `${path}/grounding/anchor`,
        message: "Device-specific content requires a verified real-device source and human-confirmed anchor.",
        severity: "blocking"
      });
    }
  }
  for (const [blockerIndex, blocker] of slide.governance.releaseBlockers.entries()) {
    errors.push({
      code: "LC-RELEASE-003",
      path: `${path}/governance/releaseBlockers/${blockerIndex}`,
      message: blocker,
      severity: "blocking"
    });
  }
  return errors;
};

export const evaluateReleaseEligibility = (course: CourseSpec): ValidationResult => {
  const errors = course.slides.flatMap(slideReleaseErrors);
  const releaseDecision = course.governance.reviewDecisions.some((decision) =>
    decision.gateId === "production-release"
      && decision.scope === "production"
      && decision.decision === "approved_for_release"
  );
  if (!releaseDecision) {
    errors.push({
      code: "LC-RELEASE-004",
      path: "/governance/reviewDecisions",
      message: "A production-scoped approved_for_release decision is required.",
      severity: "blocking"
    });
  }
  return { valid: errors.length === 0, errors };
};
