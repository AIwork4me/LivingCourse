import type { CourseSpec } from "@livingcourse/core";
import { createCompilerContext } from "./context.js";
import { assemblePass } from "./passes/assemble.js";
import { normalizePass } from "./passes/normalize.js";
import { resolveAssetsPass } from "./passes/resolve-assets.js";
import { resolveCuesPass } from "./passes/resolve-cues.js";
import { resolveGroundingPass } from "./passes/resolve-grounding.js";
import { resolveLayoutPass } from "./passes/resolve-layout.js";
import { resolveMotionPass } from "./passes/resolve-motion.js";
import { resolveNarrationPass } from "./passes/resolve-narration.js";
import { resolveTimingPass } from "./passes/resolve-timing.js";
import { validatePass } from "./passes/validate.js";
import { initialCompilerState } from "./state.js";
import type { CompilerContext, CompilerOutput } from "./types.js";

export const compileCourse = (course: CourseSpec, providedContext: Partial<CompilerContext> = {}): CompilerOutput => {
  const context = createCompilerContext(providedContext);
  let state = initialCompilerState(course);
  state = normalizePass(state);
  state = validatePass(state);
  state = resolveGroundingPass(state);
  state = resolveAssetsPass(state, context);
  state = resolveNarrationPass(state, context);
  state = resolveLayoutPass(state);
  state = resolveTimingPass(state, context);
  state = resolveCuesPass(state);
  state = resolveMotionPass(state);
  return assemblePass(state, context);
};
