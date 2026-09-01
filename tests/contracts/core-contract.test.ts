import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  COURSE_SPEC_MIGRATIONS,
  COURSE_SPEC_VERSION,
  canonicalJson,
  migrateCourseSpec,
  normalizeCourseSpec,
  validateCourseSpec,
  validateReleaseEligibility,
  validateReviewDecision,
  validateStateTransition,
  type CourseSpec
} from "@livingcourse/core";

const fixturePath = fileURLToPath(new URL("../fixtures/golden-v0.1/course-spec.json", import.meta.url));
const loadFixture = async (): Promise<CourseSpec> => JSON.parse(await readFile(fixturePath, "utf8")) as CourseSpec;

describe("M0 CourseSpec contract", () => {
  it("validates the Golden v0.1 CourseSpec and collects schema errors", async () => {
    const fixture = await loadFixture();
    expect(validateCourseSpec(fixture)).toEqual({ valid: true, errors: [] });
    const invalid = structuredClone(fixture) as unknown as { course: { title?: string }; slides: unknown[] };
    delete invalid.course.title;
    invalid.slides.push({});
    const result = validateCourseSpec(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors.every((error) => error.code === "LC-SCHEMA-001")).toBe(true);
  });

  it("normalizes deterministically without changing facts", async () => {
    const fixture = await loadFixture();
    const once = normalizeCourseSpec(fixture);
    const twice = normalizeCourseSpec(once);
    expect(canonicalJson(twice)).toBe(canonicalJson(once));
    expect(once.slides[1]?.knowledge.items[2]?.text).toBe("护目镜与防护面罩");
    expect(once.slides[2]?.grounding.verified).toBe(false);
  });

  it("has a contiguous, deterministic and idempotent migration ladder", async () => {
    const fixture = await loadFixture();
    const legacy = { ...fixture, courseSpecVersion: "0.1.0" };
    expect(COURSE_SPEC_MIGRATIONS.get("0.1.0")?.to).toBe("0.2.0");
    expect(COURSE_SPEC_MIGRATIONS.get("0.2.0")?.to).toBe(COURSE_SPEC_VERSION);
    const migrated = migrateCourseSpec(legacy);
    expect(migrated.courseSpecVersion).toBe(COURSE_SPEC_VERSION);
    expect(migrateCourseSpec(migrated)).toEqual(migrated);
    expect(() => migrateCourseSpec({ courseSpecVersion: "0.0.9" })).toThrow(/No contiguous migration/);
  });

  it("uses machine-readable review decisions", async () => {
    const fixture = await loadFixture();
    expect(validateReviewDecision(fixture.governance.reviewDecisions[0])).toEqual({ valid: true, errors: [] });
  });

  it("hard-fails illegal state transitions", () => {
    expect(validateStateTransition("candidate", "approved_for_release").valid).toBe(false);
    expect(validateStateTransition("candidate", "normalized").valid).toBe(true);
  });

  it("blocks synthetic and unresolved content from production release", async () => {
    const fixture = await loadFixture();
    const result = validateReleaseEligibility(fixture);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "LC-RELEASE-001")).toBe(true);
    expect(result.errors.some((error) => error.code === "LC-GROUNDING-002")).toBe(true);
  });

  it("keeps the serialized contract provider-neutral", async () => {
    const fixture = await loadFixture();
    const schema = await readFile(fileURLToPath(new URL("../../packages/core/src/schema/course-spec.schema.json", import.meta.url)), "utf8");
    const serialized = `${JSON.stringify(fixture)}\n${schema}`.toLowerCase();
    for (const forbidden of ["minimax", "speech-2.8-hd", "male-qn-qingse", "remotion", "react", "ffmpeg", "pptxgenjs", "openai_"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
