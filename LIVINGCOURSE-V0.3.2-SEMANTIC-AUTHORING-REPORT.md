# LivingCourse v0.3.2 — Evidence-Grounded Semantic Authoring Report

Validation date: 2026-09-01  
Baseline commit: `f0d35dabd6510d3e4c9ee1757a05435aa00e9a87`

## Executive decision

v0.3.2 implements the intended boundary: probabilistic capabilities may propose knowledge drafts and course organization, while deterministic code binds evidence, enforces fidelity and policy, and constructs the review candidate. The existing CourseSpec, compiler, renderers, Golden artifacts and release policy remain unchanged.

- Traceable raw-material intake: **READY** for PDF, DOCX, PPTX, PNG/JPEG and Markdown/TXT.
- Evidence-grounded semantic author review: **READY** within the validated v0.3.2 candidate workflow.
- Non-technical manufacturing HR one-pass: **NOT READY**. A concrete semantic-provider setup, clean-machine validation, guided decision UX, broader evaluation and a real HR pilot remain outstanding.

The default CLI intentionally uses disclosed literal deterministic extraction. The generic structured semantic-provider contracts are in the main workflow and can be injected by an embedding application; no concrete LLM SDK is coupled into workflow, CourseSpec or compiler code.

## Implemented pipeline

```text
MaterialIR
  → KnowledgeUnderstandingCapability
  → KnowledgeCandidateDraft + source hints
  → deterministic EvidenceResolver
  → evidence / numeric / negation validation
  → KnowledgeCandidate
  → conflict / authority / grounding analysis
  → CourseDesignCapability
  → candidate-linked CoursePlanDraft
  → deterministic CourseSpecCandidate assembly
  → human review
  → CourseSpec
  → unchanged compiler
```

Knowledge AI cannot emit EvidenceRefs, authority, grounding, approval or release status. Course Design cannot create slide knowledge items; it can reference validated facts only with `candidateIds`. Narration is candidate-claim composition, and proposed planning text is conservatively checked before it can enter candidate presentation fields.

## Required questions

1. **KnowledgeUnderstandingCapability in create main path:** Yes. `planCreate()` and `executeCreate()` call the semantic authoring planner/executor through an injected capability or explicit deterministic fallback.
2. **CourseDesignCapability in create main path:** Yes. It produces and validates `CoursePlanDraft` after conflict and grounding analysis.
3. **AI candidate-only boundary:** Yes. Structured AI output is `KnowledgeCandidateDraft[]` or `CoursePlanDraft`, never approved knowledge or CourseSpec.
4. **EvidenceRef bound by code:** Yes. The deterministic resolver uses scoped material/unit/block hints, then normalized or unique fuzzy text matching.
5. **Evidence miss fail-closed:** Yes. Missing resolution produces `unsupported_candidate`, no EvidenceRefs and confidence `0`; content-hash mismatch produces `stale_evidence`.
6. **Numeric fidelity:** PASS for `0.55 MPa`, `10 mm`, `80 °C` and `5%`, including a failing `0.65 MPa` mutation.
7. **Negation fidelity:** PASS for Chinese and English prohibitions and for both lost and newly introduced negation.
8. **Duplicate merge:** PASS. Exact normalized duplicates merge to one candidate with multiple EvidenceRefs.
9. **Irrelevant filtering:** PASS for titles, headers/footers, revision history, copyright and office lunch policy.
10. **Confidence not fixed at 1:** Yes. AI confidence is clamped to `0..1`, fuzzy resolution caps at `0.8`, and missing/invalid evidence forces `0`.
11. **Course Design over three slides:** Yes. Plans support 1–20 slides; the semantic fixture produces six.
12. **Legacy general/safety/device fixed mapping removed:** Yes. Candidate assembly consumes an explicit plan; slide type is validated and the deterministic fallback chooses by each group's content, not page index.
13. **CourseDesign candidate references only:** Yes. Each plan slide requires `candidateIds`; unknown, duplicated or ineligible IDs fail validation.
14. **Narration factual invention prevented:** Yes. Final narration is the joined linked candidate claims. Free-form `narrationDraft` is not used.
15. **zh-CN locale propagation:** PASS. Course locale is copied deterministically to every narration language, and the review package exposes Chinese course/slide review labels.
16. **Manual Prompt Count:** `0`.
17. **Manual JSON Edit Count:** `0`.
18. **Identical second semantic build:** Knowledge Understanding `0`, Course Design `0`, total semantic AI calls `0`.
19. **Single-source semantic recompute:** Only the changed material is re-understood; unchanged material drafts and candidate identities are reused.
20. **Course Design cache:** PASS. The cache keys the canonical eligible-candidate set plus course provider/model/prompt/profile identity; an unchanged candidate set is reused even after an irrelevant source-only change.
21. **MinerU Cloud profile truthfulness:** PASS. Cloud advertises only `balanced`; `high_fidelity` blocks before network access and no false escalation is shown.
22. **README XLSX claim:** Removed. XLSX is explicitly documented as not yet verified/supported end to end.
23. **ONE-PASS and ROADMAP alignment:** Updated for v0.3.2; deferred scope is in `docs/V0.4-BACKLOG.md`.
24. **CI:** Added a secret-free GitHub Actions workflow for frozen install, typecheck, lint, tests, architecture and security.
25. **Golden regression:** PASS. Golden PPTX/MP4 hashes and all MaterialIR/CourseSpec contract hashes are unchanged.
26. **Production release:** Still fail-closed. Existing Golden release-blocking behavior passes; grounding gaps block production and authority/conflict decisions require structured human resolution.
27. **Security:** PASS, 199 files scanned, 0 findings.
28. **Clean-machine / HR pilot:** The codebase can begin that next validation phase, but the non-technical one-pass product itself is not ready and no pilot or installer work was started in v0.3.2.

