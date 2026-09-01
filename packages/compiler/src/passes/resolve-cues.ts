import type { CompilerState, CaptionCue, ResolvedCue } from "../types.js";

const chunks = (script: string, max = 18): string[] => {
  const compact = script.replace(/\s+/gu, "").trim();
  const sentences = compact.match(/[^。！？；，、]+[。！？；，、]?/gu) ?? [compact];
  const result: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= max) result.push(sentence);
    else for (let offset = 0; offset < sentence.length; offset += max) result.push(sentence.slice(offset, offset + max));
  }
  return result.filter(Boolean);
};

export const resolveCuesPass = (state: CompilerState): CompilerState => {
  const resolved = new Map<string, { cues: ResolvedCue[]; captions: CaptionCue[] }>();
  for (const slide of state.course.slides) {
    const narration = state.narration.get(slide.id);
    const timing = state.timing.get(slide.id);
    const duration = narration?.audioDurationMs ?? 0;
    const script = narration?.script ?? "";
    const cueItems: ResolvedCue[] = slide.narration.cues.map((cue) => {
      const index = Math.max(0, script.indexOf(cue.phrase));
      return {
        id: cue.id,
        atMs: timing?.audioStartMs === undefined ? 0 : timing.audioStartMs + Math.round(duration * index / Math.max(1, script.length)),
        targetIds: [...cue.targetIds]
      };
    });
    const captionChunks = chunks(script);
    const totalCharacters = Math.max(1, captionChunks.reduce((sum, part) => sum + part.length, 0));
    let consumed = 0;
    const captions: CaptionCue[] = captionChunks.map((text, index) => {
      const start = Math.round(duration * consumed / totalCharacters) + (timing?.audioStartMs ?? 0);
      consumed += text.length;
      const end = Math.round(duration * consumed / totalCharacters) + (timing?.audioStartMs ?? 0);
      return { id: `${slide.id}-caption-${String(index + 1).padStart(2, "0")}`, startMs: start, endMs: end, text, maxLines: 2 };
    });
    resolved.set(slide.id, { cues: cueItems, captions });
  }
  return { ...state, cues: resolved };
};
