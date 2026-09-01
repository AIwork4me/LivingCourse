import { validateCourseSpec } from "@livingcourse/core";
import { CompilerError } from "../state.js";
import type { CompilerState } from "../types.js";

export const validatePass = (state: CompilerState): CompilerState => {
  const result = validateCourseSpec(state.course);
  if (result.valid) return state;
  const next = { ...state, diagnostics: [...state.diagnostics, ...result.errors] };
  throw new CompilerError("CourseSpec validation failed.", next);
};
