import {
  normalizeMaterialIR,
  type DocumentParseRequest,
  type DocumentParseResult,
  type DocumentParsingCapabilities,
  type DocumentParsingProvider,
  type ProviderHealth
} from "@livingcourse/intake";

export const semanticManufacturingFixture = {
  folder: "tests/fixtures/semantic-manufacturing-course",
  metadata: {
    "approved-sop.pdf": { sourceClass: "controlled_internal" as const, authority: "Fixture Safety Owner", version: "4.2", effectiveDate: "2026-09-01" },
    "archived-training.pptx": { sourceClass: "reference" as const, authority: "Synthetic training archive", version: "1.4", effectiveDate: "2023-06-01" },
    "employee-handbook.docx": { sourceClass: "reference" as const, authority: "Synthetic HR Training", version: "3.0", effectiveDate: "2026-09-01" },
    "equipment-photo.jpg": { sourceClass: "synthetic" as const, authority: "LivingCourse fixture generator", version: "1.0", effectiveDate: "2026-09-01" },
    "trainer-notes.md": { sourceClass: "unknown" as const, authority: null, version: null, effectiveDate: null }
  },
  blocks: {
    "approved-sop.pdf": [
      "An authorized trainer must be present before the practice zone is opened.",
      "Wear splash goggles and safety shoes before starting.",
      "Synthetic training pressure setting = 0.55 MPa.",
      "Do not open the guard door while the synthetic machine is running.",
      "If the simulated warning beacon illuminates, stop the exercise and report the event to the trainer.",
      "Confirm the guard is closed before trainer release.",
      "Verify the training label before the simulated pre-start inspection.",
      "Record the simulated pre-start inspection before requesting trainer release."
    ],
    "archived-training.pptx": [
      "Synthetic training pressure setting = 0.65 MPa.",
      "Wear splash goggles and safety shoes before starting.",
      "Do not open the guard door while the synthetic machine is running.",
      "Revision history: formatting refresh.",
      "Copyright 2023 Synthetic Fixture Works."
    ],
    "employee-handbook.docx": [
      "Wear splash goggles and safety shoes before starting.",
      "Keep a minimum 10 mm clearance from the marked demonstration boundary.",
      "A simulated reading outside 5% of the training target requires trainer review.",
      "If the indicator exceeds 80 °C, stop the exercise and report the observation.",
      "When uncertain, stop and ask; do not invent or infer an operating step.",
      "Office lunch policy permits breaks between 12:00 and 13:30."
    ],
    "equipment-photo.jpg": [
      "The equipment photo is illustrative and does not establish a real device anchor or confirmed operation region."
    ]
  } satisfies Record<string, string[]>
};

export class SemanticFixtureParsingProvider implements DocumentParsingProvider {
  readonly id = "semantic-fixture-parser";
  readonly parseCalls: string[] = [];

  async health(): Promise<ProviderHealth> {
    return { providerId: this.id, status: "available", version: "1.0.0", processingMode: "local", endpointClassification: "local", detail: "Synthetic semantic fixture parser is available." };
  }

  async capabilities(): Promise<DocumentParsingCapabilities> {
    return { providerId: this.id, providerVersion: "1.0.0", supportedMediaTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg"], parseProfiles: ["balanced", "high_fidelity"] };
  }

  supports(input: DocumentParseRequest["input"]): boolean {
    return Object.hasOwn(semanticManufacturingFixture.blocks, input.originalName);
  }

  async parse(request: DocumentParseRequest): Promise<DocumentParseResult> {
    this.parseCalls.push(request.input.originalName);
    const blocks = semanticManufacturingFixture.blocks[request.input.originalName as keyof typeof semanticManufacturingFixture.blocks];
    if (!blocks) throw new Error(`Missing semantic fixture mapping for ${request.input.originalName}.`);
    const kind = request.input.mediaType.includes("presentation") ? "slide" as const : request.input.mediaType.startsWith("image/") ? "image" as const : "page" as const;
    const materialIr = normalizeMaterialIR({
      document: request.input,
      units: [{ kind, index: 0, blocks: blocks.map((content, index) => ({ type: kind === "image" ? "image" as const : "paragraph" as const, content, anchor: `${kind}-${index + 1}` })) }],
      provenance: { provider: this.id, providerVersion: "1.0.0", parseProfile: request.profile, processingMode: "local", endpointClassification: "local", parsedAt: request.parsedAt, rawArtifactRefs: [] }
    });
    return { materialIr, diagnostics: [], rawArtifacts: [], markdownPreview: blocks.join("\n\n"), parserOutputVersion: "semantic-fixture-v1", normalizationMethod: "fixture-map" };
  }
}
