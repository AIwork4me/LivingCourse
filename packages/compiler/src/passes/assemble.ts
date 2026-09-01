import { canonicalJson, sha256 } from "@livingcourse/core";
import type {
  BuildPlan,
  BuildPlanItem,
  CompilerContext,
  CompilerOutput,
  CompilerState,
  PresentationPlan,
  PresentationSlidePlan,
  VideoPlan,
  VideoSlidePlan
} from "../types.js";

const item = (id: string, kind: BuildPlanItem["kind"], slideId: string | null, reason: string, input: unknown): BuildPlanItem => ({
  id, kind, slideId, reason, fingerprint: sha256(input)
});

export const assemblePass = (state: CompilerState, context: CompilerContext): CompilerOutput => {
  const presentationSlides: PresentationSlidePlan[] = state.course.slides.map((slide) => {
    const elements = state.elements.get(slide.id) ?? [];
    return {
      slideId: slide.id,
      layout: slide.presentation.layout.kind,
      nativeText: elements.filter((element) => element.text !== undefined).map((element) => element.text ?? ""),
      elements,
      assetRefs: elements.flatMap((element) => element.assetRef === undefined ? [] : [element.assetRef]),
      geometry: structuredClone(slide.presentation.layout.regions),
      readingOrder: [...slide.presentation.layout.readingOrder],
      speakerNotes: slide.narration.script,
      safeAreas: structuredClone(slide.presentation.layout.safeAreas),
      releaseScope: slide.grounding.releaseScope
    };
  });
  const presentationBase = {
    version: "0.1.0" as const,
    courseId: state.course.course.id,
    title: state.course.course.title,
    aspectRatio: state.course.course.aspectRatio,
    slides: presentationSlides
  };
  const presentationPlan: PresentationPlan = { ...presentationBase, contentHash: sha256(presentationBase) };

  const videoSlides: VideoSlidePlan[] = state.course.slides.map((slide, index) => {
    const timing = state.timing.get(slide.id);
    if (!timing) throw new Error(`Missing resolved timing for '${slide.id}'.`);
    const cueState = state.cues.get(slide.id) ?? { cues: [], captions: [] };
    return {
      slideId: slide.id,
      globalStartMs: timing.globalStartMs,
      durationMs: timing.durationMs,
      audio: {
        assetRef: slide.narration.audioAssetRef,
        startMs: timing.audioStartMs,
        durationMs: timing.audioDurationMs
      },
      captions: cueState.captions,
      cues: cueState.cues,
      motions: state.motions.get(slide.id) ?? [],
      transition: { kind: index < state.course.slides.length - 1 ? "crossfade" : "none", durationMs: timing.transitionMs },
      assets: state.assets.get(slide.id) ?? [],
      layers: state.elements.get(slide.id) ?? [],
      disclosures: slide.knowledge.disclosure === undefined ? [] : [slide.knowledge.disclosure],
      releaseScope: slide.grounding.releaseScope
    };
  });
  const durationFrames = videoSlides.reduce((maximum, slide) => Math.max(maximum, Math.round((slide.globalStartMs + slide.durationMs) * context.fps / 1000)), 0);
  const videoBase = {
    version: "0.1.0" as const,
    courseId: state.course.course.id,
    title: state.course.course.title,
    width: 1280 as const,
    height: 720 as const,
    fps: context.fps,
    durationMs: Math.round(durationFrames * 1000 / context.fps),
    durationFrames,
    captionStyle: { color: "#000000" as const, background: "transparent" as const, border: "none" as const, maxLines: 2 as const },
    slides: videoSlides
  };
  const videoPlan: VideoPlan = { ...videoBase, contentHash: sha256(videoBase) };

  const reuse: BuildPlanItem[] = [];
  const regenerate: BuildPlanItem[] = [];
  const blocked: BuildPlanItem[] = [];
  for (const slide of state.course.slides) {
    for (const asset of state.assets.get(slide.id) ?? []) {
      if (asset.assetRef === null || !asset.exists) {
        blocked.push(item(`asset:${asset.id}`, "visual", slide.id, "Required asset is unresolved.", asset));
      } else if (asset.approved) {
        reuse.push(item(`asset:${asset.id}`, "visual", slide.id, "Approved content-addressed visual is reusable.", asset));
      } else {
        regenerate.push(item(`asset:${asset.id}`, "visual", slide.id, "Visual exists but is not approved for reuse.", asset));
      }
    }
    const narration = state.narration.get(slide.id);
    if (narration?.audioAssetRef && narration.audioDurationMs !== null) {
      const audioProbe = context.assetProbe.probe(narration.audioAssetRef);
      if (audioProbe.exists && audioProbe.approved) reuse.push(item(`audio:${slide.id}`, "audio", slide.id, "Approved narration audio is reusable.", narration));
      else regenerate.push(item(`audio:${slide.id}`, "audio", slide.id, "Narration audio requires generation or approval.", narration));
    } else regenerate.push(item(`audio:${slide.id}`, "audio", slide.id, "Narration audio is unresolved.", narration));
  }
  const rebuild = [
    item("presentation-plan", "plan", null, "Deterministic plan rebuild.", presentationPlan),
    item("video-plan", "plan", null, "Deterministic plan rebuild.", videoPlan),
    item("course-pptx", "pptx", null, "Presentation output is derived from PresentationPlan.", presentationPlan.contentHash),
    item("author-review-mp4", "video", null, "Encoded video is derived from VideoPlan.", videoPlan.contentHash)
  ];
  const buildPlan: BuildPlan = {
    version: "0.1.0",
    reuse: reuse.sort((left, right) => left.id.localeCompare(right.id)),
    regenerate: regenerate.sort((left, right) => left.id.localeCompare(right.id)),
    rebuild,
    blocked: blocked.sort((left, right) => left.id.localeCompare(right.id)),
    aiCalls: {
      llm: 0,
      image: regenerate.filter((entry) => entry.kind === "visual").length,
      tts: regenerate.filter((entry) => entry.kind === "audio").length
    },
    diagnostics: [...state.diagnostics]
  };
  return {
    courseSpec: state.course,
    presentationPlan,
    videoPlan,
    buildPlan,
    diagnostics: [...state.diagnostics]
  };
};

export const serializeCompilerOutput = (output: CompilerOutput): string => canonicalJson(output);
