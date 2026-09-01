import type {
  NarrationTimingProbeResult,
  NarrationTimingSegment,
  NormalizedNarrationTiming
} from "./types.js";

export const semanticCaptionChunks = (script: string, max = 18): string[] => {
  const compact = script.replace(/\s+/gu, "").trim();
  const sentences = compact.match(/[^。！？；，、]+[。！？；，、]?/gu) ?? [compact];
  const result: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= max) result.push(sentence);
    else for (let offset = 0; offset < sentence.length; offset += max) result.push(sentence.slice(offset, offset + max));
  }
  return result.filter(Boolean);
};

const validSegments = (segments: readonly NarrationTimingSegment[], durationMs: number): boolean => {
  let previousStart = -1;
  return segments.length > 0 && segments.every((segment) => {
    const valid = segment.text.length > 0
      && Number.isFinite(segment.startMs)
      && Number.isFinite(segment.endMs)
      && segment.startMs >= 0
      && segment.endMs > segment.startMs
      && segment.endMs <= durationMs
      && segment.startMs >= previousStart;
    previousStart = segment.startMs;
    return valid;
  });
};

export const validNarrationTimingProbeResult = (input: NarrationTimingProbeResult): boolean =>
  Number.isFinite(input.audioDurationMs)
  && input.audioDurationMs > 0
  && validSegments(input.sentenceSegments, input.audioDurationMs)
  && (input.characterSegments === undefined || validSegments(input.characterSegments, input.audioDurationMs));

const scaleSegments = (segments: readonly NarrationTimingSegment[], scaleFactor: number): NarrationTimingSegment[] =>
  segments.map((segment) => ({
    text: segment.text,
    startMs: Math.round(segment.startMs * scaleFactor),
    endMs: Math.round(segment.endMs * scaleFactor)
  }));

const estimatedTiming = (script: string, audioDurationMs: number): NormalizedNarrationTiming => {
  const parts = semanticCaptionChunks(script);
  const totalCharacters = Math.max(1, parts.reduce((sum, part) => sum + part.length, 0));
  let consumed = 0;
  const sentenceSegments = parts.map((text) => {
    const startMs = Math.round(audioDurationMs * consumed / totalCharacters);
    consumed += text.length;
    return { text, startMs, endMs: Math.round(audioDurationMs * consumed / totalCharacters) };
  });
  return {
    audioDurationMs,
    timingSourceDurationMs: audioDurationMs,
    scaleFactor: 1,
    sentenceSegments,
    rawTiming: null,
    method: "estimated_linear",
    quality: "estimated",
    requiresHumanAvSyncReview: true
  };
};

export const normalizeNarrationTiming = (
  script: string,
  approvedAudioDurationMs: number,
  input: NarrationTimingProbeResult | null
): { timing: NormalizedNarrationTiming; rejectedProviderTiming: boolean } => {
  if (!input || !validNarrationTimingProbeResult(input)) {
    return { timing: estimatedTiming(script, approvedAudioDurationMs), rejectedProviderTiming: input !== null };
  }
  const aligned = input.method === "provider_aligned" && input.audioDurationMs === approvedAudioDurationMs;
  const scaleFactor = aligned ? 1 : approvedAudioDurationMs / input.audioDurationMs;
  return {
    timing: {
      audioDurationMs: approvedAudioDurationMs,
      timingSourceDurationMs: input.audioDurationMs,
      scaleFactor,
      sentenceSegments: scaleSegments(input.sentenceSegments, scaleFactor),
      ...(input.characterSegments === undefined ? {} : { characterSegments: scaleSegments(input.characterSegments, scaleFactor) }),
      rawTiming: structuredClone(input),
      method: aligned ? "provider_aligned" : "duration_normalized_provider_timing",
      quality: aligned ? "aligned" : "normalized",
      requiresHumanAvSyncReview: false
    },
    rejectedProviderTiming: false
  };
};

const ignoredForMatch = /[\s。！？；，、,.!?;:：]/u;

const timeline = (segments: readonly NarrationTimingSegment[]): { text: string; segmentByCharacter: number[] } => {
  let text = "";
  const segmentByCharacter: number[] = [];
  for (const [segmentIndex, timingSegment] of segments.entries()) {
    for (const character of timingSegment.text) {
      if (ignoredForMatch.test(character)) continue;
      text += character;
      segmentByCharacter.push(segmentIndex);
    }
  }
  return { text, segmentByCharacter };
};

export const normalizeTimingText = (value: string): string =>
  [...value].filter((character) => !ignoredForMatch.test(character)).join("");

export const phraseOccurrences = (script: string, phrase: string): number[] => {
  const occurrences: number[] = [];
  let offset = 0;
  while (offset <= script.length - phrase.length) {
    const found = script.indexOf(phrase, offset);
    if (found < 0) break;
    occurrences.push(found);
    offset = found + Math.max(1, phrase.length);
  }
  return occurrences;
};

export const locatePhraseTiming = (
  phrase: string,
  occurrence: number,
  segments: readonly NarrationTimingSegment[]
): { startMs: number; endMs: number } | null => {
  const built = timeline(segments);
  const needle = normalizeTimingText(phrase);
  if (!needle) return null;
  let cursor = 0;
  let found = -1;
  for (let index = 0; index < occurrence; index += 1) {
    found = built.text.indexOf(needle, cursor);
    if (found < 0) return null;
    cursor = found + needle.length;
  }
  const startSegment = built.segmentByCharacter[found];
  const endSegment = built.segmentByCharacter[found + needle.length - 1];
  if (startSegment === undefined || endSegment === undefined) return null;
  return { startMs: segments[startSegment]?.startMs ?? 0, endMs: segments[endSegment]?.endMs ?? 0 };
};

export const locateCaptionTimings = (
  captions: readonly string[],
  segments: readonly NarrationTimingSegment[]
): Array<{ startMs: number; endMs: number } | null> => {
  const built = timeline(segments);
  let cursor = 0;
  return captions.map((caption) => {
    const needle = normalizeTimingText(caption);
    if (!needle) return null;
    const found = built.text.indexOf(needle, cursor);
    if (found < 0) return null;
    cursor = found + needle.length;
    const startSegment = built.segmentByCharacter[found];
    const endSegment = built.segmentByCharacter[cursor - 1];
    if (startSegment === undefined || endSegment === undefined) return null;
    return { startMs: segments[startSegment]?.startMs ?? 0, endMs: segments[endSegment]?.endMs ?? 0 };
  });
};
