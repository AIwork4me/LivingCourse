# LivingCourse v0.3 validation report

Validation date: 1 September 2026 (Asia/Shanghai)

Scope: provider-based raw materials to a reviewable `CourseSpecCandidate`. This release stops at human review. It does not add Studio UI, a database, LMS, accounts, storage services, new renderers, new TTS providers or additional document parsers.

## Executive result

- READY FOR RAW-MATERIAL AUTHOR REVIEW: **YES**, when a healthy explicitly configured MinerU endpoint is available for binary documents. Markdown/TXT works in-process.
- NON-TECHNICAL MANUFACTURING HR ONE-PASS: **NOT READY**. Clean-machine setup, guided setup, representative manufacturing evaluation and a real non-technical HR user test have not been completed.
- REAL MINERU SMOKE TEST: **NOT EXECUTED**. `MINERU_API_URL` was not configured and no local service was listening. The conditional smoke test was skipped, not reported as passing.

## Validation evidence

| Evidence | Result |
|---|---|
| TypeScript / ESLint | PASS |
| Default tests | PASS — 21 files / 44 tests; 1 conditional real-MinerU test skipped |
| Architecture gates | PASS — 10 rules / 0 findings |
| Security scan | PASS — 167 text files / 0 findings |
| Synthetic raw fixture | PASS — PDF, DOCX, PPTX, JPEG and Markdown discovered; deterministic replacement-provider pipeline produced a pending review candidate |
| Fixture visual QA | PASS — DOCX 2 pages, PDF 2 pages and PPTX 2 slides inspected individually; PPT overflow test passed |
| Candidate factual evidence coverage | 100% in the synthetic Golden raw-material run |
| Manual Prompt Count | 0 |
| Manual JSON Edit Count | 0 |
| Parser cache | PASS — identical second run: 0 parser calls, 0 MaterialIR regeneration, unchanged hashes |
| Single-source update | PASS — A reparsed; B/C unchanged; only candidates evidenced by A changed |
| Golden CourseSpec | PASS |
| Golden build dry run | 12 reuse / 0 regenerate / 2 deterministic plan rebuild / 1 existing blocker / 0 AI calls |
| Two immediate Golden builds | PASS — 0 regenerated, 0 artifact rebuild, 0 AI calls on both |
| Golden PPTX | PASS — SHA-256 `F8D2B007CD2025BB5A37AB2E35CC07A16DCBC964975D239F7DBFD46C2D59A557`; 3 slides, 3 notes, editable, 13 native text objects |
| Golden MP4 | PASS — SHA-256 `A9F274CE769D49E4D70C3C974135722C4CC3B974243C5D8B9A83A6B567A0EF48`; 1280×720, 30 fps, 55.530667 s, H.264 + AAC |
| Production release | PASS (fail-closed) — release rejected with 13 blocking errors |

The system `doctor` correctly reported MinerU as `NOT AVAILABLE`, including a safe endpoint display, reason, action and `MINERU_API_URL` guidance. It also reported FFmpeg/FFprobe missing from this shell's PATH; this is one reason clean-machine one-pass readiness remains false.

## Required readiness questions

