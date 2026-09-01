import type { CourseSpec, MaterialSpec, PresentationIntent } from "@livingcourse/core";

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
  facts: Array<{ text: string; sourceRefs: string[]; confidence: number }>;
  warnings: string[];
}

export interface CourseCandidate {
  course: Partial<CourseSpec>;
  warnings: string[];
}

export interface KnowledgeUnderstandingCapability {
  understand(materials: readonly MaterialSpec[]): Promise<KnowledgeCandidate>;
}

export interface CourseDesignCapability {
  design(candidate: KnowledgeCandidate): Promise<CourseCandidate>;
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
