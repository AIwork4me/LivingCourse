import courseSpecSchema from "./schema/course-spec.schema.json" with { type: "json" };
import { COURSE_SPEC_SCHEMA_ID } from "./version.js";

export { courseSpecSchema };

export const COURSE_SPEC_JSON_SCHEMA = {
  ...courseSpecSchema,
  $id: COURSE_SPEC_SCHEMA_ID
} as const;
