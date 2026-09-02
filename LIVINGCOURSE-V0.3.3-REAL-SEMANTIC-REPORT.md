# LivingCourse v0.3.3 — Default Semantic Provider & Real Semantic E2E Report

Validation date: 2026-09-02
Baseline commit: `9c8b4667f6f9fcbcc506dc6ea93d4417f056387d`

## Executive decision

v0.3.3 implements the single OpenAI-compatible structured-generation transport and wires it into the ordinary `livingcourse create` command without changing CourseSpec, MaterialIR, compiler IR, slide types, renderers or release policy. The default CLI semantic path is ready for a configured endpoint; no provider selection still produces an explicit, zero-call literal deterministic fallback.

The recorded environment did not contain any of the four semantic variables, so `pnpm test:semantic-real` printed `REAL SEMANTIC SMOKE TEST = NOT EXECUTED`. No real external model was called and no `REAL-SEMANTIC-COURSE-REVIEW.md` was fabricated. Real semantic E2E and human course quality are therefore **NOT VALIDATED**, even though the full configured path is covered offline through an actual local HTTP mock transport.

GitHub Actions was genuinely triggered for the baseline main commit as run `33568890562`, but failed during Node setup because the workflow selected Node 20 while pnpm 11.19.0 needs Node 22.13 or newer. v0.3.3 changed CI to Node 24. After commit `ea1d1cceba2ef859869c0b1d854b7844a1064f72` was pushed, run `33573587739` completed successfully in 2m3s: frozen install, typecheck, lint, the full test suite, architecture validation and security validation all passed. GitHub CI is therefore **PASS**.

## Implemented boundary

```text
CLI environment resolver
  → one OpenAICompatibleStructuredGenerationTransport
      → ConfiguredLLMKnowledgeProvider
      → ConfiguredLLMCourseDesignProvider
  → existing semantic caches
  → deterministic EvidenceResolver / fidelity / conflict / grounding
  → deterministic CourseSpecCandidate
  → Author Review package
```

The API key is read inside the transport only from `process.env.LIVINGCOURSE_SEMANTIC_API_KEY`. Course Design still receives only candidate ID, claim, category and confidence. Knowledge Understanding is still called once per changed material. The authoritative prompt bodies now exist only in the two versioned Markdown files; the TypeScript providers receive their loaded text and record distinct hashes.

## Required 28 answers

1. **Is the OpenAI-compatible transport really implemented?** Yes. It posts standard system/user Chat Completions requests, extracts `choices[0].message.content`, uses no SDK and has offline HTTP behavioral coverage.
2. **Can CLI enable semantic AI without code injection?** Yes. `livingcourse create` calls `resolveSemanticCapabilitiesFromEnv()` automatically.
3. **Does deterministic fallback still work when unconfigured?** Yes. It reports `NOT_CONFIGURED`, `literal_deterministic`, zero predicted semantic calls and a quality-limitation note.
4. **Does explicit incomplete configuration fail loudly?** Yes. `LC-SEMANTIC-CONFIG-002` lists the missing environment variable names and does not downgrade to fallback.
5. **Does the API key come only from the environment?** Yes. The transport has no key option or CLI flag and reads only `process.env.LIVINGCOURSE_SEMANTIC_API_KEY`.
6. **Is remote semantic processing disclosed?** Yes. Dry run and review identify processing mode; execution prints the required warning before `executeCreate()` can send MaterialIR.
7. **Did Knowledge Understanding call a real model?** **NOT EXECUTED / NOT VALIDATED** in this environment. The real HTTP provider path is implemented and tested against a local protocol mock, but no external model credential was present.
8. **Did Course Design call a real model?** **NOT EXECUTED / NOT VALIDATED** for the same reason. Its configured transport path is covered offline.
9. **Can AI still output only candidates?** Yes. Existing schema/business firewalls remain; extra EvidenceRef, authority, grounding, approval and release fields are rejected.
10. **Are EvidenceRefs still bound by code?** Yes. The deterministic resolver alone resolves source hints to EvidenceRefs.
11. **Does numeric fidelity remain fail-closed?** Yes. Existing numeric mutation regressions pass; no evidence gate was relaxed.
12. **Does negation fidelity remain fail-closed?** Yes. Existing English/Chinese negation regressions pass; no policy was relaxed.
13. **Are unsupported real-model factual claims zero?** **NOT VALIDATED** for a real model. Offline configured-path and existing semantic regressions produce zero.
14. **Is real-model evidence coverage 100%?** **NOT VALIDATED** for a real model. Offline configured-path and fixture regressions remain at 100%.
15. **Is the real course plan greater than three slides?** **NOT EXECUTED**. The real smoke enforces greater than three and at most six for this fixture; the deterministic semantic regression still produces six.
16. **Are only existing slide types used?** Yes by schema and business validation; the real smoke also checks `hero`, `step_process` and `safety_focus` only.
17. **Is real Manual Prompt Count zero?** **NOT EXECUTED**. The main workflow remains zero and the real smoke checks zero.
18. **Is real Manual JSON Edit Count zero?** **NOT EXECUTED**. The main workflow remains zero and the real smoke checks zero.
19. **Did an identical second real run use zero AI calls?** **NOT EXECUTED**. Offline configured-path regression proves LivingCourse cache reuse at 0/0/0; the real smoke contains the same hard gate.
20. **Did a single-material real change re-understand only that material?** **NOT EXECUTED**. Existing regressions pass and the real smoke checks one changed plus four reused materials.
21. **Did an irrelevant-only real change avoid Course Design?** **NOT EXECUTED**. Existing regression passes; the real smoke checks one knowledge call, zero course-design calls and unchanged semantic structure.
22. **Is CourseSpec unchanged?** Yes. Types hash `4C98F0E2577178FEFD01B95D0992DDFF23F2A6DAEA68ACA42C59C55763EB0351`; schema hash `F6D5E5E2C0141F7863FEF9A44B197AF107FBA3D5D4C4124E0853209ED73C3C54`.
23. **Does compiler have zero semantic-provider LOC dependency?** Yes. A new architecture rule scans core, compiler and renderers for semantic transport/config/protocol vocabulary; all 16 rules pass.
24. **Are Golden PPT/MP4 unchanged?** Yes. PPTX `1E9271F5ECBA66FD68B0A4B887CAFE395D7619CE303ED7FC5BB5AEC0B107D1F4`; MP4 `8CF22AA0DBDBC9EE46E424D941BC17E2C6F16D9DEE28A2861F59CA6B10261B57`.
25. **Is Production Release still fail-closed?** Yes. No release policy was changed and the regression suite passes.
26. **Is GitHub CI actually passing?** Yes. The baseline failure was traced to Node 20/pnpm 11 incompatibility; the Node 24 correction was pushed and GitHub Actions run `33573587739` passed every workflow step.
27. **What is real MinerU Cloud smoke status?** `NOT EXECUTED`; `LIVINGCOURSE_MINERU_TOKEN` was absent.
28. **Can the project enter clean-machine validation?** The codebase is ready to begin that next phase after the v0.3.3 changes are committed and CI plus an approved real semantic endpoint are validated. Clean-machine readiness itself is not claimed.

