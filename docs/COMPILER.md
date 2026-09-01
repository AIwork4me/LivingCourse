# Compiler

The compiler is deterministic and side-effect free. Given the same normalized CourseSpec and the same explicitly injected probe results, it returns byte-identical canonical IR.

## Passes

```text
normalize
→ validate
→ resolve_grounding
→ resolve_assets
→ resolve_narration
→ resolve_layout
→ resolve_timing
→ resolve_cues
→ resolve_motion
→ assemble
```

Each pass receives immutable typed state, returns a new state and emits explicit diagnostics. The entry point is small; domain work stays in the individual passes.

## Intermediate representations

`PresentationPlan` contains native text, elements, approved asset references, normalized geometry, reading order, speaker notes, safe areas and release scope. A PPT renderer therefore has no reason to interpret course meaning.

`VideoPlan` contains global slide timing, audio placement, captions, cues, motions, transitions, assets, disclosures and release scope. Remotion never parses narration, discovers cues, chooses captions or decides release policy.

`BuildPlan` separates:

- `reuse`: an approved artifact with a matching fingerprint.
- `regenerate`: a probabilistic capability must create a new artifact.
- `rebuild`: deterministic derived output must be recomputed.
- `blocked`: missing evidence, asset or release requirement prevents the relevant scope.

`aiCalls` predicts LLM, image and TTS calls before execution.

## Determinism contract

Canonical JSON sorts object keys and stable collections. Hash inputs exclude wall-clock time, random values and machine paths. Time, files and review decisions enter only through injected interfaces. The Golden compiler test runs twice and compares canonical PresentationPlan, VideoPlan and BuildPlan bytes.
