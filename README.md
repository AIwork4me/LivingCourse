# LivingCourse

Turn enterprise knowledge into maintainable training assets.

> One source in, a reviewable course out.

> Source changes, only affected course assets change.

```text
Materials
   ↓
CourseSpec
   ↓
┌─────────┬────────────┬─────────┐
│         │            │         │
Visuals  PPTX        Voice      MP4
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

LivingCourse Core v0.2.1 hardens the v0.2 pipeline so repeated slide types, slide reorder, nonlinear narration timing and renderer implementation changes remain deterministic. An approved, provider-neutral `CourseSpec` is resolved through layout profiles and provider-neutral timing into an editable PowerPoint deck and a narrated Author Review video. AI may help create a candidate specification or a missing asset, but code owns validation, grounding, layout, timing, captions, motion, caching, incremental impact, and release policy.

The v0.2.1 evidence suite proves collision-free order-independent element IDs, backward-compatible CourseSpec migration, explicit aligned/normalized/estimated timing quality, cue and caption synchronization from supplied timing, semantic patches after reorder, targeted renderer invalidation, and an immediate zero-AI/zero-rebuild Golden rerun. Production release blockers remain fail-closed.

> Product status: **NOT READY for arbitrary non-technical manufacturing HR on a clean machine.** The frozen Golden course completes one pass; arbitrary source ingestion, approved-source mapping, real-device grounding, and clean-machine media setup still require technical or human support.

## Quick start

Requirements: Node.js 20 or newer and pnpm. FFmpeg, FFprobe, supported CJK fonts, and renderer dependencies are checked by `doctor`.

```bash
pnpm install
pnpm livingcourse doctor
pnpm livingcourse validate examples/manufacturing-entry-safety/course-spec.json
pnpm livingcourse build examples/manufacturing-entry-safety/course-spec.json --dry-run
pnpm livingcourse build examples/manufacturing-entry-safety/course-spec.json
```

Dry run reports `REUSE`, `REGENERATE`, `REBUILD`, `BLOCKED`, and predicted LLM/Image/TTS calls before any provider can run. The Golden build uses ten approved reference artifacts and makes zero AI calls. Output is Author Review only while production blockers remain.

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
                     ┌──────────────┐
                     │     core     │  CourseSpec, policy, migration
                     └──────▲───────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
   generation          compiler          provider adapters
   capabilities      pure passes + IR     behind capabilities
                            │
                       renderers
                   Plan → PPTX / MP4
                            ▲
                            │
                         workflow
             IO, cache, QA, review, release, resume
                            ▲
                            │
                           CLI
```

`core` knows what a course is and has no provider or renderer vocabulary. The compiler has no filesystem, network, browser, AI, or media process access. PPT and Remotion adapters execute their plans without inferring course meaning. Static and behavioral architecture tests enforce these boundaries, including a ban on Golden page IDs in generic compiler/renderer source.

## Repository map

- `packages/core`: CourseSpec, JSON Schema, validators, normalizers, migrations, state and release policy.
- `packages/compiler`: deterministic passes and PresentationPlan, VideoPlan, BuildPlan.
- `packages/generation`: capability interfaces, AI-output firewall, finite retry policy.
- `packages/providers`: the minimum approved-reference provider used by the Golden flow.
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

Start with [Architecture](docs/ARCHITECTURE.md), [CourseSpec](docs/COURSE-SPEC.md), and the [one-pass readiness ledger](docs/ONE-PASS-READINESS.md). The complete hardening evidence is in [LIVINGCOURSE-CORE-V0.2.1-REPORT.md](LIVINGCOURSE-CORE-V0.2.1-REPORT.md); the original v0.2 evidence remains in [LIVINGCOURSE-CORE-V0.2-REPORT.md](LIVINGCOURSE-CORE-V0.2-REPORT.md).
