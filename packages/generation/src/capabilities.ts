import type { PresentationIntent, SlideType } from "@livingcourse/core";
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

export type KnowledgeCategory = "general" | "safety" | "device_operation" | "quality" | "process" | "policy";

export interface KnowledgeSourceHint {
  materialId: string;
  unitId?: string;
  blockId?: string;
  quoteOrText?: string;
}

export interface KnowledgeCandidateDraft {
  id?: string;
  claim: string;
  category: KnowledgeCategory;
  sourceHints: KnowledgeSourceHint[];
  confidence: number;
  rationale?: string;
}

export interface KnowledgeFidelityIssue {
  kind: "numeric" | "negation";
  value: string;
  message: string;
}

export interface KnowledgeCandidate {
  id: string;
  claim: string;
  category: KnowledgeCategory;
  evidenceRefs: EvidenceRef[];
  confidence: number;
  evidenceResolution: "exact_block" | "normalized_text" | "fuzzy_text" | "unresolved";
  fidelityIssues: KnowledgeFidelityIssue[];
  authorityAssessment: "recorded" | "authority_gap";
  conflictStatus: "none" | "candidate_conflict";
  groundingStatus: "satisfied" | "gap" | "blocked";
  status: "supported_candidate" | "unsupported_candidate" | "conflicted_candidate" | "stale_evidence";
  factual: boolean;
  comparableFact: { key: string; value: string } | null;
}

export interface SemanticCapabilityIdentity {
  mode: "semantic_ai" | "literal_deterministic";
  provider: string;
  model: string;
  promptTemplateVersion: string;
  promptTemplateHash: string;
  profileVersion: string;
}

export interface CoursePlanSlideDraft {
  id?: string;
  title: string;
  purpose: string;
  candidateIds: string[];
  proposedSlideType: SlideType;
  narrationDraft?: string;
  visualIntent?: string;
}

export interface CoursePlanDraft {
  title: string;
  learningObjectives: string[];
  slides: CoursePlanSlideDraft[];
}

export interface CourseDesignInput {
  title: string;
  audience: string;
  purpose: string;
  locale: string;
  candidates: readonly KnowledgeCandidate[];
  maxSlides: number;
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
  readonly identity: SemanticCapabilityIdentity;
  understand(materials: readonly MaterialIR[]): Promise<KnowledgeCandidateDraft[]>;
}

export interface CourseDesignCapability {
  readonly identity: SemanticCapabilityIdentity;
  design(input: CourseDesignInput): Promise<CoursePlanDraft>;
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
