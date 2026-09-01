import { COURSE_SPEC_VERSION } from "./version.js";

export class MigrationError extends Error {
  override readonly name = "MigrationError";
}

type JsonObject = Record<string, unknown>;
type Migration = (input: Readonly<JsonObject>) => JsonObject;

const fromV010toV020: Migration = (input) => {
  const result = structuredClone(input) as JsonObject;
  if (result.courseSpecVersion === COURSE_SPEC_VERSION) return result;
  if (result.courseSpecVersion !== "0.1.0") {
    throw new MigrationError(`Expected CourseSpec 0.1.0, received '${String(result.courseSpecVersion)}'.`);
  }
  result.courseSpecVersion = COURSE_SPEC_VERSION;
  return result;
};

export const COURSE_SPEC_MIGRATIONS: ReadonlyMap<string, { to: string; migrate: Migration }> = new Map([
  ["0.1.0", { to: COURSE_SPEC_VERSION, migrate: fromV010toV020 }]
]);

export const migrateCourseSpec = (input: unknown): JsonObject => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new MigrationError("CourseSpec migration input must be an object.");
  }
  let current = structuredClone(input as JsonObject);
  let version = current.courseSpecVersion;
  if (version === COURSE_SPEC_VERSION) return current;
  const seen = new Set<string>();
  while (version !== COURSE_SPEC_VERSION) {
    if (typeof version !== "string" || seen.has(version)) {
      throw new MigrationError(`Invalid or cyclic migration version '${String(version)}'.`);
    }
    seen.add(version);
    const step = COURSE_SPEC_MIGRATIONS.get(version);
    if (!step) throw new MigrationError(`No contiguous migration from CourseSpec '${version}'.`);
    current = step.migrate(current);
    version = current.courseSpecVersion;
    if (version !== step.to) throw new MigrationError(`Migration '${[...seen].at(-1)}' did not produce '${step.to}'.`);
  }
  return current;
};
