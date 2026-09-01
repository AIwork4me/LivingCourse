import type { CompilerContext, CompilerState, ResolvedTiming } from "../types.js";

export const resolveTimingPass = (state: CompilerState, context: CompilerContext): CompilerState => {
  const timing = new Map<string, ResolvedTiming>();
  let globalStartFrames = 0;
  const ordered = [...state.course.slides].sort((left, right) => left.order - right.order);
  for (const [index, slide] of ordered.entries()) {
    const narration = state.narration.get(slide.id);
    const audioDurationMs = narration?.audioDurationMs ?? null;
    const rawDuration = (audioDurationMs ?? 0) + context.narrationStartOffsetMs + context.narrationTailPaddingMs;
    const durationFrames = Math.max(1, Math.ceil(rawDuration * context.fps / 1000));
    const hasNext = index < ordered.length - 1;
    const transitionFrames = hasNext ? Math.round(context.transitionMs * context.fps / 1000) : 0;
    const resolved: ResolvedTiming = {
      slideId: slide.id,
      globalStartMs: Math.round(globalStartFrames * 1000 / context.fps),
      durationMs: Math.round(durationFrames * 1000 / context.fps),
      durationFrames,
      audioStartMs: context.narrationStartOffsetMs,
      audioDurationMs,
      transitionMs: Math.round(transitionFrames * 1000 / context.fps),
      transitionFrames
    };
    timing.set(slide.id, resolved);
    globalStartFrames += durationFrames - transitionFrames;
  }
  return { ...state, timing };
};
