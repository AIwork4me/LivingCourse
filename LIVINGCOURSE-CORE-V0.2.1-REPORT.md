# LivingCourse Core v0.2.1 — De-Goldenization & Timing Fidelity Report

Validation status: **PASS**. The Core is sufficiently de-Goldenized to begin v0.3 Universal Material Intake without changing the existing slide-type, grounding, review, or production-release boundaries. This is an architecture readiness statement, not a claim that arbitrary raw-material intake or production release already exists.

## Acceptance matrix

| Area | Result | Evidence |
|---|---|---|
| Golden Page Assumptions | PASS | Generic compiler and renderer source contain no `slide-01-`, `slide-02-`, or `slide-03-`; the architecture scanner enforces this. |
| Repeated Slide Types | PASS | A real five-slide compiler run with three `step_process` slides produces unique order-independent IDs and deterministic plans. |
| CourseSpec Boundary | PASS | `layout.kind` can resolve complete geometry; regions, safe areas, and motion timestamps are optional overrides. |
| Narration Timing Fidelity | PASS | Provider-neutral aligned, duration-normalized, and explicit estimated timing are represented in `VideoPlan`. |
| Nonlinear Cue Sync | PASS | Supplied nonlinear character timing drives cue and synchronized motion at 6550 ms, not the old character-ratio estimate. |
| Caption Timing | PASS | Supplied timing drives caption ranges; misses emit a diagnostic and are individually marked estimated. |
| Timing Fallback | PASS | Missing timing still builds Author Review output, with `estimated` quality and mandatory Human AV Review. |
| Renderer Fingerprint Invalidation | PASS | Presentation-only and video-only fingerprint changes rebuild only their owned deterministic output with zero AI regeneration. |
| Semantic Patch After Reorder | PASS | Stable slide/item IDs resolve the fresh post-reorder JSON Pointer and preserve dependency identity. |
| Change-001 Incremental | PASS | Only the target Slide 2 subtree is affected; unnecessary regeneration remains 0. |
| Golden PPT Regression | PASS | 3 slides, 3 notes, 13 editable native text objects, no overflow, and all three rendered slide hashes exactly match baseline. |
| Golden Video Regression | PASS | 1280×720, 30 fps, H.264 + AAC, 55.530667 s; MP4 and four representative frame hashes exactly match baseline. |
| Token-free Rebuild | PASS | Immediate second run: LLM 0, Image 0, TTS 0, regeneration 0, PPTX rebuild 0, MP4 rebuild 0. |
| Production Release Gate | PASS | Release remains blocked by 13 grounding, review, synthetic/PoC-only, real-device, SOP, and production-decision errors. |
| Architecture Gates | PASS | 6 static rules with 0 findings plus 4 required behavioral architecture regressions in the default test suite. |
| Security | PASS | 130 files scanned with 0 findings. |

## 1–6. De-Goldenization and CourseSpec boundary

1. Golden-specific page/title assumptions were removed from layout, cue, and motion resolution. Element IDs now use the collision-safe URI-style convention `lc/<encoded-slide-id>/<kind>/<encoded-local-id>` and are derived from stable semantic IDs, never page position.
2. Generic compiler/renderer implementation has no `slide-01/02/03` dependency. Fixtures and examples retain their legitimate Golden IDs; the new static rule scans only generic source.
3. `repeated-slide-types.test.ts` passes against a real compiler run containing hero, three repeated step-process slides, and safety-focus. It verifies unique IDs, preserved slide IDs, deterministic PresentationPlan/VideoPlan, and no per-slide renderer change.
4. The boundary is clearer: CourseSpec describes teaching and presentation intent; deterministic profiles and passes resolve complete geometry, reading order, safe areas, cues, timing, and motion into production plans.
5. Backward compatibility is preserved. The frozen Golden fixture was not edited and remains serialized as CourseSpec `0.2.0`.
6. The serialized contract changed compatibly to `0.2.1`. The real contiguous `0.1.0 → 0.2.0 → 0.2.1` migration runs automatically and is idempotent. Layout geometry fields and motion timestamps are optional; narration cue `occurrence` is optional.

## 7–12. Narration timing fidelity

7. `TimingProbe` can return provider-neutral `NarrationTimingProbeResult`: approved-independent duration, sentence segments, optional character segments, and a neutral method. The normalized result retains approved duration, timing-source duration, scale factor, normalized segments, raw timing, method, quality, and Human AV Review status.
8. Priority is explicit:
   - `aligned` / `provider_aligned`: timing already matches the approved audio duration; scale factor 1.
   - `normalized` / `duration_normalized_provider_timing`: raw timing is preserved and every boundary is scaled by `approvedDuration / timingSourceDuration`.
   - `estimated` / `estimated_linear`: deterministic fallback when timing is missing or invalid; Human AV Review is required.
9. Cues do not use linear timing when supplied timing is available. Character timing is preferred, then the containing sentence/semantic segment. Linear calculation exists only as an explicit estimated fallback. Repeated phrases require `occurrence` or emit `LC-CUE-002`.
10. Captions likewise prefer supplied normalized timing. Deterministic semantic chunking remains, while character-ratio timing is only the marked fallback. A supplied-timing miss emits `LC-CAPTION-001`.
11. The no-metadata fallback remains usable for Author Review and does not fail the build.
12. Every estimated Golden slide reports `timingQuality: estimated`, `requiresHumanAvSyncReview: true`, and `LC-AVSYNC-001`. Production policy was not relaxed.