## Semantic quality fixture

`tests/fixtures/semantic-manufacturing-course` contains five public-safe artifacts:

- `approved-sop.pdf`
- `archived-training.pptx`
- `employee-handbook.docx`
- `equipment-photo.jpg`
- `trainer-notes.md`

The content contains more than ten useful facts, revision/copyright/lunch-policy noise, repeated PPE and prohibition facts, a `0.55 MPa` versus `0.65 MPa` authority conflict, explicit negation, an unknown-authority source and an equipment-grounding gap. It produces six evidence-linked candidate slides. All PPTX slides, both DOCX pages, both PDF pages and the image fixture were rasterized and visually inspected; no clipping or overlap was found.

Fixture quality metrics:

| Metric | Result |
| --- | --- |
| Relevant Knowledge Precision | 100% |
| Factual Evidence Coverage | 100% |
| Unsupported Factual Claims | 0 |
| Numeric Fidelity Errors | 0 |
| Negation Fidelity Errors | 0 |
| Irrelevant Knowledge Included | 0 |
| Duplicate Knowledge Candidates | 0 |
| Manual Prompt Count | 0 |
| Manual JSON Edit Count | 0 |
| Course pages | 6 |

## Regression evidence

Final local validation:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — 35 files / 86 tests; 1 opt-in real MinerU file / test skipped |
| `pnpm validate:arch` | PASS — 15 rules, 0 findings |
| `pnpm validate:security` | PASS — 199 files, 0 findings |
| Identical second Golden build | AI 0; regeneration 0; rebuild 0 |
| Identical second intake | parser 0; MaterialIR regeneration 0 |
| Identical second semantic build | Knowledge AI 0; Course Design AI 0 |
| Single-source update | one parser/material knowledge recompute; unrelated materials reused |
| Production Release Gate | PASS — release remains blocked without required decisions/evidence |

Frozen hash comparison:

| Artifact / contract | Baseline SHA-256 | Final SHA-256 | Result |
| --- | --- | --- | --- |
| Golden PPTX | `1E9271F5ECBA66FD68B0A4B887CAFE395D7619CE303ED7FC5BB5AEC0B107D1F4` | same | PASS |
| Golden MP4 | `8CF22AA0DBDBC9EE46E424D941BC17E2C6F16D9DEE28A2861F59CA6B10261B57` | same | PASS |
| MaterialIR types | `90F0188F81E516E98A85508737260FB65EDCF55D8A4CA7626D9C5338DDB2FBD1` | same | PASS |
| CourseSpec types | `4C98F0E2577178FEFD01B95D0992DDFF23F2A6DAEA68ACA42C59C55763EB0351` | same | PASS |
| CourseSpec schema | `F6D5E5E2C0141F7863FEF9A44B197AF107FBA3D5D4C4124E0853209ED73C3C54` | same | PASS |

## Acceptance matrix

```text
Knowledge Understanding Main Path: PASS
Course Design Main Path: PASS
Candidate-only AI Boundary: PASS
Evidence Resolver: PASS
Evidence Integrity: PASS
Numeric Fidelity: PASS
Negation Fidelity: PASS
Relevance Filtering: PASS
Duplicate Merge: PASS
Confidence Semantics: PASS
Arbitrary Slide Count: PASS
No Golden 3-page Mapping: PASS
CourseDesign Candidate Reference: PASS
Narration Factual Safety: PASS
Locale Propagation: PASS
Manual Prompt Count = 0: PASS
Manual JSON Edit Count = 0: PASS
Semantic Cache Reuse: PASS
Incremental Semantic Recompute: PASS
Parser Profile Truthfulness: PASS
README Capability Truthfulness: PASS
Documentation Alignment: PASS
GitHub CI: PASS
Core v0.2.1 Regression: PASS
v0.3 Intake Regression: PASS
v0.3.1 MinerU Regression: PASS
Production Release Gate: PASS
Architecture Gates: PASS
Security: PASS
```

## Readiness decisions

```text
TRACEABLE RAW-MATERIAL INTAKE:
READY

EVIDENCE-GROUNDED SEMANTIC AUTHOR REVIEW:
READY

NON-TECHNICAL MANUFACTURING HR ONE-PASS:
NOT READY
```
