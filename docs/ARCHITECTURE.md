# Architecture

LivingCourse implements one boundary: probabilistic systems may propose meaning; deterministic code produces and governs training assets.

## Dependency direction

```text
core ← compiler ← renderers
  ↑        ↑          ↑
  └ generation ← providers
           \         /
            workflow ← CLI
```

The arrows mean “is imported by.” `workflow` composes the pure compiler, local registry, optional generation capabilities, provider adapters, renderers and release policy. CLI contains no business policy.

| Package | Owns | Must not own |
|---|---|---|
| `core` | CourseSpec, schema, validation, normalization, migration, state, release policy | provider IDs, renderer schema, IO |
| `compiler` | pure passes, IRs, dependency graph, ChangeSet, impact plan | filesystem, network, browser, subprocesses |
| `generation` | capability ports, syntax-only repair, retry classification | course facts, provider credentials |
| `providers` | mapping stable capabilities to a provider | CourseSpec fields or release policy |
| `renderers` | exact Plan-to-PPTX/MP4 execution and structural inspection | source interpretation or course-specific content |
| `workflow` | IO, doctor, registry, plan, execute, QA, review, release, resume | hidden facts or prompt-only policy |
| `cli` | argument parsing and structured output | domain logic |

## Compilation boundary

```text
CourseSpec
  │
  ├─ normalize → validate → grounding → assets → narration
  │              → layout → timing → cues → motion → assemble
  │
  ├─ PresentationPlan ──→ PPT renderer ──→ editable PPTX
  ├─ VideoPlan ─────────→ Remotion ──────→ narrated MP4
  └─ BuildPlan ─────────→ workflow ──────→ reuse/regenerate/rebuild/block
```

External facts enter the compiler only through `AssetProbe`, `TimingProbe`, and `ReviewDecisionSource`. Tests provide in-memory implementations; workflow provides filesystem-backed implementations.

## Machine enforcement

`pnpm validate:arch` scans five boundaries:

1. Core cannot depend on providers, renderers or workflow, and cannot contain provider/renderer vocabulary.
2. Compiler cannot depend on providers, renderers or workflow and cannot call network/browser APIs.
3. Renderer source cannot contain Golden-course wording or provider/workflow dependencies.
4. CourseSpec types and JSON Schema must remain provider-neutral.
5. VideoPlan must not leak provider-specific speech schema.

ESLint and TypeScript strict mode add import, unused-symbol and type safety checks. See [Compiler](COMPILER.md) for pass invariants.
