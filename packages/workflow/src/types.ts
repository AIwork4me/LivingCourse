import type { BuildFingerprints, BuildPlan, PresentationPlan, VideoPlan } from "@livingcourse/compiler";

export type WorkflowStatus = "planned" | "running" | "failed" | "complete" | "blocked";

export interface ArtifactRecord {
  id: string;
  kind: "visual" | "audio" | "pptx" | "video" | "plan";
  sha256: string;
  sourceHash: string;
  generationFingerprint: string;
  path: string;
  provider: string;
  model: string;
  reviewStatus: "pending" | "approved_for_poc_use" | "approved_for_release" | "rejected";
  dependencies: string[];
}

export interface ArtifactRegistryData {
  version: "0.1.0";
  artifacts: ArtifactRecord[];
}

export interface WorkflowRunState {
  version: "0.1.0";
  runId: string;
  inputHash: string;
  status: WorkflowStatus;
  completedNodes: string[];
  outputs: { pptx: string | null; video: string | null };
  qa?: WorkflowQaReport | null;
  error: { code: string; message: string } | null;
  updatedAt: string;
}

export interface WorkflowRenderers {
  renderPpt(plan: PresentationPlan, outputPath: string, courseRoot: string): Promise<void>;
  renderVideo(plan: VideoPlan, outputPath: string, courseRoot: string): Promise<void>;
  qa?(pptxPath: string, videoPath: string): Promise<WorkflowQaReport>;
}

export interface WorkflowQaReport {
  passed: boolean;
  ppt: { slideCount: number; notesCount: number; editable: boolean; nativeTextCount: number };
  video: { width: number; height: number; fps: number; durationSeconds: number | null; videoCodec: string; audioCodec: string | null; audioPresent: boolean };
  checks: Array<{ id: string; passed: boolean; detail: string }>;
}

export interface ReviewPackage {
  courseId: string;
  gates: Array<{ gateId: string; artifactIds: string[]; status: "pending" | "satisfied"; actions: ["approve", "reject", "comment"] }>;
  buildSummary: { reuse: number; regenerate: number; rebuild: number; blocked: number };
}

export interface WorkflowPlanResult {
  runId: string;
  inputHash: string;
  buildPlan: BuildPlan;
  presentationPlan: PresentationPlan;
  videoPlan: VideoPlan;
  coursePath: string;
  courseRoot: string;
  outputRoot: string;
  cacheHit: boolean;
  buildFingerprints: BuildFingerprints;
  reviewPackage: ReviewPackage;
}

export interface WorkflowExecutionResult {
  runId: string;
  status: WorkflowStatus;
  buildPlan: BuildPlan;
  aiCalls: { llm: number; image: number; tts: number };
  reused: string[];
  regenerated: string[];
  rebuilt: string[];
  outputs: { pptx: string | null; video: string | null };
  resumed: boolean;
  qa: WorkflowQaReport | null;
  reviewPackage: ReviewPackage;
}

export interface StructuredFailure {
  code: string;
  whatHappened: string;
  why: string;
  canAutoFix: boolean;
  userAction: string;
  retryRequiresAi: boolean;
}

export class WorkflowError extends Error {
  override readonly name = "WorkflowError";
  constructor(readonly failure: StructuredFailure) {
    super(`${failure.code}: ${failure.whatHappened}`);
  }
}
