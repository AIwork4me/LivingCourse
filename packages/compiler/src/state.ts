import type { CourseSpec } from "@livingcourse/core";
import type { CompilerState } from "./types.js";

export const initialCompilerState = (course: CourseSpec): CompilerState => ({
  course,
  diagnostics: [],
  grounding: new Map(),
  assets: new Map(),
  narration: new Map(),
  elements: new Map(),
  timing: new Map(),
  cues: new Map(),
  motions: new Map()
});

export class CompilerError extends Error {
  override readonly name = "CompilerError";
  constructor(message: string, readonly state: CompilerState) {
    super(message);
  }
}
