import type { CompilerContext, CompilerState, ResolvedNarration } from "../types.js";
import { normalizeNarrationTiming } from "../narration-timing.js";

export const resolveNarrationPass = (state: CompilerState, context: CompilerContext): CompilerState => {
  const narration = new Map<string, ResolvedNarration>();
  const diagnostics = [...state.diagnostics];
  for (const [slideIndex, slide] of state.course.slides.entries()) {
    const ref = slide.narration.audioAssetRef;
    const probedDuration = ref === null ? null : context.timingProbe.durationMs(ref);
    const duration = probedDuration ?? slide.narration.approvedDurationMs;
    const probedTiming = ref === null ? null : context.timingProbe.narrationTiming?.(ref) ?? null;
    const timingResolution = normalizeNarrationTiming(slide.narration.script, duration ?? 0, probedTiming);
    if (duration === null) {
      diagnostics.push({
        code: "LC-AUDIO-001",
        path: `/slides/${slideIndex}/narration/approvedDurationMs`,
        message: "Narration has no approved or probed audio duration.",
        severity: "blocking"
      });
    }
    if (timingResolution.rejectedProviderTiming) {
      diagnostics.push({
        code: "LC-AUDIO-TIMING-001",
        path: `/slides/${slideIndex}/narration`,
        message: "Narration timing metadata is invalid; explicit estimated fallback is in use.",
        severity: "warning"
      });
    }
    if (timingResolution.timing.quality === "estimated") {
      diagnostics.push({
        code: "LC-AVSYNC-001",
        path: `/slides/${slideIndex}/narration`,
        message: "Narration timing is estimated linearly and requires human AV synchronization review.",
        severity: "warning"
      });
    }
    narration.set(slide.id, {
      slideId: slide.id,
      script: slide.narration.script,
      language: slide.narration.language,
      voiceProfile: slide.narration.voiceProfile,
      audioAssetRef: ref,
      audioDurationMs: duration,
      timing: timingResolution.timing
    });
  }
  return { ...state, narration, diagnostics };
};
