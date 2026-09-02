# Semantic providers

LivingCourse v0.3.3 supports one configured semantic transport: a generic OpenAI-compatible Chat Completions endpoint. It implements the existing `StructuredGenerationTransport` and is used by the existing `ConfiguredLLMKnowledgeProvider` and `ConfiguredLLMCourseDesignProvider`. No vendor SDK is installed.

## Configuration

Set all four required variables in the process environment:

```bash
LIVINGCOURSE_SEMANTIC_PROVIDER=openai-compatible
LIVINGCOURSE_SEMANTIC_BASE_URL=https://model.example/v1
LIVINGCOURSE_SEMANTIC_MODEL=your-model
LIVINGCOURSE_SEMANTIC_API_KEY=...
```

`LIVINGCOURSE_SEMANTIC_TIMEOUT_MS` is optional and defaults to 30000. A missing provider selection means `NOT_CONFIGURED` and uses local literal deterministic fallback. Setting the provider to `literal` selects the same fallback explicitly. Selecting `openai-compatible` without every required value is an error; LivingCourse does not silently downgrade a broken explicit configuration.

The API key is read only from `process.env.LIVINGCOURSE_SEMANTIC_API_KEY`. It is never accepted as a constructor option, command-line flag, CourseSpec field or config-file value.

## Request contract

The base URL accepts either a root or an existing `/v1` suffix. It is normalized before posting to `{normalizedBase}/chat/completions`, without producing `/v1/v1`. Only HTTP(S) URLs without embedded credentials, query strings or fragments are accepted.

Each request contains:

- the configured model;
- a system message loaded from the authoritative versioned prompt file;
- a user message containing provider-neutral JSON;
- `temperature: 0`.

The Knowledge Understanding prompt is `prompts/knowledge-understanding-v1.md`; the Course Design prompt is `prompts/course-design-v1.md`. Their version and SHA-256 hash are recorded separately on the review candidate. Course Design receives only the minimal validated candidate view: ID, claim, category and confidence.

## Reliability and safe failure

The transport retries 408, 409, 425, 429, 5xx, timeout and transient network failures with finite exponential backoff and jitter. It does not retry 400, 401, 403, 404 or 422. Failures use stable `LC-SEMANTIC-TRANSPORT-*` codes and do not expose response bodies, Authorization headers or keys. Malformed JSON, missing choices and missing content fail closed. Code fences and leading reasoning are processed by the existing AI output firewall, after which schema and business validation still apply.

## Disclosure and privacy

`localhost`, `127.0.0.1` and `::1` endpoints are classified as local; all others are remote. `create --dry-run` shows provider, model, classification, changed/reused materials and predicted calls while making zero requests. Before a remote execution, the CLI prints:

```text
Semantic authoring will send parsed source content to a remote model endpoint.
```

The Author Review package records provider/model and local/remote processing, but not the endpoint URL. Credentials, raw prompts and raw responses are not stored in MaterialIR, semantic caches, CourseSpecCandidate, CourseSpec or reports.

## Cache behavior

Knowledge Understanding remains one call per changed material; LivingCourse never combines every enterprise document into one giant knowledge prompt. Its cache key includes the MaterialIR hash plus provider, model, prompt version/hash and profile identity. Course Design receives the minimal validated candidate view and is cached by its canonical candidate-set hash plus its own capability identity and planning context. API keys, request IDs, response IDs and timestamps never enter either fingerprint. An identical second run is therefore zero-call, while a changed material is isolated and an irrelevant-only update can reuse the Course Design result when the candidate set is unchanged.

## Doctor and real smoke

`livingcourse doctor` reports `NOT CONFIGURED` as a warning unless generation is required. For a complete configuration it reports `CONFIGURED` and `REACHABILITY NOT VERIFIED`; the check validates configuration but does not spend a content-generation token.

`pnpm test:semantic-real` is opt-in and is not part of default CI. Without all four variables it prints exactly `REAL SEMANTIC SMOKE TEST = NOT EXECUTED`. When configured, it runs the public-safe five-format intake fixture through Knowledge Understanding, Course Design and Author Review; tests exact second-run reuse plus relevant-only and irrelevant-only updates; writes `REAL-SEMANTIC-COURSE-REVIEW.md`; and stops before image generation, TTS, rendering and release. A human reviewer must complete the checklist before the human semantic review can be marked PASS.
