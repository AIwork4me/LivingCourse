import { sha256, type CourseSpec } from "@livingcourse/core";

export type DependencyNodeKind =
  | "knowledge"
  | "presentation_text"
  | "visual_requirement"
  | "visual_asset"
  | "narration"
  | "audio"
  | "timing"
  | "caption"
  | "cue"
  | "presentation_slide"
  | "video_slide"
  | "course_pptx"
  | "course_video"
  | "shared_renderer"
  | "shared_vocabulary";

export interface DependencyNode {
  id: string;
  kind: DependencyNodeKind;
  slideId: string | null;
  path: string | null;
  contentHash: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  reason: string;
  executionOnly: boolean;
}

export interface DependencyGraph {
  version: "0.1.0";
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

const node = (id: string, kind: DependencyNodeKind, slideId: string | null, path: string | null, value: unknown): DependencyNode => ({
  id, kind, slideId, path, contentHash: sha256(value)
});

const edge = (from: string, to: string, reason: string, executionOnly = false): DependencyEdge => ({ from, to, reason, executionOnly });

export const buildDependencyGraph = (course: CourseSpec): DependencyGraph => {
  const nodes: DependencyNode[] = [
    node("renderer:ppt", "shared_renderer", null, null, "ppt-renderer-v0.2"),
    node("renderer:video", "shared_renderer", null, null, "video-renderer-v0.2"),
    node("vocabulary:core", "shared_vocabulary", null, null, "course-vocabulary-v0.2"),
    node("course:pptx", "course_pptx", null, null, course.course.id),
    node("course:video", "course_video", null, null, course.course.id)
  ];
  const edges: DependencyEdge[] = [
    edge("renderer:ppt", "course:pptx", "Renderer execution builds the course PPTX.", true),
    edge("renderer:video", "course:video", "Renderer execution encodes the course video.", true)
  ];
  for (const [slideIndex, slide] of course.slides.entries()) {
    const narrationId = `narration:${slide.id}`;
    const audioId = `audio:${slide.id}`;
    const timingId = `timing:${slide.id}`;
    const captionId = `caption:${slide.id}`;
    const cueId = `cue:${slide.id}`;
    const presentationSlideId = `presentation-slide:${slide.id}`;
    const videoSlideId = `video-slide:${slide.id}`;
    nodes.push(
      node(narrationId, "narration", slide.id, `/slides/${slideIndex}/narration/script`, slide.narration.script),
      node(audioId, "audio", slide.id, `/slides/${slideIndex}/narration/audioAssetRef`, slide.narration.audioAssetRef),
      node(timingId, "timing", slide.id, null, slide.narration.approvedDurationMs),
      node(captionId, "caption", slide.id, null, slide.narration.script),
      node(cueId, "cue", slide.id, `/slides/${slideIndex}/narration/cues`, slide.narration.cues),
      node(presentationSlideId, "presentation_slide", slide.id, `/slides/${slideIndex}/presentation`, slide.presentation),
      node(videoSlideId, "video_slide", slide.id, null, { presentation: slide.presentation, narration: slide.narration }),
    );
    edges.push(
      edge(narrationId, audioId, "Approved narration text determines audio."),
      edge(audioId, timingId, "Audio duration determines timing."),
      edge(timingId, captionId, "Caption timing is derived from normalized audio timing."),
      edge(timingId, cueId, "Narration cue timestamps are derived from normalized timing."),
      edge(captionId, videoSlideId, "Video slide consumes captions."),
      edge(cueId, videoSlideId, "Video slide consumes narration cues."),
      edge(audioId, videoSlideId, "Video slide consumes approved audio."),
      edge(presentationSlideId, "course:pptx", "Course PPTX deterministically rebuilds from affected presentation slides.", true),
      edge(presentationSlideId, videoSlideId, "Video keeps the approved presentation hierarchy."),
      edge(videoSlideId, "course:video", "Whole-file video encode is a deterministic rebuild.", true)
    );
    for (const [itemIndex, itemValue] of slide.knowledge.items.entries()) {
      const knowledgeId = `knowledge:${slide.id}:${itemValue.id}`;
      const textId = `presentation-text:${slide.id}:${itemValue.id}`;
      nodes.push(
        node(knowledgeId, "knowledge", slide.id, `/slides/${slideIndex}/knowledge/items/${itemIndex}/text`, itemValue.text),
        node(textId, "presentation_text", slide.id, null, itemValue.text)
      );
      edges.push(
        edge(knowledgeId, textId, "Knowledge text determines native presentation text."),
        edge(knowledgeId, narrationId, "Narration must express changed approved knowledge."),
        edge(textId, presentationSlideId, "Presentation slide consumes native text.")
      );
      if (itemValue.visualRequirementRef) {
        const requirement = slide.presentation.visualIntent.requirements.find((candidate) => candidate.id === itemValue.visualRequirementRef);
        if (requirement) {
          const requirementId = `visual-requirement:${slide.id}:${requirement.id}`;
          const assetId = `visual-asset:${slide.id}:${requirement.id}`;
          if (!nodes.some((candidate) => candidate.id === requirementId)) {
            nodes.push(
              node(requirementId, "visual_requirement", slide.id, `/slides/${slideIndex}/presentation/visualIntent/requirements/${slide.presentation.visualIntent.requirements.indexOf(requirement)}`, requirement),
              node(assetId, "visual_asset", slide.id, null, requirement.assetRef)
            );
            edges.push(
              edge(requirementId, assetId, "Visual requirement determines the generated or reused asset."),
              edge(assetId, presentationSlideId, "Presentation slide consumes the visual asset."),
              edge(assetId, videoSlideId, "Video slide consumes the visual asset.")
            );
          }
          edges.push(edge(knowledgeId, requirementId, "Knowledge meaning determines its visual requirement."));
        }
      }
    }
    for (const requirement of slide.presentation.visualIntent.requirements) {
      const requirementId = `visual-requirement:${slide.id}:${requirement.id}`;
      const assetId = `visual-asset:${slide.id}:${requirement.id}`;
      if (nodes.some((candidate) => candidate.id === requirementId)) continue;
      nodes.push(node(requirementId, "visual_requirement", slide.id, null, requirement), node(assetId, "visual_asset", slide.id, null, requirement.assetRef));
      edges.push(
        edge(requirementId, assetId, "Visual requirement determines the generated or reused asset."),
        edge(assetId, presentationSlideId, "Presentation slide consumes the visual asset."),
        edge(assetId, videoSlideId, "Video slide consumes the visual asset.")
      );
    }
  }
  return {
    version: "0.1.0",
    nodes: nodes.sort((left, right) => left.id.localeCompare(right.id)),
    edges: edges.sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to))
  };
};
