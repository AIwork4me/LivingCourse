# M3 — Living Engine Report

Status: **PASS**

- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm test:m3`: PASS — 3 tests
- Direct patch: `/slides/1/knowledge/items/2/text`
- Expected-old guard: PASS; stale second write fails with `LC-CHANGE-001`
- Changed node: `knowledge:slide-02-step-process:slide-02-item-goggles`
- Affected content subtree: Slide 2 only
- First-change regeneration: 1 visual + 1 narration audio
- Deterministic rebuild: timing, cue, caption, PresentationPlan, VideoPlan, PPTX, MP4 encode
- Slide 1 content hash: unchanged
- Slide 3 content hash: unchanged
- Shared renderers and vocabulary: unchanged
- Unnecessary regeneration: 0
