# Compiler

The compiler is deterministic and side-effect free. Given the same normalized CourseSpec and the same explicitly injected probe results, it returns byte-identical canonical IR.

## Intent and production decisions

`CourseSpec` carries semantic intent. A normal author selects `layout.kind`, supplies course content and refers to semantic targets. Layout `regions` and `safeAreas`, plus motion `atMs` and `durationMs`, are optional expert overrides.

The compiler turns that intent into production decisions:

- A deterministic layout profile supplies complete normalized geometry, reading order and safe areas when no override is present.
- Every element ID is derived from the stable slide ID and semantic local ID using the collision-safe `lc/<slide>/<kind>/<local>` convention. IDs do not depend on page order.
- Cue timing takes precedence over a motion timestamp; a provided timestamp remains an advanced fallback override, followed by a deterministic default.
- The assembled plans contain no unresolved layout or timing decision for a renderer to infer.

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

## Narration timing

`TimingProbe` exposes a provider-neutral timing seam. It may return an audio duration plus sentence segments and optional character segments; provider names, voice IDs and provider response fields never enter the compiler contract.

Resolution follows this order:

1. Timing aligned to the approved audio is retained as `aligned` / `provider_aligned`.
2. Timing from an independent synthesis, or aligned timing with a different duration, is scaled to the approved duration and recorded as `normalized` / `duration_normalized_provider_timing`. Raw timing, source duration, approved duration and scale factor are retained.
3. With no usable timing metadata, deterministic character-ratio estimation remains available as `estimated` / `estimated_linear`, emits `LC-AVSYNC-001`, and sets `requiresHumanAvSyncReview: true`.

Cues first use character timing, then the smallest supplied sentence/semantic segment containing the requested phrase. A repeated phrase requires an explicit `occurrence`; ambiguity emits `LC-CUE-002` rather than silently selecting the first match. A supplied-timing miss emits `LC-CUE-003` before using estimated fallback.

Captions are segmented deterministically, remain at most two lines, and take their start/end times from normalized character or sentence segments. An unresolved caption emits `LC-CAPTION-001` and is individually marked `estimated`. `VideoPlan` carries timing quality on narration, cues, captions and each slide.

## Build fingerprints

The pure compiler accepts five fingerprints through `CompilerContext`: presentation renderer, video renderer, vocabulary, profile and compiler. The workflow calculates stable SHA-256 fingerprints from the actual source/config/profile content that affects output and injects them.

Fingerprint changes invalidate only their deterministic dependents. A presentation-renderer change rebuilds PPTX while reusing MP4 and all approved probabilistic artifacts; a video-renderer change does the inverse. Content-addressed output artifacts allow unchanged deterministic outputs to be reused across otherwise different run identities.

## Determinism contract

Canonical JSON sorts object keys and stable collections. Hash inputs exclude wall-clock time, random values and machine paths. Time, files, review decisions and build implementation identity enter only through injected interfaces. The Golden compiler test runs twice and compares canonical PresentationPlan, VideoPlan and BuildPlan bytes.
