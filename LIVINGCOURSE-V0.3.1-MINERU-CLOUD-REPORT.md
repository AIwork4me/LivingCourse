# LivingCourse v0.3.1 — MinerU Cloud Transport & Real Smoke Test Report

Validation status: **PASS with the real MinerU Cloud smoke test NOT EXECUTED**. The transport, mocked Cloud contract, security boundaries, cache behavior, self-hosted regression, and all existing v0.3/v0.2.1 regressions pass. The process environment contained no `MINERU_API_TOKEN`, so no real cloud upload was attempted and no real-cloud PASS is claimed.

Implementation source: `packages/providers/src/mineru/cloud-provider.ts`. The flow follows the [official MinerU API documentation](https://mineru.net/apiManage/docs) for local-file signed upload and batch result polling. The Agent lightweight API is not used.

Final local verification: typecheck PASS; lint PASS; 23 test files / 62 tests PASS; 1 self-hosted real-smoke test SKIPPED by its existing environment gate; architecture PASS (10 rules, 0 findings); security PASS (174 scanned files, 0 findings). The separate Cloud smoke command reported NOT EXECUTED because its credential was absent.

## Acceptance matrix

| Acceptance item | Result | Evidence |
| --- | --- | --- |
| MinerU Self-hosted Provider | PASS | `MineruHttpProvider` retains ID `mineru`, `GET /health`, and `POST /file_parse`; mocked ZIP regression passes. |
| MinerU Cloud Provider | PASS | `MineruCloudProvider` implements the unchanged `DocumentParsingProvider` with ID `mineru-cloud`. |
| Signed Local Upload | PASS | Mock verifies exact v4 apply body, Authorization only on API requests, raw-byte PUT, no added content-type, and 200/201 success. |
| Async Polling | PASS | `waiting-file`, `pending`, `running`, `converting`, `done`, and `failed` are bounded by timeout, attempt count, and transient retry count. |
| ZIP Result Download | PASS | `done` requires `full_zip_url`; ZIP is downloaded in memory and unpacked; missing URL and malformed/missing structured output fail loudly. |
| Existing MinerU Adapter Reuse | PASS | Both transports call `normalizeMineruV2` first and `normalizeMineruLegacy` as fallback. |
| MaterialIR Contract Unchanged | PASS | Contract SHA-256 remains `90F0188F81E516E98A85508737260FB65EDCF55D8A4CA7626D9C5338DDB2FBD1`. |
| Provider Replacement Core Delta = 0 LOC | PASS | No diff in core, compiler, generation, renderers, or the intake contract; selection changes workflow/provider configuration only. |
| Remote-processing Disclosure | PASS | Dry-run plan and CLI show `This parser processes source files on a remote service.`; provenance/review show MinerU Cloud and Remote. |
| Credential Isolation | PASS | Production provider reads only `MINERU_API_TOKEN` from process environment; no CLI/config token field exists. |
| Temporary URL Isolation | PASS | Mock security test proves credentials, Authorization values, upload URLs, and result URLs are absent from MaterialIR, cache metadata, review/log output. |
| Parser Cache Reuse | PASS | Identical second run: 0 Cloud calls, 0 uploads, 0 polls, 0 parser calls, 0 MaterialIR regenerations, identical MaterialIR hash. |
| Real MinerU Cloud Smoke | NOT EXECUTED | Token absent; `pnpm test:mineru-cloud` printed `REAL MINERU CLOUD SMOKE TEST = NOT EXECUTED`. |
| Core v0.2.1 Regression | PASS | Compiler, renderer, timing, patch, invalidation, Golden, and workflow regressions pass. |
| v0.3 Intake Regression | PASS | Existing intake, evidence, grounding, candidate-firewall, incremental, and manual-count tests pass. |
| Production Release Gate | PASS | Golden production release remains fail-closed in the regression suite. |
| Architecture Gates | PASS | 10 rules, 0 findings. |
| Security | PASS | Repository security scan reports 0 findings. |

## Required questions

1. **Cloud MinerU 是否实现为 DocumentParsingProvider？** Yes. `MineruCloudProvider` directly implements the existing interface and uses provider ID `mineru-cloud`.
2. **Self-hosted 是否继续可用？** Yes. The existing class name and provider ID remain backward compatible, and `/health` plus `/file_parse` have a new parse regression test.
3. **Local file 是否使用官方 signed upload flow？** Yes. The provider requests `/api/v4/file-urls/batch` with stable LivingCourse material ID and `model_version=vlm`, then PUTs source bytes to the returned URL without adding content-type.
4. **是否正确 polling？** Yes. Batch polling handles all documented states, bounded attempts, a wall-clock deadline, bounded transient retries, request abort timeouts, terminal failure, and unexpected response failures.
5. **是否下载并解析 full ZIP？** Yes. Completion requires a runtime-only ZIP URL; the provider downloads and unpacks it in memory.
6. **是否复用 existing MinerU Adapter？** Yes. Cloud and self-hosted share the existing preferred-v2 and legacy normalization functions. Markdown-only fallback is forbidden.
7. **MaterialIR 是否完全 unchanged？** Yes. Its source file was not edited and its before/after SHA-256 is identical.
8. **CourseSpec/Compiler 是否 0 LOC change？** Yes. Core, compiler, CourseSpec candidate/generation, PPT renderer, video renderer, and Living Engine have zero source changes.
9. **Cloud parsing 是否显式 remote？** Yes. Health, plan, MaterialIR provenance, and review output use `remote` and `public_remote`.
10. **Credential 是否只来自 env？** Yes. Runtime code reads only `process.env.MINERU_API_TOKEN`; no constructor token, URL query token, CLI flag, workflow option, fixture, or file-backed credential path exists.
11. **Token 是否从日志/report/cache 完全排除？** Yes. Errors are stage/status-only, the security boundary test inspects cache/material/log output, and the repository scanner finds no credential.
12. **temporary URLs 是否不进入长期 Contract？** Yes. Upload and result URLs are local variables only; raw artifact references contain ZIP entry names, not transport URLs.
13. **Cache 第二次是否 0 Cloud calls？** Yes. The cache fingerprint is resolved from the provider's stable Cloud transport identity before health/network activity.
14. **Real MinerU Cloud smoke 是否真实执行？** No — **NOT EXECUTED**, because the required environment variable was absent. No upload occurred.
15. **已知 fixture 内容是否被真实解析出来？** **NOT EXECUTED for the real service.** The mock contract extracts the known `pressure setting B` fixture text, while the real smoke script will require the complete known sentence before it can report PASS.
16. **Existing Golden 是否零退化？** Yes. Golden fixtures have zero Git diff; all compiler/renderer tests pass; the MP4 and four representative video-frame hashes match the v0.2.1 recorded baseline. No compiler or renderer source changed.
17. **Production Release 是否继续 fail-closed？** Yes. The unchanged release policy still rejects the Golden candidate without required human and grounding decisions.
18. **Security 是否 PASS？** Yes. The deliberate transport leakage tests and repository-wide security scan both pass with zero findings.

## Fingerprint and cache proof

The Cloud provider version is `precise-api-v4+vlm+transport-0.3.1`. Combined with the existing parsing fingerprint function, the final fingerprint includes source SHA-256, provider ID, transport/model/provider version, parse profile, and MaterialIR normalizer version. It cannot include the environment credential, signed upload URL, batch result URL, or downloaded ZIP URL because none is an input to the fingerprint.

## Contract proof

| Frozen file | Baseline and final SHA-256 |
| --- | --- |
| `packages/intake/src/types.ts` | `90F0188F81E516E98A85508737260FB65EDCF55D8A4CA7626D9C5338DDB2FBD1` |
| `packages/generation/src/capabilities.ts` | `C7542CE0293713FCE2213328664245EEDE9ED72EF521FF054B1F00B27FD953E8` |
| `packages/generation/src/candidate.ts` | `8CDEFF9E356282567CFB5F9CC517E34EEE8A767CE6D49E6E9FFF54F9E0DB0098` |
| `packages/core/src/types.ts` | `4C98F0E2577178FEFD01B95D0992DDFF23F2A6DAEA68ACA42C59C55763EB0351` |
| `packages/compiler/src/types.ts` | `0D3EEF32A731F8E418896127CC2E9DE4DBE6D667639DE98EF7F2397DF92BEF11` |

## Verification commands

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm test:mineru-cloud
pnpm validate:arch
pnpm validate:security
```

The real smoke command is intentionally separate from default CI and uses only `tests/fixtures/raw-manufacturing-course/sop.pdf`.
