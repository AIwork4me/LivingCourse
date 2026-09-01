# LivingCourse

Turn enterprise knowledge into maintainable training assets.

> One source in, a reviewable course out.

> Source changes, only affected course assets change.

```text
Raw documents → DocumentParsingProvider → MaterialIR
              → evidence-grounded candidates → guided grounding
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

LivingCourse v0.3.1 adds the MinerU Cloud precise-API transport without changing the v0.3 intake or v0.2.1 compiler boundaries. PDF, DOCX, PPTX, XLSX, PNG/JPEG and Markdown/TXT are discovered and hashed deterministically. Markdown/TXT use the built-in deterministic provider; binary formats use the self-hosted MinerU HTTP adapter by default. Both MinerU transports normalize through the same provider-neutral `MaterialIR` adapter before generation can consume them.

Every factual `KnowledgeCandidate` retains evidence down to a stable source block and normalized location. Conflicts, authority gaps and device-grounding gaps remain candidates for a human author; no path sends an unreviewed `CourseSpecCandidate` to the compiler.

The v0.2.1 evidence suite proves collision-free order-independent element IDs, backward-compatible CourseSpec migration, explicit aligned/normalized/estimated timing quality, cue and caption synchronization from supplied timing, semantic patches after reorder, targeted renderer invalidation, and an immediate zero-AI/zero-rebuild Golden rerun. Production release blockers remain fail-closed.

> Product status: **READY for raw-material author review; NOT READY for arbitrary non-technical manufacturing HR one-pass use.** Clean-machine setup, representative manufacturing evaluation and a real non-technical HR user test remain required.

## Quick start

Requirements: Node.js 20 or newer and pnpm. FFmpeg, FFprobe, supported CJK fonts, and renderer dependencies are checked by `doctor`.

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

`create --dry-run` reports detected files, parser/profile choices, possible `high_fidelity` escalation, the AI-call plan, blockers, and zero calls made before parsing. `create` stops after writing a `CourseSpecCandidate` and a non-technical course review package. It never approves production. The existing build dry run continues to report `REUSE`, `REGENERATE`, `REBUILD`, `BLOCKED`, and predicted LLM/Image/TTS calls.

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
MaterialIR → generation candidates → human review → CourseSpec
                                                   ↓
                                          compiler → renderers
                                                   ↑
                                                workflow
                                                   ↑
                                                  CLI
```

`core` knows what a course is and has no provider or renderer vocabulary. The compiler has no filesystem, network, browser, AI, or media process access. PPT and Remotion adapters execute their plans without inferring course meaning. Static and behavioral architecture tests enforce these boundaries, including a ban on Golden page IDs in generic compiler/renderer source.

## Repository map

- `packages/core`: CourseSpec, JSON Schema, validators, normalizers, migrations, state and release policy.
- `packages/intake`: discovery, hashing, parsing contract, MaterialIR, normalization and EvidenceRef validation.
- `packages/compiler`: deterministic passes and PresentationPlan, VideoPlan, BuildPlan.
- `packages/generation`: knowledge candidates, evidence/conflict checks, grounding policy, review candidate firewall and optional generation capabilities.
- `packages/providers`: isolated provider adapters, including MinerU self-hosted and opt-in MinerU Cloud transports.
- `packages/renderers`: editable PPTX and Remotion MP4 adapters.
- `packages/workflow`: doctor, planning, cache, execution, QA, review, release and resume.
- `apps/cli`: the thin command-line interface.
- `profiles`: frozen visual, caption and character decisions.
- `tests/fixtures/golden-v0.1`: whitelisted, secret-scanned regression fixture copied from the read-only Golden reference.

## Verify everything

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm validate:arch
pnpm validate:security
```

Start with [Architecture](docs/ARCHITECTURE.md), [MinerU providers](docs/MINERU-PROVIDERS.md), [Security and privacy](docs/SECURITY-PRIVACY.md), [CourseSpec](docs/COURSE-SPEC.md), and the [one-pass readiness ledger](docs/ONE-PASS-READINESS.md). v0.3.1 evidence is recorded in [LIVINGCOURSE-V0.3.1-MINERU-CLOUD-REPORT.md](LIVINGCOURSE-V0.3.1-MINERU-CLOUD-REPORT.md); the v0.3 and v0.2.1 reports remain available.
