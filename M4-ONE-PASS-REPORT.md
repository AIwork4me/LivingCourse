# M4 — One-Pass Workflow Report

Status: **PASS**

The milestone is implemented and validated. This does not change the product-level readiness verdict: arbitrary non-technical clean-machine use remains **NOT READY**.

## Automated evidence

- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm test:m4`: PASS — 6 tests
- `pnpm validate:arch`: PASS — 5 enforced boundaries
- `pnpm validate:security`: PASS
- AI-output firewall: syntax repair PASS; attempted business-fact repair rejected
- Retry policy: 429 finite retry PASS; 401 immediate failure PASS
- VoiceProfile/provider VoiceID separation: PASS
- Same-input second build: 0 LLM / 0 image / 0 TTS, 0 regeneration, 0 output rebuild
- Resume: failed video node resumed without rebuilding the completed PPT node
- Deliberate secret fixture: scanner hard-fail PASS
- Golden production release: hard-block PASS

## Real CLI run

`livingcourse validate` accepted the Golden CourseSpec. Pre-call dry-run reported:

- REUSE: 7 approved visual + 3 approved narration artifacts
- REGENERATE: 0
- REBUILD: PresentationPlan, VideoPlan, PPTX, MP4
- BLOCKED: unresolved real-device replacement for Slide 3 production use
- predicted AI calls: 0 / 0 / 0

The first default workflow run produced `dist/one-pass/course.pptx` and `dist/one-pass/author-review.mp4`. The immediately repeated command returned `rebuilt: []` and `regenerated: []`; output timestamps and hashes were unchanged.

Workflow QA returned PASS:

- PPTX: 3 slides, 3 speaker-note parts, editable, 13 native text objects
- presentation overflow test: PASS
- MP4: 1280×720, 30 fps, H.264 + AAC, 55.531 seconds
- all three rendered PPT pages visually inspected
- Review Package: 5 gates, each exposing Approve / Reject / Comment

## Doctor and readiness

`livingcourse doctor` correctly reported Node, pnpm, CJK font, renderer dependencies and filesystem as PASS; provider config as WARN because no generation is planned; and FFmpeg/FFprobe missing from the machine `PATH` as FAIL. Remotion's bundled compositor completed the Golden render, but this environment result is deliberately retained as a clean-machine readiness gap.
