export interface FirewallIssue {
  stage: "extract" | "repair" | "parse" | "normalize" | "schema" | "business";
  message: string;
}

export type CandidateValidator<T> = (value: unknown) => { valid: boolean; value?: T; errors: string[] };

export interface FirewallOptions<T> {
  normalize: (value: T) => T;
  validateSchema: CandidateValidator<T>;
  validateBusiness: (value: T) => string[];
}

export interface FirewallResult<T> {
  accepted: boolean;
  value: T | null;
  issues: FirewallIssue[];
  repairedSyntax: boolean;
}

export const extractJson = (raw: string): string => {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1];
  const candidate = (fenced ?? raw).trim().replace(/^\uFEFF/u, "");
  const objectStart = candidate.indexOf("{");
  const arrayStart = candidate.indexOf("[");
  const startCandidates = [objectStart, arrayStart].filter((index) => index >= 0);
  if (startCandidates.length === 0) throw new Error("No JSON object or array found.");
  const start = Math.min(...startCandidates);
  const objectEnd = candidate.lastIndexOf("}");
  const arrayEnd = candidate.lastIndexOf("]");
  const end = Math.max(objectEnd, arrayEnd);
  if (end < start) throw new Error("JSON candidate has no closing delimiter.");
  return candidate.slice(start, end + 1);
};

export const repairJsonSyntax = (candidate: string): string => candidate
  .replace(/[“”]/gu, "\"")
  .replace(/[‘’]/gu, "'")
  .replace(/,\s*([}\]])/gu, "$1");

export const runAiOutputFirewall = <T>(raw: string, options: FirewallOptions<T>): FirewallResult<T> => {
  const issues: FirewallIssue[] = [];
  let extracted: string;
  try {
    extracted = extractJson(raw);
  } catch (error) {
    return { accepted: false, value: null, issues: [{ stage: "extract", message: (error as Error).message }], repairedSyntax: false };
  }
  const repaired = repairJsonSyntax(extracted);
  let parsed: unknown;
  try {
    parsed = JSON.parse(repaired) as unknown;
  } catch (error) {
    return { accepted: false, value: null, issues: [{ stage: "parse", message: (error as Error).message }], repairedSyntax: repaired !== extracted };
  }
  const schema = options.validateSchema(parsed);
  if (!schema.valid || schema.value === undefined) {
    issues.push(...schema.errors.map((message) => ({ stage: "schema" as const, message })));
    return { accepted: false, value: null, issues, repairedSyntax: repaired !== extracted };
  }
  const normalized = options.normalize(schema.value);
  const businessErrors = options.validateBusiness(normalized);
  if (businessErrors.length) {
    issues.push(...businessErrors.map((message) => ({ stage: "business" as const, message })));
    return { accepted: false, value: null, issues, repairedSyntax: repaired !== extracted };
  }
  return { accepted: true, value: normalized, issues, repairedSyntax: repaired !== extracted };
};
