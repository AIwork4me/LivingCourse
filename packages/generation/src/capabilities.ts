import type { CourseSpec, PresentationIntent } from "@livingcourse/core";
import type { EvidenceRef, MaterialIR } from "@livingcourse/intake";

export interface GenerationProvenance {
  provider: string;
  model: string;
  promptTemplateVersion: string;
  profileVersion: string;
}

export interface GeneratedArtifact {
  bytes: Uint8Array;
  mediaType: string;
  provenance: GenerationProvenance;
  providerMetadata: Record<string, string | number | boolean | null>;
}

export interface KnowledgeCandidate {
  id: string;
  claim: string;
  category: "general" | "safety" | "device_operation";
  evidenceRefs: EvidenceRef[];
  confidence: number;
  authorityAssessment: "recorded" | "authority_gap";
  conflictStatus: "none" | "candidate_conflict";
  groundingStatus: "satisfied" | "gap" | "blocked";
  status: "supported_candidate" | "unsupported_candidate" | "conflicted_candidate";
  factual: boolean;
  comparableFact: { key: string; value: string } | null;
}

export interface KnowledgeConflict {
  id: string;
  comparableFactKey: string;
  candidateIds: string[];
  evidenceRefs: EvidenceRef[];
  authorityStatus: "clear_hierarchy" | "ambiguous";
  recommendedAction: string;
  recommendedCandidateId: string | null;
}

export interface AuthorityGap {
  id: string;
  materialId: string;
  message: string;
  resolutionAction: string;
}

export interface KnowledgeUnderstandingCapability {
  understand(materials: readonly MaterialIR[]): Promise<KnowledgeCandidate[]>;
}

export interface CourseDesignCapability {
  design(candidates: readonly KnowledgeCandidate[]): Promise<Partial<CourseSpec>>;
}

export interface VisualGenerationCapability {
  generate(input: { requirement: PresentationIntent["visualIntent"]["requirements"][number]; profile: string }): Promise<GeneratedArtifact>;
}

export interface TtsCapability {
  synthesize(input: { text: string; language: string; voiceProfile: string }): Promise<GeneratedArtifact>;
}

export interface GenerationCapabilities {
  knowledge: KnowledgeUnderstandingCapability;
  courseDesign: CourseDesignCapability;
  visual: VisualGenerationCapability;
  tts: TtsCapability;
}