1. **Document Parsing 是否已经 Provider 化？** Yes. `DocumentParsingProvider` owns health, capabilities, support checks and parse behavior; workflow uses a small registry.
2. **MinerU 是否只是默认 Provider，而不是 Contract？** Yes. MinerU is a default HTTP implementation in `packages/providers`; intake, generation, CourseSpec and compiler do not import its response types.
3. **MinerU schema change 是否被 Adapter 隔离？** Yes. Raw response normalization is confined to `packages/providers/src/mineru`.
4. **MaterialIR 是否 provider-neutral？** Yes. Its v0.1 contract uses documents, units, blocks, normalized locations, assets, diagnostics and generic parse provenance.
5. **`content_list_v2` 是否只存在于 MinerU Adapter？** Yes in executable product code. The name also appears intentionally in adapter fixtures, tests and documentation; it does not occur in intake, generation, CourseSpec or compiler contracts.
6. **Legacy output 是否兼容？** Yes. Preferred and legacy fixtures normalize to MaterialIR; legacy emits a visible warning, parser output version and `legacy-fallback` method.
7. **Raw source 是否可以 deterministic discovery/hash？** Yes. Top-level supported files are sorted, typed and SHA-256 hashed deterministically.
8. **PDF/DOCX/PPTX/Image/MD 哪些经过真实验证？** All five were verified for real file discovery and the provider-replacement workflow. Markdown was parsed by the real built-in parser. PDF/DOCX/PPTX/JPEG MinerU parsing was not executed because MinerU was unavailable; their adapter behavior is verified with reviewed structured fixtures.
9. **MaterialIR 是否 deterministic？** Yes. Repeated normalization preserves canonical hash, unit/block IDs, locations and asset references.
10. **EvidenceRef 是否能定位到 source block？** Yes. It records material, unit, block, content hash and optional normalized bbox/anchor.
11. **Stale evidence 是否会 fail？** Yes. Missing material/unit/block and content-hash mismatch produce explicit validation issues; mismatch is reported as stale evidence.
12. **Knowledge Candidate evidence coverage 是多少？** 100% for factual candidates in the synthetic Golden raw-material evaluation.
13. **Conflict detection 是否通过？** Yes. The archived deck's fictional setting A conflicts with controlled SOP setting B. Code recommends the controlled source based on deterministic hierarchy but still requires a human selection.
14. **Grounding Gap 是否能转换为非技术用户可执行行动？** Yes. The review package offers machine-readable and plain-language actions: approved SOP/WI, manufacturer manual, current site photo and confirmed operation region.
15. **用户是否需要写 Prompt？** No. Manual Prompt Count = 0.
16. **用户是否需要编辑 JSON？** No. Manual JSON Edit Count = 0; JSON artifacts are system-generated.
17. **CourseSpecCandidate 是否仍无法绕过 Human Review？** Yes. Without a matching explicit decision the firewall returns no CourseSpec. Conflict selections and gap acknowledgements are validated; production cannot acknowledge away grounding gaps.
18. **相同 intake 第二次 MinerU calls 是否为 0？** The provider-neutral cache test proves the second identical intake invokes its parser 0 times and regenerates 0 MaterialIR. A real MinerU invocation count was not measured because the real smoke test was not executed.
19. **单 source change 是否只重解析对应 material？** Yes. The three-material test reparsed only A and preserved B/C MaterialIR hashes.
20. **Source change 是否能继续进入 Living Engine incremental pipeline？** Yes, with the required human boundary. Evidence dependencies isolate affected candidates; an explicit test review decision produces a valid CourseSpec that compiles, while existing Change-001 tests continue to prove targeted Living Engine regeneration.
21. **Existing v0.2.1 Golden 是否零退化？** Yes. All regressions pass and the PPTX/MP4 hashes exactly match baseline.
22. **Production Release Gate 是否仍 fail-closed？** Yes. The Golden release remains rejected until human release decisions and grounding are complete.
23. **Security 是否 PASS？** Yes. 167 scanned text files, 0 findings. Raw/cache artifacts remain gitignored and endpoint display is credential/query redacted.
24. **MinerU real smoke test 是否真实执行？** No — **NOT EXECUTED** because `MINERU_API_URL` was absent. No pass was fabricated.
25. **是否已经可以开始 clean-machine / non-technical HR pilot？** No. Author-review pilots with a configured parser may begin; non-technical clean-machine one-pass testing must wait for the outstanding setup and representative-user evidence.

## Acceptance matrix

```text
Document Parsing Provider Contract: PASS
MinerU Default Provider: PASS
MinerU HTTP Integration: NOT EXECUTED
MinerU Schema Isolation: PASS
MaterialIR: PASS
MaterialIR Determinism: PASS
Evidence Traceability: PASS
Evidence Integrity: PASS
Knowledge Candidate Firewall: PASS
Conflict Detection: PASS
Guided Grounding: PASS
CourseSpecCandidate Review Gate: PASS
Manual Prompt Count = 0: PASS
Manual JSON Edit Count = 0: PASS
Parser Cache Reuse: PASS
Source Update Incremental: PASS
Core v0.2.1 Regression: PASS
Production Release Gate: PASS
Architecture Gates: PASS
Security: PASS
```

## Supported and verified formats

| Format | Discovery/hash | Contract-level parse | Real default-provider parse |
|---|---:|---:|---:|
| Markdown / TXT | PASS | PASS — built-in deterministic parser | PASS (not MinerU) |
| PDF | PASS | PASS — replacement provider + MinerU adapter fixture | NOT EXECUTED |
| DOCX | PASS | PASS — replacement provider | NOT EXECUTED |
| PPTX | PASS | PASS — replacement provider | NOT EXECUTED |
| PNG / JPEG | PASS | PASS — replacement provider + MinerU adapter image block | NOT EXECUTED |

XLSX and web URLs are not claimed as v0.3 verified inputs.

## Third-party and privacy boundary

MinerU is accessed over its official HTTP seam and remains replaceable. The adapter requests ZIP output so it can prefer the grouped structured development output and visibly fall back to the legacy structured output. The upstream license and future online-service review reminder are recorded in `THIRD_PARTY_NOTICES.md`; no legal conclusion is asserted.

Raw enterprise inputs are considered confidential. The default endpoint is local; remote use requires explicit configuration. Review output exposes provider, local/remote processing and endpoint classification without storing credentials. Raw responses are retained below the gitignored `.livingcourse/providers/mineru` tree for debugging/provenance, not as source of truth.

## Final decision

```text
READY FOR RAW-MATERIAL AUTHOR REVIEW: YES
NON-TECHNICAL MANUFACTURING HR ONE-PASS: NOT READY
```