## Transport and security evidence

Default CI tests cover 200, 400, 401, 403, 404, 422, 429, 500, timeout, network reset, malformed JSON, missing choices, missing content, fenced JSON and reasoning before JSON. Root, `/v1`, nested path, loopback and unsafe URL handling are covered. Retries are finite exponential backoff with jitter through the existing retry helper.

The configured-path E2E test runs Markdown intake, the real resolver, both configured providers, a local HTTP endpoint, evidence resolution, candidate assembly and review output. Its identical second run makes zero HTTP requests. Deliberate API key, Authorization, endpoint, prompt text, response envelope, request ID and raw provider metadata markers are absent from MaterialIR-derived candidate output, semantic cache and review package. The repository security scan has zero findings.

## Real smoke status

| Smoke | Status | Reason |
| --- | --- | --- |
| `pnpm test:semantic-real` | NOT EXECUTED | semantic provider/base URL/model/API key all absent |
| `pnpm test:mineru-cloud` | NOT EXECUTED | MinerU token absent |
| Human Semantic Course Review | NOT EXECUTED | no real semantic candidate exists to review |

The real semantic script uses only the existing public-safe PDF/PPTX/DOCX/JPG/Markdown fixture, stops at Author Review, validates quality/cache/incremental gates and writes `REAL-SEMANTIC-COURSE-REVIEW.md` only when the real run is actually executed. It does not call TTS, image generation, rendering or release.

## Regression evidence

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS — 39 files / 110 tests; 1 file / 1 test skipped |
| `pnpm validate:arch` | PASS — 16 rules, 0 findings |
| `pnpm validate:security` | PASS — 210 files, 0 findings |
| Default configured-path tests | PASS — 5 files / 25 tests in the focused run before final aggregation |
| Real semantic smoke | NOT EXECUTED |
| Real MinerU smoke | NOT EXECUTED |

Frozen hashes match `V0.3.3-BASELINE.md` exactly, including MaterialIR `90F0188F81E516E98A85508737260FB65EDCF55D8A4CA7626D9C5338DDB2FBD1`.

## Acceptance matrix

```text
OpenAI-Compatible Transport: PASS
CLI Semantic Provider Wiring: PASS
Semantic Config Validation: PASS
Deterministic Fallback: PASS
Remote Semantic Disclosure: PASS
Credential Isolation: PASS
Knowledge Real Provider Path: PASS (protocol path; external model NOT EXECUTED)
Course Design Real Provider Path: PASS (protocol path; external model NOT EXECUTED)
Candidate-only AI Boundary: PASS
Evidence Resolver: PASS
Evidence Coverage: PASS in offline/regression evidence; real model NOT VALIDATED
Numeric Fidelity: PASS
Negation Fidelity: PASS
Unsupported Factual Claims = 0: PASS in offline/regression evidence; real model NOT VALIDATED
Real Semantic Course Quality: NOT EXECUTED
Arbitrary Slide Count: PASS
Existing Slide Vocabulary Only: PASS
Manual Prompt Count = 0: PASS in workflow; real smoke NOT EXECUTED
Manual JSON Edit Count = 0: PASS in workflow; real smoke NOT EXECUTED
Second Real Semantic Run AI Calls = 0: NOT EXECUTED
Incremental Semantic Recompute: PASS offline; real smoke NOT EXECUTED
Irrelevant-only CourseDesign Reuse: PASS offline; real smoke NOT EXECUTED
Semantic Security: PASS
GitHub CI: PASS (run 33573587739)
Core v0.2.1 Regression: PASS
v0.3 Intake Regression: PASS
v0.3.1 MinerU Regression: PASS
v0.3.2 Semantic Regression: PASS
Golden PPT Regression: PASS
Golden MP4 Regression: PASS
Production Release Gate: PASS
Architecture Gates: PASS
Security Scan: PASS
```

## Readiness decision

```text
TRACEABLE RAW-MATERIAL INTAKE:
READY

SEMANTIC AUTHORING ARCHITECTURE:
READY

DEFAULT CLI SEMANTIC AUTHORING:
READY

REAL SEMANTIC E2E:
NOT VALIDATED

NON-TECHNICAL MANUFACTURING HR ONE-PASS:
NOT READY
```
