# M1 — Compiler Report

Status: **PASS**

Pass order: normalize → validate → resolve_grounding → resolve_assets → resolve_narration → resolve_layout → resolve_timing → resolve_cues → resolve_motion → assemble.

- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm test:m1`: PASS — 3 tests
- Same CourseSpec → byte-identical canonical PresentationPlan, VideoPlan, and BuildPlan
- Golden timeline: 1665 frames / 55.500 seconds
- Approved Golden reuse: 7 visual + 3 audio artifacts
- Planned generation: 0 LLM / 0 Image / 0 TTS
- Compiler direct filesystem/network/browser/media access: none

All presentation geometry, native text, reading order, speaker notes, timing, captions, cues, motion, disclosures, and release scope are resolved before a renderer runs.
