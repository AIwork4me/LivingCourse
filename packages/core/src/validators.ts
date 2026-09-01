import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { COURSE_SPEC_JSON_SCHEMA } from "./schema.js";
import { COURSE_SPEC_SCHEMA_ID } from "./version.js";
import { migrateCourseSpec, MigrationError } from "./migrations.js";
import { evaluateReleaseEligibility } from "./policies/release-policy.js";
import type {
  CourseSpec,
  MaterialSpec,
  ReviewDecision,
  SlideSpec,
  ValidationError,
  ValidationResult
} from "./types.js";

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/u);
ajv.addFormat("date-time", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u);
ajv.addSchema(COURSE_SPEC_JSON_SCHEMA);
const courseValidator = ajv.getSchema(COURSE_SPEC_SCHEMA_ID);
const slideValidator = ajv.compile({ $ref: `${COURSE_SPEC_SCHEMA_ID}#/$defs/slideSpec` });
const materialValidator = ajv.compile({ $ref: `${COURSE_SPEC_SCHEMA_ID}#/$defs/materialSpec` });
const reviewValidator = ajv.compile({ $ref: `${COURSE_SPEC_SCHEMA_ID}#/$defs/reviewDecision` });

if (!courseValidator) throw new Error("CourseSpec JSON Schema failed to register.");

const schemaErrors = (validator: ValidateFunction): ValidationError[] =>
  (validator.errors ?? []).map((error: ErrorObject) => ({
    code: "LC-SCHEMA-001",
    path: error.instancePath || "/",
    message: error.message ?? "Schema validation failed.",
    severity: "error"
  }));

const run = (validator: ValidateFunction, value: unknown): ValidationResult => {
  const valid = validator(value) as boolean;
  const errors = valid ? [] : schemaErrors(validator);
  return { valid: errors.length === 0, errors };
};

const duplicates = (values: readonly string[]): string[] =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

export const validateMaterialSpec = (material: unknown): ValidationResult => run(materialValidator, material);
export const validateSlideSpec = (slide: unknown): ValidationResult => run(slideValidator, slide);
export const validateReviewDecision = (decision: unknown): ValidationResult => run(reviewValidator, decision);

export const validateCourseSpec = (input: unknown): ValidationResult => {
  let migrated: unknown;
  try {
    migrated = migrateCourseSpec(input);
  } catch (error) {
    return {
      valid: false,
      errors: [{ code: "LC-SCHEMA-001", path: "/courseSpecVersion", message: error instanceof MigrationError ? error.message : "CourseSpec migration failed.", severity: "error" }]
    };
  }
  const result = run(courseValidator, migrated);
  if (!result.valid) return result;
  const course = migrated as CourseSpec;
  const errors: ValidationError[] = [];
  for (const id of duplicates(course.materials.map((material: MaterialSpec) => material.id))) {
    errors.push({ code: "LC-MATERIAL-001", path: "/materials", message: `Duplicate material id '${id}'.`, severity: "error" });
  }
  for (const id of duplicates(course.slides.map((slide: SlideSpec) => slide.id))) {
    errors.push({ code: "LC-SCHEMA-002", path: "/slides", message: `Duplicate slide id '${id}'.`, severity: "error" });
  }
  const materialIds = new Set(course.materials.map((material) => material.id));
  for (const [slideIndex, slide] of course.slides.entries()) {
    if (slide.type !== slide.presentation.layout.kind) {
      errors.push({
        code: "LC-LAYOUT-001",
        path: `/slides/${slideIndex}/presentation/layout/kind`,
        message: "Slide type and layout kind must match.",
        severity: "error"
      });
    }
    for (const sourceRef of slide.grounding.sourceRefs) {
      if (!materialIds.has(sourceRef)) {
        errors.push({
          code: "LC-GROUNDING-003",
          path: `/slides/${slideIndex}/grounding/sourceRefs`,
          message: `Unknown material reference '${sourceRef}'.`,
          severity: "error"
        });
      }
    }
    for (const [itemIndex, item] of slide.knowledge.items.entries()) {
      for (const sourceRef of item.sourceRefs) {
        if (!materialIds.has(sourceRef)) {
          errors.push({
            code: "LC-GROUNDING-003",
            path: `/slides/${slideIndex}/knowledge/items/${itemIndex}/sourceRefs`,
            message: `Unknown material reference '${sourceRef}'.`,
            severity: "error"
          });
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
};

export const validateReleaseEligibility = (course: CourseSpec): ValidationResult => evaluateReleaseEligibility(course);

export type { CourseSpec, MaterialSpec, ReviewDecision, SlideSpec };
