import { canonicalJson, validateCourseSpec, type CourseSpec } from "@livingcourse/core";

export type ChangeOperation =
  | { op: "add"; path: string; new: unknown }
  | { op: "remove"; path: string; old: unknown }
  | { op: "replace"; path: string; old: unknown; new: unknown };

export interface ChangeSet {
  id: string;
  operations: ChangeOperation[];
  reason: string;
  requestedBy: string;
  requestedAt: string;
}

export class ChangeSetError extends Error {
  override readonly name = "ChangeSetError";
  constructor(readonly code: "LC-CHANGE-001" | "LC-CHANGE-002" | "LC-CHANGE-003", message: string) {
    super(message);
  }
}

const tokens = (pointer: string): string[] => {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new ChangeSetError("LC-CHANGE-002", `Invalid JSON Pointer '${pointer}'.`);
  return pointer.slice(1).split("/").map((token) => token.replace(/~1/gu, "/").replace(/~0/gu, "~"));
};

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

const child = (parent: unknown, token: string, path: string): unknown => {
  if (Array.isArray(parent)) {
    const index = Number(token);
    if (!Number.isInteger(index) || index < 0 || index >= parent.length) throw new ChangeSetError("LC-CHANGE-002", `Array path '${path}' does not exist.`);
    return parent[index];
  }
  if (!isRecord(parent) || !(token in parent)) throw new ChangeSetError("LC-CHANGE-002", `Object path '${path}' does not exist.`);
  return parent[token];
};

export const valueAtPointer = (document: unknown, pointer: string): unknown =>
  tokens(pointer).reduce((current, token) => child(current, token, pointer), document);

const mutateAtPointer = (document: unknown, operation: ChangeOperation): void => {
  const parts = tokens(operation.path);
  if (parts.length === 0) throw new ChangeSetError("LC-CHANGE-002", "Root replacement is not supported by the smallest-patch contract.");
  const leaf = parts.at(-1);
  if (leaf === undefined) throw new ChangeSetError("LC-CHANGE-002", `Invalid path '${operation.path}'.`);
  const parent = parts.slice(0, -1).reduce((current, token) => child(current, token, operation.path), document);
  if (operation.op !== "add") {
    const actual = child(parent, leaf, operation.path);
    if (canonicalJson(actual) !== canonicalJson(operation.old)) {
      throw new ChangeSetError("LC-CHANGE-001", `Stale patch at '${operation.path}': expected old value ${canonicalJson(operation.old)}, received ${canonicalJson(actual)}.`);
    }
  }
  if (Array.isArray(parent)) {
    if (operation.op === "add") {
      const index = leaf === "-" ? parent.length : Number(leaf);
      if (!Number.isInteger(index) || index < 0 || index > parent.length) throw new ChangeSetError("LC-CHANGE-002", `Invalid add index '${leaf}'.`);
      parent.splice(index, 0, structuredClone(operation.new));
    } else if (operation.op === "remove") {
      parent.splice(Number(leaf), 1);
    } else {
      parent[Number(leaf)] = structuredClone(operation.new);
    }
    return;
  }
  if (!isRecord(parent)) throw new ChangeSetError("LC-CHANGE-002", `Parent for '${operation.path}' is not an object or array.`);
  if (operation.op === "add") {
    if (leaf in parent) throw new ChangeSetError("LC-CHANGE-002", `Add target '${operation.path}' already exists.`);
    parent[leaf] = structuredClone(operation.new);
  } else if (operation.op === "remove") {
    delete parent[leaf];
  } else {
    parent[leaf] = structuredClone(operation.new);
  }
};

export const applyChangeSet = <T>(document: T, changeSet: ChangeSet): T => {
  const next = structuredClone(document);
  for (const operation of changeSet.operations) mutateAtPointer(next, operation);
  return next;
};

export const applyCourseSpecChangeSet = (course: CourseSpec, changeSet: ChangeSet): CourseSpec => {
  const next = applyChangeSet(course, changeSet);
  const validation = validateCourseSpec(next);
  if (!validation.valid) {
    throw new ChangeSetError("LC-CHANGE-003", `Patched CourseSpec is invalid: ${validation.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join("; ")}`);
  }
  return next;
};
