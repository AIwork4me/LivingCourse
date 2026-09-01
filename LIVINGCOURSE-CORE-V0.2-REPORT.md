# LivingCourse Core v0.2 — Final Report

Implementation status: **complete for M0–M4 and ready for human architecture and quality review.** Product readiness for arbitrary non-technical manufacturing HR remains **NOT READY**.

## Acceptance result

| Area | Result | Evidence |
|---|---|---|
| CourseSpec | PASS | provider-neutral TS types + JSON Schema + runtime/business validators + idempotent normalizers + migration ladder |
| Compiler | PASS | 10 pure passes; same input yields byte-identical canonical PresentationPlan, VideoPlan and BuildPlan |
| Renderer Regression | PASS | editable 3-slide PPTX; 1280×720/30fps H.264 + AAC MP4; structural and visual QA |
| Living Engine | PASS | JSON Pointer ChangeSet, stale-write guard, field-level dependency graph and impact planning |
| Token-free Rebuild | PASS | identical second build: 0 LLM, 0 image, 0 TTS, 0 regeneration, 0 PPTX/MP4 rebuild |
| Change-001 Incremental | PASS | Slide 2 subtree only; Slides 1/3 unchanged; unnecessary regeneration 0 |
| Production Release Gate | PASS | synthetic, PoC-only, unresolved grounding, missing real-device/SOP/anchor and missing approval are hard-blocked |
| Security | PASS | repository scan plus deliberate-secret failure test |
| Non-technical One-Pass Readiness | NOT READY | clean-machine media diagnostics and arbitrary-source/grounding flow remain incomplete |

## Contract

- CourseSpec is the only course source of truth. Renderer output, prompts and registry entries are derived artifacts.
- Knowledge, presentation intent and governance are separate contracts.
- Provider-specific model/voice/render fields are absent from CourseSpec and blocked by architecture tests.
- TypeScript types, cross-language JSON Schema, runtime validation, business validation, idempotent normalization, stable failure codes, state transitions and a pure contiguous migration infrastructure are present.
- `COURSE_SPEC_VERSION` is independent from package versions.

## Compiler and renderers

- Pass order is normalize → validate → grounding → assets → narration → layout → timing → cues → motion → assemble.
- Filesystem/review/timing facts enter through explicit probes; compiler tests use no network, AI, media process or browser.
- PresentationPlan fully resolves editable native text, elements, assets, geometry, reading order, notes and safe areas.
- VideoPlan fully resolves timing, audio, captions, cues, motion, transitions, disclosures and release scope.
- PPT and Remotion adapters consume only their IR and contain no Golden-course wording.

The actual one-pass outputs are:

- `dist/one-pass/course.pptx` — 11,419,839 bytes; SHA-256 `C0E5AAA7FCC0FD32AF8150CAFCB4C7E2D5FC5C1A048FEA9D83536E79BFA2AE1F`
- `dist/one-pass/author-review.mp4` — 12,366,765 bytes; SHA-256 `A9F274CE769D49E4D70C3C974135722C4CC3B974243C5D8B9A83A6B567A0EF48`

## Living Engine and token efficiency

Change-001 is represented as a smallest `replace` operation at `/slides/1/knowledge/items/2/text` with an expected old value. A stale repeat fails with `LC-CHANGE-001`. The dependency graph reaches only the affected Slide 2 visual/narration/audio/timing/cue/caption/plan nodes; content hashes for Slides 1 and 3 remain equal.

The local registry stores content-addressed artifacts with source hash, generation fingerprint, provenance, review status and dependencies. The Golden dry-run predicts ten approved reuses, no provider calls and one production-only blocked asset. The first workflow run builds both outputs. The immediate second run reuses the ten inputs plus both outputs and invokes neither renderers nor AI.

Run-state checkpoints are atomic. A regression test fails the video node once and confirms that the resumed run calls PPT once and video twice, proving completed predecessors are retained.

## Quality

- Golden oracle remains read-only; original manifest SHA-256 is `D84F74258AE12F600888E59D00FB1657B2153D78DFB55A8387FE48B457F6541F`.
- Golden MP4: 55.552 seconds; v0.2: 55.531 seconds; delta 0.021 seconds.
- Slides 1 and 2 preserve the approved hierarchy, visuals and teaching sequence.
- Slide 3 intentionally uses the disclosed synthetic Author Review view; production eligibility remains blocked.
- Captions remain black native text, transparent, borderless, without a colored block, and at most two lines.
- PPT structural QA, overflow detection, all-page visual inspection and representative video-frame inspection passed.

## Safety and security

Production release is a code decision. The Golden `release` run fails with stable errors for missing production review, unverified procedural grounding, synthetic/PoC-only content, missing real-device anchor, unresolved release blockers and missing production decision. Review commands cannot create an illegal lifecycle transition or bypass policy.

AI structured output accepts syntax-only repair and rejects ungrounded business changes. Provider retry is finite and status-aware. The public-package scan blocks API keys, bearer tokens, raw credentials, signed temporary URLs, private keys, customer-record identifiers and government IDs; the whitelisted Golden copy excludes raw provider responses, temporary URLs, runtime cache and logs.

## Product readiness

Core v0.2 is materially closer to one-pass success because it converts hidden workflow knowledge into inspectable contracts, deterministic plans, exact impact analysis, reusable assets, structured recovery and fail-closed release gates.

It is not yet enough for a typical manufacturing HR user with arbitrary raw materials. Raw multi-format ingestion, guided authority/grounding mapping, real-device evidence collection and clean-machine FFmpeg/FFprobe discovery still need work. A single successful Golden course cannot establish a general success rate. The readiness ledger and exit criteria are maintained in `docs/ONE-PASS-READINESS.md`.

## Milestone reports

- `M0-CONTRACT-REPORT.md`: PASS
- `M1-COMPILER-REPORT.md`: PASS
- `M2-RENDERER-REPORT.md`: PASS
- `M3-LIVING-ENGINE-REPORT.md`: PASS
- `M4-ONE-PASS-REPORT.md`: PASS
