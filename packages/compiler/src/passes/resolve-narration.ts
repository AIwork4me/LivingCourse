import type { CompilerContext, CompilerState, ResolvedNarration } from "../types.js";

export const resolveNarrationPass = (state: CompilerState, context: CompilerContext): CompilerState => {
  const narration = new Map<string, ResolvedNarration>();
  const diagnostics = [...state.diagnostics];
  for (const [slideIndex, slide] of state.course.slides.entries()) {
    const ref = slide.narration.audioAssetRef;
    const probedDuration = ref === null ? null : context.timingProbe.durationMs(ref);
    const duration = probedDuration ?? slide.narration.approvedDurationMs;
    if (duration === null) {
      diagnostics.push({
        code: "LC-AUDIO-001",
        path: `/slides/${slideIndex}/narration/approvedDurationMs`,
        message: "Narration has no approved or probed audio duration.",
        severity: "blocking"
      });
    }
    narration.set(slide.id, {
      slideId: slide.id,
      script: slide.narration.script,
      language: slide.narration.language,
      voiceProfile: slide.narration.voiceProfile,
      audioAssetRef: ref,
      audioDurationMs: duration
    });
  }
  return { ...state, narration, diagnostics };
};
