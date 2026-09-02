# LivingCourse

Turn enterprise knowledge into maintainable training assets.

> One source in, a reviewable course out.

> Source changes, only affected course assets change.

```text
Raw documents → DocumentParsingProvider → MaterialIR
              → KnowledgeCandidateDraft → deterministic EvidenceResolver
              → validated candidates → conflict / authority / grounding
              → CoursePlanDraft → deterministic candidate assembly
              → CourseSpecCandidate → human review → CourseSpec
              → editable PPTX + narrated MP4
```

```text
New Source
   ↓
Diff
   ↓
Impact
   ↓
Only affected assets regenerate
```

LivingCourse v0.3.3 adds a default-configurable OpenAI-compatible semantic transport without changing the v0.2.1 CourseSpec, MaterialIR, compiler or renderer contracts. PDF, DOCX, PPTX, PNG/JPEG and Markdown/TXT are discovered and hashed deterministically. Markdown/TXT use the built-in deterministic provider; binary formats use the self-hosted MinerU HTTP adapter by default. Both MinerU transports normalize through the same provider-neutral `MaterialIR` adapter before generation can consume them. XLSX is not yet a verified discovery/Core capability.

Knowledge and course-design capabilities run in the main `create` path. When the four semantic environment variables are complete, the CLI automatically creates one shared OpenAI-compatible transport and distinct prompt-versioned Knowledge Understanding and Course Design providers. An AI provider may emit only `KnowledgeCandidateDraft` source hints and a candidate-linked `CoursePlanDraft`; deterministic code binds and validates EvidenceRefs, checks numeric and negation fidelity, detects conflicts, applies authority and grounding policy, and constructs the `CourseSpecCandidate`. With no semantic provider configured, `create` remains available in clearly disclosed literal deterministic fallback mode. An explicitly selected but incomplete provider fails loudly.

The v0.2.1 evidence suite proves collision-free order-independent element IDs, backward-compatible CourseSpec migration, explicit aligned/normalized/estimated timing quality, cue and caption synchronization from supplied timing, semantic patches after reorder, targeted renderer invalidation, and an immediate zero-AI/zero-rebuild Golden rerun. Production release blockers remain fail-closed.

Product status:

```text
TRACEABLE RAW-MATERIAL INTAKE: READY
SEMANTIC AUTHORING ARCHITECTURE: READY
CLI SEMANTIC PROVIDER: READY
REAL SEMANTIC E2E: NOT EXECUTED
NON-TECHNICAL MANUFACTURING HR ONE-PASS: NOT READY
```

The real semantic smoke was not executed because no semantic endpoint/model/key was configured. Clean-machine validation, broader representative evaluation and a real non-technical HR pilot remain required.

## Quick start

Requirements: Node.js 22.13 or newer and pnpm. FFmpeg, FFprobe, supported CJK fonts, and renderer dependencies are checked by `doctor`.

```bash
pnpm install
pnpm livingcourse doctor
pnpm livingcourse create ./materials --dry-run
pnpm livingcourse intake ./materials
pnpm livingcourse create ./materials
pnpm livingcourse validate examples/manufacturing-entry-safety/course-spec.json
pnpm livingcourse build examples/manufacturing-entry-safety/course-spec.json --dry-run
pnpm livingcourse build examples/manufacturing-entry-safety/course-spec.json
```

`create --dry-run` reports detected files, truthful parser/profile choices, changed and reusable semantic materials, predicted Knowledge Understanding and Course Design calls, blockers, and zero calls made before parsing. MinerU Cloud advertises only `balanced`; `high_fidelity` is shown only for providers that implement it. `create` stops after writing a `CourseSpecCandidate` and a non-technical course review package. It never approves production. The existing build dry run continues to report `REUSE`, `REGENERATE`, `REBUILD`, `BLOCKED`, and predicted LLM/Image/TTS calls.

### Semantic provider

The supported v0.3.3 provider is a generic OpenAI-compatible `chat/completions` endpoint. Configure it through environment variables only:

```bash
LIVINGCOURSE_SEMANTIC_PROVIDER=openai-compatible
LIVINGCOURSE_SEMANTIC_BASE_URL=https://model.example/v1
LIVINGCOURSE_SEMANTIC_MODEL=your-model
LIVINGCOURSE_SEMANTIC_API_KEY=...       # environment only; never put it in a file
LIVINGCOURSE_SEMANTIC_TIMEOUT_MS=30000  # optional
```

Root base URLs and URLs ending in `/v1` are both accepted and normalize to one `/v1/chat/completions` endpoint. URLs with credentials, query strings, fragments, or non-HTTP(S) schemes are rejected. Loopback endpoints are disclosed as local; all others are disclosed as remote. Before remote execution, the CLI states: `Semantic authoring will send parsed source content to a remote model endpoint.` Dry runs disclose provider, model, processing location, changed/reused materials and predicted calls without making a request or displaying the key.

