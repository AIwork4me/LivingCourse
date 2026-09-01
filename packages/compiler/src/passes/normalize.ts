import { normalizeCourseSpec } from "@livingcourse/core";
import type { CompilerState } from "../types.js";

export const normalizePass = (state: CompilerState): CompilerState => ({
  ...state,
  course: normalizeCourseSpec(state.course)
});
