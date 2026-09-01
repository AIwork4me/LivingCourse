import { readFile } from "node:fs/promises";
import { normalizeMaterialIR, type DocumentParseRequest, type DocumentParseResult, type DocumentParsingCapabilities, type DocumentParsingProvider, type ProviderHealth } from "@livingcourse/intake";

export class FakeDocumentParsingProvider implements DocumentParsingProvider {
  readonly id = "fake-document-parser";
  parseCalls: string[] = [];

  async health(): Promise<ProviderHealth> {
    return { providerId: this.id, status: "available", version: "fixture-1.0.0", processingMode: "local", endpointClassification: "local", detail: "Deterministic test provider available." };
  }

  async capabilities(): Promise<DocumentParsingCapabilities> {
    return { providerId: this.id, providerVersion: "fixture-1.0.0", supportedMediaTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"], parseProfiles: ["balanced", "high_fidelity"] };
  }

  supports(): boolean {
    return true;
  }

  async parse(request: DocumentParseRequest): Promise<DocumentParseResult> {
    this.parseCalls.push(request.input.originalName);
    const fixtureContent: Record<string, string> = {
      "training-old.pptx": "Synthetic training pressure setting = A. Archived reference deck.",
      "sop.pdf": "Synthetic training pressure setting = B. Stop when the simulated warning beacon appears.",
      "employee-handbook.docx": "Report uncertainty instead of guessing an operating step.",
      "equipment-photo.jpg": "Illustrative image of the Synthetic Training Machine; no verified real-device anchor."
    };
    const content = fixtureContent[request.input.originalName] ?? await readFile(request.input.path, "utf8");
    const materialIr = normalizeMaterialIR({
      document: request.input,
      units: [{ kind: request.input.mediaType.includes("presentation") ? "slide" : request.input.mediaType.startsWith("image/") ? "image" : "page", index: 0, blocks: content.split(/\n\s*\n/gu).map((paragraph) => ({ type: "paragraph" as const, content: paragraph })) }],
      provenance: { provider: this.id, providerVersion: "fixture-1.0.0", parseProfile: request.profile, processingMode: "local", endpointClassification: "local", parsedAt: request.parsedAt, rawArtifactRefs: ["fixture-response.json"] }
    });
    return { materialIr, diagnostics: [], rawArtifacts: [{ name: "fixture-response.json", mediaType: "application/json", bytes: new TextEncoder().encode("{\"fixture\":true}") }], markdownPreview: content, parserOutputVersion: "fixture-v1", normalizationMethod: "fake-deterministic" };
  }
}
