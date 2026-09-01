import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COURSE_SPEC_VERSION, migrateCourseSpec, validateCourseSpec, type CourseSpec } from "@livingcourse/core";
import { compileCourse } from "@livingcourse/compiler";

const fixturePath = fileURLToPath(new URL("../fixtures/golden-v0.1/course-spec.json", import.meta.url));

describe("CourseSpec intent and resolved plan boundary", () => {
  it("automatically migrates the unchanged v0.2 Golden CourseSpec", async () => {
    const legacy = JSON.parse(await readFile(fixturePath, "utf8")) as CourseSpec;
    expect(legacy.courseSpecVersion).toBe("0.2.0");
    expect(validateCourseSpec(legacy)).toEqual({ valid: true, errors: [] });
    const migrated = migrateCourseSpec(legacy);
    expect(migrated.courseSpecVersion).toBe(COURSE_SPEC_VERSION);
    expect(migrateCourseSpec(migrated)).toEqual(migrated);
    expect(compileCourse(legacy).courseSpec.courseSpecVersion).toBe(COURSE_SPEC_VERSION);
  });

  it("resolves complete layout and motion decisions from minimal intent", async () => {
    const legacy = JSON.parse(await readFile(fixturePath, "utf8")) as CourseSpec;
    const minimal = migrateCourseSpec(legacy) as unknown as CourseSpec;
    for (const slide of minimal.slides) {
      delete slide.presentation.layout.regions;
      delete slide.presentation.layout.readingOrder;
      delete slide.presentation.layout.safeAreas;
      for (const motion of slide.presentation.motionIntent) {
        delete motion.atMs;
        delete motion.durationMs;
      }
    }
    expect(validateCourseSpec(minimal)).toEqual({ valid: true, errors: [] });
    const output = compileCourse(minimal);
    for (const [index, slide] of output.presentationPlan.slides.entries()) {
      expect(Object.keys(slide.geometry)).toHaveLength(slide.elements.length);
      expect(slide.readingOrder).toHaveLength(slide.elements.length);
      expect(slide.safeAreas.length).toBeGreaterThan(0);
      expect(output.courseSpec.slides[index]?.presentation.layout.regions).toBeUndefined();
    }
    expect(output.videoPlan.slides.flatMap((slide) => slide.motions).every((motion) => motion.atMs >= 0 && motion.durationMs > 0)).toBe(true);
  });
});
