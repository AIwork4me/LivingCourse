import { sha256 } from "@livingcourse/core";
import { normalizeMaterialIR, type MaterialAuthority, type MaterialIR, type MaterialUnitKind } from "@livingcourse/intake";
import {
  deterministicCoursePlan,
  deterministicKnowledgeDrafts,
  type CourseDesignCapability,
  type CourseDesignInput,
  type CoursePlanDraft,
  type KnowledgeCandidateDraft,
  type KnowledgeUnderstandingCapability,
  type SemanticCapabilityIdentity
} from "@livingcourse/generation";

export const makeMaterial = (input: {
  id: string;
  name?: string;
  mediaType?: string;
  kind?: MaterialUnitKind;
  blocks: Array<{ type?: "title" | "paragraph" | "list" | "image"; content: string; anchor?: string }>;
  authority?: MaterialAuthority;
}): MaterialIR => normalizeMaterialIR({
  document: {
    materialId: input.id,
    path: input.name ?? `${input.id}.md`,
    originalName: input.name ?? `${input.id}.md`,
    mediaType: input.mediaType ?? "text/markdown",
    sha256: sha256(input.blocks),
    sizeBytes: JSON.stringify(input.blocks).length,
    authority: input.authority ?? { sourceClass: "controlled_internal", authority: "Fixture owner", version: "1.0", effectiveDate: "2026-09-01" }
  },
  units: [{
    kind: input.kind ?? "section",
    index: 0,
    blocks: input.blocks.map((block) => ({
      type: block.type ?? "paragraph",
      content: block.content,
      ...(block.anchor === undefined ? {} : { anchor: block.anchor })
    }))
  }],
  provenance: {
    provider: "semantic-fixture-parser",
    providerVersion: "1.0.0",
    parseProfile: "balanced",
    processingMode: "local",
    endpointClassification: "local",
    parsedAt: "2026-09-01T00:00:00Z",
    rawArtifactRefs: []
  }
});

const identity = (kind: "knowledge" | "course", overrides: Partial<SemanticCapabilityIdentity> = {}): SemanticCapabilityIdentity => ({
  mode: "semantic_ai",
  provider: "fake-semantic-provider",
  model: kind === "knowledge" ? "fake-understanding-1" : "fake-course-design-1",
  promptTemplateVersion: kind === "knowledge" ? "knowledge-test-v1" : "course-test-v1",
  promptTemplateHash: sha256(kind === "knowledge" ? "knowledge-test-v1" : "course-test-v1"),
  profileVersion: "test-profile-v1",
  ...overrides
});

export class FakeKnowledgeUnderstandingProvider implements KnowledgeUnderstandingCapability {
  readonly calls: string[] = [];
  readonly identity: SemanticCapabilityIdentity;

  constructor(
    private readonly handler: (materials: readonly MaterialIR[]) => KnowledgeCandidateDraft[] = deterministicKnowledgeDrafts,
    identityOverrides: Partial<SemanticCapabilityIdentity> = {}
  ) {
    this.identity = identity("knowledge", identityOverrides);
  }

  async understand(materials: readonly MaterialIR[]): Promise<KnowledgeCandidateDraft[]> {
    this.calls.push(...materials.map((material) => material.material.originalName));
    return this.handler(materials);
  }
}

export class FakeCourseDesignProvider implements CourseDesignCapability {
  readonly calls: CourseDesignInput[] = [];
  readonly identity: SemanticCapabilityIdentity;

  constructor(
    private readonly handler: (input: CourseDesignInput) => CoursePlanDraft = deterministicCoursePlan,
    identityOverrides: Partial<SemanticCapabilityIdentity> = {}
  ) {
    this.identity = identity("course", identityOverrides);
  }

  async design(input: CourseDesignInput): Promise<CoursePlanDraft> {
    this.calls.push(structuredClone(input));
    return this.handler(input);
  }
}
