import type { CompilerState } from "../types.js";

export const resolveGroundingPass = (state: CompilerState): CompilerState => ({
  ...state,
  grounding: new Map(state.course.slides.map((slide) => [slide.id, structuredClone(slide.grounding)]))
});
