import type {
  CourseSpec,
  GroundingSpec,
  MotionIntent,
  NormalizedRegion,
  ReleaseScope,
  ReviewDecision,
  ValidationSeverity,
  VisualRequirement
} from "@livingcourse/core";

export interface CompilerDiagnostic {
  code: string;
  path: string;
  message: string;
  severity: ValidationSeverity;
}

export interface AssetProbeResult {
  exists: boolean;
  sha256: string | null;
  approved: boolean;
}

export interface AssetProbe {
  probe(assetRef: string): AssetProbeResult;
}

export interface TimingProbe {
  durationMs(audioAssetRef: string): number | null;
  narrationTiming?(audioAssetRef: string): NarrationTimingProbeResult | null;
}

export interface NarrationTimingSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface NarrationTimingProbeResult {
  audioDurationMs: number;
  sentenceSegments: NarrationTimingSegment[];
  characterSegments?: NarrationTimingSegment[];
  method: "provider_aligned" | "independent_synthesis";
}

export type NarrationTimingQuality = "aligned" | "normalized" | "estimated";

export interface NormalizedNarrationTiming {
  audioDurationMs: number;
  timingSourceDurationMs: number;
  scaleFactor: number;
  sentenceSegments: NarrationTimingSegment[];
  characterSegments?: NarrationTimingSegment[];
  rawTiming: NarrationTimingProbeResult | null;
  method: "provider_aligned" | "duration_normalized_provider_timing" | "estimated_linear";
  quality: NarrationTimingQuality;
  requiresHumanAvSyncReview: boolean;
}

export interface ReviewDecisionSource {
  decisions(): readonly ReviewDecision[];
}

export interface BuildFingerprints {
  presentationRendererFingerprint: string;
  videoRendererFingerprint: string;
  vocabularyFingerprint: string;
  profileFingerprint: string;
  compilerFingerprint: string;
}

export interface CompilerContext {
  assetProbe: AssetProbe;
  timingProbe: TimingProbe;
  reviewDecisionSource: ReviewDecisionSource;
  fps: number;
  narrationStartOffsetMs: number;
  narrationTailPaddingMs: number;
  transitionMs: number;
  buildFingerprints: BuildFingerprints;
}

export interface ResolvedAsset extends VisualRequirement {
  exists: boolean;
  approved: boolean;
  sha256: string | null;
}

export interface ResolvedNarration {
  slideId: string;
  script: string;
  language: string;
  voiceProfile: string;
  audioAssetRef: string | null;
  audioDurationMs: number | null;
  timing: NormalizedNarrationTiming;
}

export interface ResolvedTiming {
  slideId: string;
  globalStartMs: number;
  durationMs: number;
  durationFrames: number;
  audioStartMs: number;
  audioDurationMs: number | null;
  transitionMs: number;
  transitionFrames: number;
}

export interface ResolvedCue {
  id: string;
  atMs: number;
  targetIds: string[];
  timingQuality: NarrationTimingQuality;
}

export interface CaptionCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  maxLines: 2;
  timingQuality: NarrationTimingQuality;
}

export interface PresentationElement {
  id: string;
  kind: "text" | "image" | "shape" | "disclosure";
  geometry: NormalizedRegion;
  readingOrder: number;
  styleRole: "title" | "subtitle" | "body" | "warning" | "caption" | "visual" | "guide" | "accent" | "disclosure";
  shape?: "line" | "circle" | "panel";
  colorRole?: "primary" | "secondary" | "line";
  text?: string;
  assetRef?: string;
  altText?: string;
}

export interface PresentationSlidePlan {
  slideId: string;
  layout: string;
  nativeText: string[];
  elements: PresentationElement[];
  assetRefs: string[];
  geometry: Record<string, NormalizedRegion>;
  readingOrder: string[];
  speakerNotes: string;
  safeAreas: NormalizedRegion[];
  releaseScope: ReleaseScope;
}

export interface PresentationPlan {
  version: "0.1.0";
  courseId: string;
  title: string;
  aspectRatio: "16:9";
  slides: PresentationSlidePlan[];
  contentHash: string;
}

export interface VideoMotion {
  id: string;
  targetIds: string[];
  action: MotionIntent["action"];
  atMs: number;
  durationMs: number;
  intensity?: MotionIntent["intensity"];
}

export interface VideoSlidePlan {
  slideId: string;
  globalStartMs: number;
  durationMs: number;
  audio: {
    assetRef: string | null;
    startMs: number;
    durationMs: number | null;
  };
  narrationTiming: NormalizedNarrationTiming;
  timingQuality: NarrationTimingQuality;
  requiresHumanAvSyncReview: boolean;
  captions: CaptionCue[];
  cues: ResolvedCue[];
  motions: VideoMotion[];
  transition: { kind: "crossfade" | "none"; durationMs: number };
  assets: ResolvedAsset[];
  layers: PresentationElement[];
  disclosures: string[];
  releaseScope: ReleaseScope;
}

export interface VideoPlan {
  version: "0.1.0";
  courseId: string;
  title: string;
  width: 1280;
  height: 720;
  fps: number;
  durationMs: number;
  durationFrames: number;
  captionStyle: {
    color: "#000000";
    background: "transparent";
    border: "none";
    maxLines: 2;
  };
  slides: VideoSlidePlan[];
  contentHash: string;
}

export interface BuildPlanItem {
  id: string;
  kind: "source" | "visual" | "audio" | "pptx" | "video" | "plan" | "release";
  slideId: string | null;
  reason: string;
  fingerprint: string;
}

export interface BuildPlan {
  version: "0.1.0";
  reuse: BuildPlanItem[];
  regenerate: BuildPlanItem[];
  rebuild: BuildPlanItem[];
  blocked: BuildPlanItem[];
  aiCalls: { llm: number; image: number; tts: number };
  diagnostics: CompilerDiagnostic[];
}

export interface CompilerState {
  course: CourseSpec;
  diagnostics: CompilerDiagnostic[];
  grounding: ReadonlyMap<string, GroundingSpec>;
  assets: ReadonlyMap<string, ResolvedAsset[]>;
  narration: ReadonlyMap<string, ResolvedNarration>;
  elements: ReadonlyMap<string, PresentationElement[]>;
  timing: ReadonlyMap<string, ResolvedTiming>;
  cues: ReadonlyMap<string, { cues: ResolvedCue[]; captions: CaptionCue[] }>;
  motions: ReadonlyMap<string, VideoMotion[]>;
}

export interface CompilerOutput {
  courseSpec: CourseSpec;
  presentationPlan: PresentationPlan;
  videoPlan: VideoPlan;
  buildPlan: BuildPlan;
  diagnostics: CompilerDiagnostic[];
}