## 13–17. Cache invalidation and living patches

13. Renderer fingerprints participate in PresentationPlan/VideoPlan and deterministic output fingerprints. Workflow computes stable SHA-256 values from real renderer source, core vocabulary/schema/policies, profiles, and compiler source, then injects them into the pure compiler/dependency graph.
14. The invalidation regression proves a presentation renderer change rebuilds PPTX only, and a video renderer change rebuilds MP4 only. In both cases approved images/audio are reused and LLM/Image/TTS calls are zero.
15. The Semantic Locator `{ slideId: "safety-preparation", section: "knowledge", itemId: "eye-face-protection", field: "text" }` resolves `/slides/1/...` before reorder and `/slides/0/...` after reading the reordered CourseSpec. It then creates the existing smallest ChangeSet.
16. Change-001 continues to affect only the target knowledge/visual/narration/timing/plan subtree. Slide 1 and Slide 3 content hashes remain unchanged; renderer/provider source is not involved.
17. Unnecessary regeneration remains 0. Expected-old-value verification remains in the JSON Pointer engine, and repeating a stale patch still fails loudly with `LC-CHANGE-001`.

## 18–23. Golden, release, and readiness

18. Golden PPT content and appearance did not regress. The binary changed because production-plan element identities changed, but structural QA remains 3 slides / 3 notes / editable / 13 native text objects, the overflow test passes, and every rendered page is pixel-identical by SHA-256.
19. Golden MP4 did not regress: its SHA-256 and all four representative still hashes are identical to baseline; audio/video metadata and duration are unchanged. Captions remain black native text on transparent, borderless, block-free backgrounds with at most two lines.
20. The immediate second Golden build used 12 reuses (7 visuals, 3 audio files, PPTX, MP4), zero regeneration, zero actual rebuilds, and zero AI calls.
21. Production Release remains correctly blocked. No blocker, grounding rule, or required human review was removed.
22. Security passes with zero findings.
23. The Core is ready to expand the input space in v0.3 because existing slide types no longer depend on the accidental three-page Golden order, and timing, patches, dependency identity, and implementation invalidation are explicit and behaviorally tested. Universal intake itself, aligned-timing adapters, additional slide types, real-device evidence, UI, LMS, and remote persistence remain out of scope in `docs/V0.3-BACKLOG.md`.

## Reproducible evidence

### Validation commands

- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm test`: PASS — 10 files / 32 tests
- Required behavioral subset: PASS — 5 files / 12 tests
- `pnpm validate:arch`: PASS — 6 rules / 0 findings
- `pnpm validate:security`: PASS — 130 files / 0 findings
- Golden validate, dry-run, build, second build: PASS
- Golden release: expected FAIL-CLOSED — 13 blocking errors

### Golden identity and plans

- CourseSpec file SHA-256: `86bd4cfbf5976c9f371774a7604e972ee91314b4b57232404b24702fecfc5a44` — unchanged
- CourseSpec canonical SHA-256: `08875d02dfbb7ba93da706ef90031978789b50ba8d40fe4228c075b6a233ade3` — unchanged
- PresentationPlan SHA-256: `4976834f8f767c49d0ff6f20e35203983b0745e59fc9b3efd1e465e05cf2645c`
- PresentationPlan content hash: `732a17983a9d2f3cb26483616e96e4902af46d8daea87064f42b825ba6158168`
- VideoPlan SHA-256: `b0973affa9684ceb33cd3715d60acd5cfef5f67034c7fb480269dfabf073bd8e`
- VideoPlan content hash: `dcacc7acd4755b83908c1babc2a9e51db0e8e223172cf98713f1785fd7954e81`
- Planned duration: 55,500 ms / 1,665 frames

### Content fingerprints

- Presentation renderer: `bb24a205f8fdbdd35c964a84500a4fe3a17e477595e8bbd69bd812f6657fa067`
- Video renderer: `2f866b5d2b47e7306550358a8cb059f6093799b1fb4144e8730b3ac4dec3d14b`
- Vocabulary: `77e55884b73349301b93313e9606db6d0be989b1d78821c50fafc874fd34c8e4`
- Profile: `0b0ea5f385242a39f0bacdca27ba8dfdefd6d164103756a8ff0e80e2c150d75b`
- Compiler: `8c9b0972ed6d40bc541c88569d97983be770f7e7d6993a1a5679f8c7d4449043`

### Golden output regression

- PPTX SHA-256: `f8d2b007cd2025bb5a37ab2e35cc07a16dcbc964975d239f7dbfd46c2d59a557`
- Slide PNGs: `57a15cdf…a356eb`, `d5ff1272…329159`, `9be486e2…58be22` — each exactly matches baseline
- MP4 SHA-256: `a9f274ce769d49e4d70c3c974135722c4cc3b974243c5d8b9a83a6b567a0ef48` — exactly matches baseline
- Representative video stills: `a583925d…461fcf`, `55fa78ab…20aed6`, `ad3259cd…32a4b5`, `d5ff14a3…91e182` — each exactly matches baseline
- Encoded media: 55.530667 s, 1280×720, 30 fps, H.264 video, AAC audio

## Decision

**READY FOR v0.3 UNIVERSAL MATERIAL INTAKE**

LivingCourse Core v0.2.1 — De-Goldenization & Timing Fidelity validation complete.
