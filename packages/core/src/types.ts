export type MaterialType =
  | "sop"
  | "pdf"
  | "docx"
  | "pptx"
  | "markdown"
  | "image"
  | "equipment_photo"
  | "web_reference"
  | "synthetic_source";

export type SourceClass =
  | "controlled_internal"
  | "external_authoritative"
  | "reference"
  | "synthetic"
  | "unknown";

export type ReleaseScope = "poc_only" | "author_review" | "production";
export type RiskLevel = "illustrative" | "procedural_general" | "device_specific";
export type ReviewStatus =
  | "pending"
  | "approved_for_poc_use"
  | "approved_for_release"
  | "changes_required"
  | "rejected";
export type CourseLifecycleState =
  | "candidate"
  | "normalized"
  | "validated"
  | "review_required"
  | "approved_for_poc_use"
  | "approved_for_release"
  | "changes_required"
  | "rejected";
export type SlideType = "hero" | "step_process" | "safety_focus";

export interface CourseIdentity {
  id: string;
  title: string;
  version: string;
  locale: string;
  audience: string;
  purpose: string;
  aspectRatio: "16:9";
}

export interface MaterialSpec {
  id: string;
  type: MaterialType;
  path: string | null;
  ref: string | null;
  sha256: string | null;
  title: string;
  version: string;
  effectiveDate: string | null;
  authority: string;
  sourceClass: SourceClass;
  availability: "available" | "missing";
}

export interface KnowledgeItem {
  id: string;
  order: number;
  text: string;
  sourceRefs: string[];
  visualRequirementRef?: string;
}

export interface KnowledgeBlock {
  purpose: string;
  summary: string;
  items: KnowledgeItem[];
  safetyRule?: string;
  disclosure?: string;
}

export interface NormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualRequirement {
  id: string;
  kind: "hero_visual" | "guide_character" | "concept_visual" | "equipment_visual";
  subject: string;
  assetRef: string | null;
  sourceClass: SourceClass;
  textFree: boolean;
  synthetic: boolean;
  pocOnly: boolean;
}

export interface LayoutIntent {
  kind: SlideType;
  regions: Record<string, NormalizedRegion>;
  readingOrder: string[];
  safeAreas: NormalizedRegion[];
}

export interface MotionIntent {
  id: string;
  order: number;
  targetIds: string[];
  action: "reveal" | "synchronized_reveal" | "sequential_reveal" | "slow_zoom" | "focus";
  atMs?: number;
  durationMs?: number;
  intensity?: "very_subtle" | "subtle";
}

export interface PresentationIntent {
  title: string;
  subtitle?: string;
  visualIntent: {
    summary: string;
    requirements: VisualRequirement[];
  };
  layout: LayoutIntent;
  motionIntent: MotionIntent[];
}

export interface NarrationCue {
  id: string;
  phrase: string;
  targetIds: string[];
}

export interface NarrationSpec {
  script: string;
  language: string;
  voiceProfile: string;
  audioAssetRef: string | null;
  approvedDurationMs: number | null;
  cues: NarrationCue[];
}

export interface GroundingAnchor {
  id: string;
  status: "unresolved" | "approved_for_poc_only" | "verified";
  assetRef: string | null;
  bounds: NormalizedRegion | null;
  confirmedBy: string | null;
}

export interface GroundingSpec {
  sourceRefs: string[];
  sourceClass: SourceClass;
  verified: boolean;
  anchor: GroundingAnchor | null;
  replacementRequirement: string | null;
  releaseScope: ReleaseScope;
}

export interface SlideGovernance {
  riskLevel: RiskLevel;
  reviewStatus: ReviewStatus;
  requiredReviewGates: string[];
  releaseBlockers: string[];
}

export interface SlideSpec {
  id: string;
  order: number;
  type: SlideType;
  knowledge: KnowledgeBlock;
  presentation: PresentationIntent;
  narration: NarrationSpec;
  grounding: GroundingSpec;
  governance: SlideGovernance;
}

export interface AcceptedRisk {
  code: string;
  rationale: string;
}

export interface ReviewDecision {
  artifactId: string;
  gateId: string;
  decision: ReviewStatus;
  reviewer: string;
  reviewedAt: string;
  scope: ReleaseScope;
  comments: string;
  acceptedRisks: AcceptedRisk[];
}

export interface CourseGovernance {
  lifecycleState: CourseLifecycleState;
  targetReleaseScope: ReleaseScope;
  reviewDecisions: ReviewDecision[];
  securityScanRequired: boolean;
}

export interface CourseSpec {
  courseSpecVersion: string;
  course: CourseIdentity;
  materials: MaterialSpec[];
  slides: SlideSpec[];
  governance: CourseGovernance;
}

export type ValidationSeverity = "error" | "warning" | "blocking";

export interface ValidationError {
  code: string;
  path: string;
  message: string;
  severity: ValidationSeverity;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
