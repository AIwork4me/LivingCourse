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
   ↓
Compiler
   ↓
PresentationPlan
   ↓
PPT Renderer

CourseSpec
   ↓
Narration Timing
   ↓
Video Compiler
   ↓
VideoPlan
   ↓
Remotion
```

`CourseSpec` states what should be taught and the intended presentation semantics. It may select a layout kind, semantic targets, motion actions and optional advanced overrides. It does not need to contain resolved geometry or production timestamps. Intent is not resolved production timing.

The compiler normalizes and validates the course, resolves grounding and assets, applies deterministic layout profiles, normalizes provider-neutral narration timing, resolves cues and motion, then assembles complete production plans. `PresentationPlan` says exactly what the PPT renderer draws. `VideoPlan` says exactly what Remotion executes, including timing quality and human AV-review status.

External facts enter the compiler only through `AssetProbe`, `TimingProbe`, `ReviewDecisionSource`, and injected build fingerprints. Tests provide in-memory implementations; workflow provides filesystem-backed implementations and computes content fingerprints. The dependency graph never reads the filesystem, Git, network, or renderer source itself.

## Machine enforcement

`pnpm validate:arch` scans six boundaries:

1. Core cannot depend on providers, renderers or workflow, and cannot contain provider/renderer vocabulary.
2. Compiler cannot depend on providers, renderers or workflow and cannot call network/browser APIs.
3. Renderer source cannot contain Golden-course wording or provider/workflow dependencies.
4. CourseSpec types and JSON Schema must remain provider-neutral.
5. VideoPlan must not leak provider-specific speech schema.
6. Generic compiler and renderer source cannot contain Golden page-number IDs such as `slide-01-`, `slide-02-`, or `slide-03-`.

The default behavioral suite complements these static guards with repeated slide types, nonlinear narration timing, semantic patch after reorder, and renderer-fingerprint invalidation. ESLint and TypeScript strict mode add import, unused-symbol and type safety checks. See [Compiler](COMPILER.md) for pass invariants.
