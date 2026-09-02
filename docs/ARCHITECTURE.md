# Architecture

LivingCourse implements one boundary: probabilistic systems may propose meaning; deterministic code produces and governs training assets.

## Dependency direction

```text
core ← compiler ← renderers
  ↑
intake ← generation
  ↑          ↑
providers   │
    ↑       │
    └── workflow ← CLI
```

The arrows mean “is imported by.” `workflow` composes the pure compiler, local registry, optional generation capabilities, provider adapters, renderers and release policy. CLI contains no business policy.

| Package | Owns | Must not own |
|---|---|---|
| `core` | CourseSpec, schema, validation, normalization, migration, state, release policy | provider IDs, renderer schema, IO |
| `intake` | source discovery/hash, DocumentParsingProvider contract, MaterialIR, normalization, EvidenceRef | MinerU schema, provider selection policy, CourseSpec approval |
| `compiler` | pure passes, IRs, dependency graph, ChangeSet, impact plan | filesystem, network, browser, subprocesses |
| `generation` | KnowledgeCandidateDraft and CoursePlanDraft contracts, deterministic evidence/fidelity checks, conflict analysis, grounding policy, candidate firewall | raw provider response types, provider credentials, direct AI EvidenceRefs, automatic factual approval |
| `providers` | mapping raw parser responses to stable intake contracts; OpenAI-compatible HTTP transport for structured semantic generation | CourseSpec fields, release policy, semantic prompts or credentials |
| `renderers` | exact Plan-to-PPTX/MP4 execution and structural inspection | source interpretation or course-specific content |
| `workflow` | IO, doctor, registry, plan, execute, QA, review, release, resume | hidden facts or prompt-only policy |
| `cli` | argument parsing and structured output | domain logic |

## Intake and approval boundary

```text
Raw Document
     ↓
DocumentParsingProvider
     ↓
Shared MinerU Adapter or built-in text parser
     ↓
MaterialIR
     ↓
KnowledgeUnderstandingCapability (probabilistic or literal fallback)
     ↓
KnowledgeCandidateDraft + source hints
     ↓
Deterministic EvidenceResolver + numeric / negation fidelity
     ↓
Validated KnowledgeCandidate + EvidenceRef
     ↓
Conflict + Grounding analysis
     ↓
CourseDesignCapability → candidate-linked CoursePlanDraft
     ↓
Deterministic candidate assembly
     ↓
CourseSpecCandidate
     ↓
Explicit human review
     ↓
CourseSpec
```

Provider-specific structured output is confined to `packages/providers/src/mineru`. `MaterialIR` uses stable block IDs, a single normalized 0–1 coordinate meaning, and parse provenance. A provider replacement changes only provider registration/configuration; downstream contracts consume `MaterialIR`.

The OpenAI-compatible semantic transport is confined to `packages/providers/src/semantic`. Workflow resolves environment configuration, reads the authoritative prompt Markdown files and composes the existing generation capability contracts. One transport is shared by the two capabilities, while their prompt versions and hashes remain distinct. The transport never imports CourseSpec, compiler or renderer code; those layers contain zero semantic endpoint, credential or protocol dependencies.

MinerU has two transport implementations: the backward-compatible self-hosted provider (`mineru`) and the opt-in precise Cloud provider (`mineru-cloud`). Cloud-specific upload, polling, authentication, and temporary URLs remain inside the Cloud provider. Both implementations call the same v2/legacy normalization functions; no Cloud transport vocabulary crosses into MaterialIR, CourseSpec, compiler IR, or renderers.

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

Semantic AI provider/model/prompt metadata is recorded only on `CourseSpecCandidate`. It never enters MaterialIR, CourseSpec, compiler IR, or renderer plans. Knowledge AI cannot emit EvidenceRefs, authority, grounding, approval, or release status. Course Design sees validated candidates and can reference facts only with `candidateIds`; final slide knowledge and narration are composed deterministically from those candidates.

Knowledge understanding is cached per material with MaterialIR hash plus capability provider/model/prompt/profile identity. Course design is cached by the canonical eligible-candidate set and its own capability identity. Therefore a changed source re-runs only the affected material, and course design re-runs only when its factual candidate view changes.

## Machine enforcement

`pnpm validate:arch` scans sixteen boundaries:

1. Core cannot depend on providers, renderers or workflow, and cannot contain provider/renderer vocabulary.
2. Compiler cannot depend on intake, providers, renderers or workflow and cannot call network/browser APIs.
3. Renderer source cannot contain Golden-course wording or provider/workflow dependencies.
4. CourseSpec types and JSON Schema must remain provider-neutral.
5. VideoPlan must not leak provider-specific speech schema.
6. Generic compiler and renderer source cannot contain Golden page-number IDs such as `slide-01-`, `slide-02-`, or `slide-03-`.
7. The intake contract cannot import provider implementations or contain raw MinerU schema vocabulary.
8. Generation cannot import MinerU/provider response types or use MinerU vocabulary.
9. CourseSpec cannot contain MinerU vocabulary.
10. Generation must import and consume the provider-neutral `MaterialIR` contract.
11. Workflow cannot import a concrete LLM SDK.
12. CourseSpec cannot contain semantic provider, model, or prompt metadata.
13. `KnowledgeCandidateDraft` can contain source hints but cannot assign EvidenceRefs, grounding, authority, or approval.
14. `CoursePlanSlideDraft` can introduce factual content only through `candidateIds`.
15. Candidate generation cannot contain the legacy fixed three-page category/index mapping.
16. Core, compiler and renderers cannot contain semantic environment variables, OpenAI-compatible protocol vocabulary or the concrete semantic transport.

The behavioral suite complements these static guards with evidence miss/staleness, numeric and negation fidelity, duplicate merge, relevance filtering, more-than-three-slide plans, locale propagation, semantic cache reuse, selective recomputation, repeated slide types, nonlinear narration timing, semantic patch after reorder, and renderer-fingerprint invalidation. ESLint and TypeScript strict mode add import, unused-symbol and type safety checks. See [Compiler](COMPILER.md) for pass invariants.