If `LIVINGCOURSE_SEMANTIC_PROVIDER` is absent or `literal`, the CLI prints `NOT_CONFIGURED` and uses zero-call literal deterministic fallback. Run `pnpm test:semantic-real` only with all four variables configured; otherwise it prints `REAL SEMANTIC SMOKE TEST = NOT EXECUTED`. The opt-in smoke stops at Author Review and never invokes image generation, TTS, rendering or release. See [Semantic providers](docs/SEMANTIC-PROVIDERS.md).

### MinerU and privacy

Self-hosted MinerU remains the default: `MINERU_API_URL` selects its endpoint, otherwise LivingCourse uses `http://127.0.0.1:8000`. MinerU Cloud is opt-in only:

```bash
LIVINGCOURSE_DOCUMENT_PROVIDER=mineru-cloud
MINERU_API_TOKEN=...                  # environment only; never put it in a file
MINERU_CLOUD_BASE_URL=https://mineru.net  # optional
```

Cloud mode uses MinerU's precise v4 signed-upload flow with `model_version=vlm`; it never uses the lightweight Agent API. Before upload, CLI output says `This parser processes source files on a remote service.` Provenance and the review package identify `mineru-cloud`, `remote`, and `public_remote`. Authorization values and temporary upload/download URLs are neither logged nor stored in MaterialIR, cache metadata, reports, or long-lived provenance. Parser artifacts and caches live under `.livingcourse/`, which is gitignored.

Run the opt-in real smoke test with `pnpm test:mineru-cloud`. Without `MINERU_API_TOKEN`, it reports `REAL MINERU CLOUD SMOKE TEST = NOT EXECUTED`. See [MinerU providers](docs/MINERU-PROVIDERS.md), [Security and privacy](docs/SECURITY-PRIVACY.md), and [third-party notices](THIRD_PARTY_NOTICES.md).

Other commands:

```bash
pnpm livingcourse diff old-course.json new-course.json
pnpm livingcourse update course-spec.json --source replacement-course-spec.json
pnpm livingcourse review approve course-spec.json gate-id --reviewer "Name"
pnpm livingcourse review reject course-spec.json gate-id --reviewer "Name"
pnpm livingcourse release course-spec.json
```

Failures are emitted as structured records with a stable code, what happened, why, whether automatic repair is safe, the required user action, and whether retrying spends AI tokens.

## Architecture at a glance

```text
Raw documents
     ↓
DocumentParsingProvider ← MinerU self-hosted / MinerU Cloud / built-in text
     ↓
MaterialIR → KnowledgeCandidateDraft → EvidenceResolver → KnowledgeCandidate
                                                           ↓
                                                    CoursePlanDraft
                                                           ↓
                                             CourseSpecCandidate → human review
                                                                   ↓
                                                             CourseSpec
                                                                   ↓
                                                    compiler → renderers
```

`core` knows what a course is and has no provider or renderer vocabulary. The compiler has no filesystem, network, browser, AI, or media process access. PPT and Remotion adapters execute their plans without inferring course meaning. Static and behavioral architecture tests enforce these boundaries, including a ban on Golden page IDs in generic compiler/renderer source.

## Repository map

- `packages/core`: CourseSpec, JSON Schema, validators, normalizers, migrations, state and release policy.
- `packages/intake`: discovery, hashing, parsing contract, MaterialIR, normalization and EvidenceRef validation.
- `packages/compiler`: deterministic passes and PresentationPlan, VideoPlan, BuildPlan.
- `packages/generation`: semantic draft contracts, deterministic evidence/fidelity checks, conflict and grounding policy, candidate-linked course planning, and the review candidate firewall.
- `packages/providers`: isolated provider adapters, including MinerU transports and the OpenAI-compatible structured-generation transport.
- `packages/renderers`: editable PPTX and Remotion MP4 adapters.
- `packages/workflow`: doctor, planning, cache, execution, QA, review, release and resume.
- `apps/cli`: the thin command-line interface.
- `profiles`: frozen visual, caption and character decisions.
- `tests/fixtures/golden-v0.1`: whitelisted, secret-scanned regression fixture copied from the read-only Golden reference.
- `tests/fixtures/semantic-manufacturing-course`: public-safe five-format fixture for relevance, duplicate, numeric, negation, conflict, authority, grounding and six-slide authoring tests.

## Verify everything

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:semantic-real  # optional; skips unless the real semantic environment is complete
pnpm validate:arch
pnpm validate:security
```

Start with [Architecture](docs/ARCHITECTURE.md), [Semantic providers](docs/SEMANTIC-PROVIDERS.md), [MinerU providers](docs/MINERU-PROVIDERS.md), [Security and privacy](docs/SECURITY-PRIVACY.md), [CourseSpec](docs/COURSE-SPEC.md), and the [one-pass readiness ledger](docs/ONE-PASS-READINESS.md). v0.3.3 evidence is recorded in [LIVINGCOURSE-V0.3.3-REAL-SEMANTIC-REPORT.md](LIVINGCOURSE-V0.3.3-REAL-SEMANTIC-REPORT.md); earlier reports remain available.
