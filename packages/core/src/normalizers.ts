import { COURSE_SPEC_VERSION } from "./version.js";
import { migrateCourseSpec } from "./migrations.js";
import type { CourseSpec, SlideSpec } from "./types.js";

const clone = <T>(value: T): T => structuredClone(value);
const byId = <T extends { id: string }>(left: T, right: T): number => left.id.localeCompare(right.id);

export const normalizeSlideSpec = (input: SlideSpec): SlideSpec => {
  const slide = clone(input);
  slide.knowledge.items.sort((left, right) => left.order - right.order || byId(left, right));
  for (const item of slide.knowledge.items) item.sourceRefs = [...new Set(item.sourceRefs)].sort();
  slide.presentation.visualIntent.requirements.sort(byId);
  if (slide.presentation.layout.readingOrder) slide.presentation.layout.readingOrder = [...new Set(slide.presentation.layout.readingOrder)];
  slide.presentation.layout.safeAreas?.sort((left, right) =>
    left.x - right.x || left.y - right.y || left.width - right.width || left.height - right.height
  );
  slide.presentation.motionIntent.sort((left, right) => left.order - right.order || byId(left, right));
  for (const motion of slide.presentation.motionIntent) motion.targetIds = [...new Set(motion.targetIds)];
  slide.narration.cues.sort(byId);
  for (const cue of slide.narration.cues) cue.targetIds = [...new Set(cue.targetIds)];
  slide.grounding.sourceRefs = [...new Set(slide.grounding.sourceRefs)].sort();
  slide.governance.requiredReviewGates = [...new Set(slide.governance.requiredReviewGates)].sort();
  slide.governance.releaseBlockers = [...new Set(slide.governance.releaseBlockers)].sort();
  return slide;
};

export const normalizeCourseSpec = (input: CourseSpec): CourseSpec => {
  const course = migrateCourseSpec(input) as unknown as CourseSpec;
  course.courseSpecVersion = COURSE_SPEC_VERSION;
  course.materials.sort(byId);
  course.slides = course.slides.map(normalizeSlideSpec).sort((left, right) => left.order - right.order || byId(left, right));
  course.governance.reviewDecisions.sort((left, right) =>
    left.reviewedAt.localeCompare(right.reviewedAt)
      || left.artifactId.localeCompare(right.artifactId)
      || left.gateId.localeCompare(right.gateId)
  );
  return course;
};
