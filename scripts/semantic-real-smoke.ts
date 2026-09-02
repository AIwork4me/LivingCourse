import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DirectTextProvider, validateEvidenceRefs } from "@livingcourse/intake";
import { executeCreate, resolveSemanticCapabilitiesFromEnv, type CreateExecutionResult } from "@livingcourse/workflow";
import { SemanticFixtureParsingProvider, semanticManufacturingFixture } from "../tests/support/semantic-manufacturing-fixture.js";

const required = [
  "LIVINGCOURSE_SEMANTIC_PROVIDER",
  "LIVINGCOURSE_SEMANTIC_BASE_URL",
  "LIVINGCOURSE_SEMANTIC_MODEL",
  "LIVINGCOURSE_SEMANTIC_API_KEY"
] as const;

const isConfigured = required.every((name) => Boolean(process.env[name]?.trim()))
  && process.env.LIVINGCOURSE_SEMANTIC_PROVIDER?.trim() === "openai-compatible";

if (!isConfigured) {
  console.log("REAL SEMANTIC SMOKE TEST = NOT EXECUTED");
  process.exit(0);
}

const root = await mkdtemp(path.join(tmpdir(), "livingcourse-real-semantic-"));
const source = path.join(root, "source");
const reportPath = path.resolve("REAL-SEMANTIC-COURSE-REVIEW.md");

const qualityChecks = (result: CreateExecutionResult): Array<{ check: string; passed: boolean; observed: string }> => {
  const unknownCandidateReferences = result.candidate.draft.slides.flatMap((slide) => slide.knowledge.items)
    .filter((item) => !result.candidate.knowledgeCandidates.some((candidate) => candidate.id === item.id && candidate.claim === item.text)).length;
  const evidenceIntegrityErrors = validateEvidenceRefs(
    result.intake.materials,
    result.candidate.knowledgeCandidates.flatMap((candidate) => candidate.evidenceRefs)
  ).issues.length;
  return [
    { check: "evidence coverage", passed: result.candidate.metrics.evidenceCoverage === 1, observed: String(result.candidate.metrics.evidenceCoverage) },
    { check: "unsupported factual claims", passed: result.candidate.metrics.unsupportedFactualClaims === 0, observed: String(result.candidate.metrics.unsupportedFactualClaims) },
    { check: "numeric fidelity errors", passed: result.candidate.metrics.numericFidelityErrors === 0, observed: String(result.candidate.metrics.numericFidelityErrors) },
    { check: "negation fidelity errors", passed: result.candidate.metrics.negationFidelityErrors === 0, observed: String(result.candidate.metrics.negationFidelityErrors) },
    { check: "irrelevant knowledge included", passed: result.candidate.metrics.irrelevantKnowledgeIncluded === 0, observed: String(result.candidate.metrics.irrelevantKnowledgeIncluded) },
    { check: "duplicate knowledge candidates", passed: result.candidate.metrics.duplicateKnowledgeCandidates === 0, observed: String(result.candidate.metrics.duplicateKnowledgeCandidates) },
    { check: "course slide count is greater than 3", passed: result.candidate.draft.slides.length > 3 && result.candidate.draft.slides.length <= 6, observed: String(result.candidate.draft.slides.length) },
    { check: "existing slide vocabulary only", passed: result.candidate.draft.slides.every((slide) => ["hero", "step_process", "safety_focus"].includes(slide.type)), observed: result.candidate.draft.slides.map((slide) => slide.type).join(", ") },
    { check: "unknown candidate references", passed: unknownCandidateReferences === 0, observed: String(unknownCandidateReferences) },
    { check: "evidence integrity errors", passed: evidenceIntegrityErrors === 0, observed: String(evidenceIntegrityErrors) },
    { check: "manual prompt count", passed: result.manualPromptCount === 0, observed: String(result.manualPromptCount) },
    { check: "manual JSON edit count", passed: result.manualJsonEditCount === 0, observed: String(result.manualJsonEditCount) }
  ];
};

const semanticStructure = (result: CreateExecutionResult): string => JSON.stringify({
  candidates: result.candidate.knowledgeCandidates.map((candidate) => ({ id: candidate.id, claim: candidate.claim, category: candidate.category, evidenceRefs: candidate.evidenceRefs })),
  slides: result.candidate.draft.slides.map((slide) => ({ type: slide.type, knowledge: slide.knowledge.items.map((item) => ({ id: item.id, text: item.text })) })),
  learningObjectives: result.candidate.learningObjectives
});

