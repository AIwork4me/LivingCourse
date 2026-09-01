import type { CompilerState, CaptionCue, ResolvedCue } from "../types.js";
import { resolvePresentationTargetId } from "../element-ids.js";
import { locateCaptionTimings, locatePhraseTiming, phraseOccurrences, semanticCaptionChunks } from "../narration-timing.js";

export const resolveCuesPass = (state: CompilerState): CompilerState => {
  const resolved = new Map<string, { cues: ResolvedCue[]; captions: CaptionCue[] }>();
  const diagnostics = [...state.diagnostics];
  for (const [slideIndex, slide] of state.course.slides.entries()) {
    const narration = state.narration.get(slide.id);
    const timing = state.timing.get(slide.id);
    const duration = narration?.audioDurationMs ?? 0;
    const script = narration?.script ?? "";
    const narrationTiming = narration?.timing;
    const cueItems: ResolvedCue[] = slide.narration.cues.flatMap((cue, cueIndex) => {
      const occurrences = phraseOccurrences(script, cue.phrase);
      if (occurrences.length === 0) {
        diagnostics.push({ code: "LC-CUE-001", path: `/slides/${slideIndex}/narration/cues/${cueIndex}/phrase`, message: `Cue phrase '${cue.phrase}' does not occur in narration.`, severity: "warning" });
        return [];
      }
      if (occurrences.length > 1 && cue.occurrence === undefined) {
        diagnostics.push({ code: "LC-CUE-002", path: `/slides/${slideIndex}/narration/cues/${cueIndex}/occurrence`, message: `Cue phrase '${cue.phrase}' is ambiguous; provide occurrence.`, severity: "warning" });
        return [];
      }
      const occurrence = cue.occurrence ?? 1;
      const scriptIndex = occurrences[occurrence - 1];
      if (scriptIndex === undefined) {
        diagnostics.push({ code: "LC-CUE-002", path: `/slides/${slideIndex}/narration/cues/${cueIndex}/occurrence`, message: `Cue occurrence ${occurrence} is outside the ${occurrences.length} match(es).`, severity: "warning" });
        return [];
      }
      let relativeAtMs: number;
      let timingQuality = narrationTiming?.quality ?? "estimated";
      if (!narrationTiming || narrationTiming.quality === "estimated") {
        relativeAtMs = Math.round(duration * scriptIndex / Math.max(1, script.length));
      } else {
        const segments = narrationTiming.characterSegments ?? narrationTiming.sentenceSegments;
        const located = locatePhraseTiming(cue.phrase, occurrence, segments);
        if (located) relativeAtMs = located.startMs;
        else {
          relativeAtMs = Math.round(duration * scriptIndex / Math.max(1, script.length));
          timingQuality = "estimated";
          diagnostics.push({ code: "LC-CUE-003", path: `/slides/${slideIndex}/narration/cues/${cueIndex}`, message: `Cue phrase '${cue.phrase}' could not be resolved from supplied timing; explicit estimated fallback is in use.`, severity: "warning" });
        }
      }
      return [{
        id: cue.id,
        atMs: (timing?.audioStartMs ?? 0) + relativeAtMs,
        targetIds: cue.targetIds.map((targetId) => resolvePresentationTargetId(slide, targetId)),
        timingQuality
      }];
    });
    const captionChunks = semanticCaptionChunks(script);
    const totalCharacters = Math.max(1, captionChunks.reduce((sum, part) => sum + part.length, 0));
    const suppliedCaptionTimings = narrationTiming && narrationTiming.quality !== "estimated"
      ? locateCaptionTimings(captionChunks, narrationTiming.characterSegments ?? narrationTiming.sentenceSegments)
      : captionChunks.map(() => null);
    let consumed = 0;
    const captions: CaptionCue[] = captionChunks.map((text, index) => {
      const estimatedStart = Math.round(duration * consumed / totalCharacters);
      consumed += text.length;
      const estimatedEnd = Math.round(duration * consumed / totalCharacters);
      const supplied = suppliedCaptionTimings[index];
      const timingQuality = supplied ? narrationTiming?.quality ?? "estimated" : "estimated";
      if (narrationTiming && narrationTiming.quality !== "estimated" && !supplied) {
        diagnostics.push({ code: "LC-CAPTION-001", path: `/slides/${slideIndex}/narration`, message: `Caption '${text}' could not be resolved from supplied timing; explicit estimated fallback is in use.`, severity: "warning" });
      }
      return {
        id: `${slide.id}-caption-${String(index + 1).padStart(2, "0")}`,
        startMs: (timing?.audioStartMs ?? 0) + (supplied?.startMs ?? estimatedStart),
        endMs: (timing?.audioStartMs ?? 0) + (supplied?.endMs ?? estimatedEnd),
        text,
        maxLines: 2,
        timingQuality
      };
    });
    resolved.set(slide.id, { cues: cueItems, captions });
  }
  return { ...state, cues: resolved, diagnostics };
};
