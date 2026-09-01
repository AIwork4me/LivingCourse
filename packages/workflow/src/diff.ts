import { canonicalJson } from "@livingcourse/core";
import type { ChangeOperation, ChangeSet } from "@livingcourse/compiler";

const escapeToken = (token: string): string => token.replace(/~/gu, "~0").replace(/\//gu, "~1");
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

const diffValue = (oldValue: unknown, newValue: unknown, pointer: string, operations: ChangeOperation[]): void => {
  if (canonicalJson(oldValue) === canonicalJson(newValue)) return;
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const common = Math.min(oldValue.length, newValue.length);
    for (let index = 0; index < common; index += 1) diffValue(oldValue[index], newValue[index], `${pointer}/${index}`, operations);
    for (let index = oldValue.length - 1; index >= newValue.length; index -= 1) operations.push({ op: "remove", path: `${pointer}/${index}`, old: oldValue[index] });
    for (let index = common; index < newValue.length; index += 1) operations.push({ op: "add", path: `${pointer}/-`, new: newValue[index] });
    return;
  }
  if (isRecord(oldValue) && isRecord(newValue)) {
    const keys = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])].sort();
    for (const key of keys) {
      const childPointer = `${pointer}/${escapeToken(key)}`;
      if (!(key in oldValue)) operations.push({ op: "add", path: childPointer, new: newValue[key] });
      else if (!(key in newValue)) operations.push({ op: "remove", path: childPointer, old: oldValue[key] });
      else diffValue(oldValue[key], newValue[key], childPointer, operations);
    }
    return;
  }
  operations.push({ op: "replace", path: pointer, old: oldValue, new: newValue });
};

export const diffCourseDocuments = (oldDocument: unknown, newDocument: unknown, metadata: { id?: string; reason?: string; requestedBy?: string } = {}): ChangeSet => {
  const operations: ChangeOperation[] = [];
  diffValue(oldDocument, newDocument, "", operations);
  return {
    id: metadata.id ?? "generated-change-set",
    operations,
    reason: metadata.reason ?? "Deterministic CourseSpec diff",
    requestedBy: metadata.requestedBy ?? "livingcourse-cli",
    requestedAt: new Date().toISOString()
  };
};