try {
  await cp(path.resolve(semanticManufacturingFixture.folder), source, { recursive: true });
  const semantic = await resolveSemanticCapabilitiesFromEnv();
  const common = {
    workspaceRoot: root,
    cacheRoot: path.join(root, "intake-cache"),
    semanticCacheRoot: path.join(root, "semantic-cache"),
    outputRoot: path.join(root, "review"),
    providers: [new DirectTextProvider(), new SemanticFixtureParsingProvider()],
    parsedAt: "2026-09-02T00:00:00Z",
    metadata: semanticManufacturingFixture.metadata,
    title: "Synthetic Press Entry",
    audience: "Manufacturing new hires",
    purpose: "Understand supervised entry, safety, quality, and escalation requirements",
    locale: "en",
    maxSlides: 6,
    knowledgeUnderstanding: semantic.knowledgeUnderstanding,
    courseDesign: semantic.courseDesign,
    semanticProcessing: { mode: semantic.disclosure.processingMode, provider: semantic.disclosure.provider, model: semantic.disclosure.model }
  };

  const first = await executeCreate(source, common);
  const second = await executeCreate(source, common);
  const notesPath = path.join(source, "trainer-notes.md");
  const originalNotes = await readFile(notesPath, "utf8");
  await writeFile(notesPath, `${originalNotes}\n\n## Added relevant instruction\n\n- Before requesting trainer release, verify that the marked emergency stop is accessible.\n`, "utf8");
  const relevantChange = await executeCreate(source, common);
  await writeFile(notesPath, `${await readFile(notesPath, "utf8")}\n\nRevision history: punctuation-only metadata refresh.\n`, "utf8");
  const irrelevantChange = await executeCreate(source, common);

  const checks = qualityChecks(first);
  checks.push(
    { check: "first-run semantic calls", passed: first.aiCalls.knowledgeUnderstanding === 5 && first.aiCalls.courseDesign === 1, observed: JSON.stringify(first.aiCalls) },
    { check: "identical second run uses zero calls", passed: second.aiCalls.total === 0, observed: JSON.stringify(second.aiCalls) },
    { check: "relevant-only update invalidates one material and redesigns", passed: relevantChange.aiCalls.knowledgeUnderstanding === 1 && relevantChange.aiCalls.courseDesign === 1 && relevantChange.semantic.changedMaterials.length === 1 && relevantChange.semantic.reusedMaterials.length === 4, observed: `${JSON.stringify(relevantChange.aiCalls)} changed=${relevantChange.semantic.changedMaterials.join(",")} reused=${relevantChange.semantic.reusedMaterials.length}` },
    { check: "irrelevant-only update avoids course redesign", passed: irrelevantChange.aiCalls.knowledgeUnderstanding === 1 && irrelevantChange.aiCalls.courseDesign === 0, observed: JSON.stringify(irrelevantChange.aiCalls) },
    { check: "irrelevant-only semantic structure unchanged", passed: semanticStructure(irrelevantChange) === semanticStructure(relevantChange), observed: semanticStructure(irrelevantChange) === semanticStructure(relevantChange) ? "unchanged" : "changed" }
  );
  const automatedPassed = checks.every((check) => check.passed);
  const rows = checks.map((check) => `| ${check.check} | ${check.passed ? "PASS" : "NEEDS WORK"} | ${check.observed.replaceAll("|", "\\|")} |`).join("\n");
  const slideOutline = first.candidate.draft.slides.map((slide, index) => `${index + 1}. ${slide.presentation.title} — ${slide.knowledge.items.length} candidate-backed item(s)`).join("\n");
  const report = `# Real Semantic Course Review\n\n- Execution: EXECUTED\n- Provider: ${semantic.disclosure.provider}\n- Model: ${semantic.disclosure.model}\n- Processing: ${semantic.disclosure.processingMode}\n- Fixture: public-safe PDF + PPTX + DOCX + JPG + Markdown\n- Scope stopped at CourseSpecCandidate / Author Review; TTS, image generation, rendering, and release were not invoked.\n- Automated quality status: ${automatedPassed ? "PASS" : "NEEDS WORK"}\n- Human Semantic Course Review: NEEDS WORK — an accountable human reviewer must inspect the outline and evidence package before this can be marked PASS.\n\n## Quality gates\n\n| Check | Status | Observed |\n| --- | --- | --- |\n${rows}\n\n## Course outline for human review\n\n${slideOutline}\n\n## Human review checklist\n\n- [ ] The result reads like a training course rather than a document summary.\n- [ ] The title is natural for the intended audience.\n- [ ] The course structure and teaching sequence are coherent for manufacturing new hires.\n- [ ] Safety, process and quality requirements are prominent and correctly ordered.\n- [ ] Per-slide knowledge density is appropriate.\n- [ ] Repeated knowledge has been merged rather than taught redundantly.\n- [ ] The controlled SOP wins the 0.55 MPa / 0.65 MPa conflict.\n- [ ] Lunch policy, revision history, copyright, and unsupported blue-control shorthand are excluded.\n- [ ] Every factual statement is traceable to visible evidence.\n- [ ] Grounding and authority gaps remain explicit and block Production Release, not Author Review.\n\nThe report intentionally contains no API key, raw prompt, raw model response, or endpoint URL.\n`;
  await writeFile(reportPath, report, "utf8");
  console.log(`REAL SEMANTIC SMOKE TEST = ${automatedPassed ? "PASS" : "NEEDS WORK"}`);
  console.log(`Human Semantic Course Review = NEEDS WORK`);
  console.log(`Report: ${reportPath}`);
  if (!automatedPassed) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown real semantic smoke failure.";
  await writeFile(reportPath, `# Real Semantic Course Review\n\n- Execution: EXECUTED\n- Status: NEEDS WORK\n- Failure: ${message}\n\nNo API key, raw prompt, or raw model response is included.\n`, "utf8");
  console.error("REAL SEMANTIC SMOKE TEST = NEEDS WORK");
  console.error(message);
  process.exitCode = 1;
} finally {
  await rm(root, { recursive: true, force: true });
}
