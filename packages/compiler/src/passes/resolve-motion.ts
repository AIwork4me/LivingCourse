import type { CompilerState, VideoMotion } from "../types.js";

export const resolveMotionPass = (state: CompilerState): CompilerState => {
  const motions = new Map<string, VideoMotion[]>();
  for (const slide of state.course.slides) {
    const cueByTarget = new Map((state.cues.get(slide.id)?.cues ?? []).flatMap((cue) => cue.targetIds.map((target) => [target, cue.atMs] as const)));
    motions.set(slide.id, slide.presentation.motionIntent.map((motion) => ({
      id: motion.id,
      targetIds: [...motion.targetIds],
      action: motion.action,
      atMs: motion.targetIds.map((target) => cueByTarget.get(target)).find((value) => value !== undefined) ?? motion.atMs ?? 0,
      durationMs: motion.durationMs ?? 500,
      ...(motion.intensity === undefined ? {} : { intensity: motion.intensity })
    })));
  }
  return { ...state, motions };
};
