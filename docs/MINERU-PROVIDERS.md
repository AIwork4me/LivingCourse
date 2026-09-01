# MinerU document providers

LivingCourse exposes two distinct MinerU transports behind the unchanged `DocumentParsingProvider` contract. They share the adapter in `packages/providers/src/mineru/adapter.ts`, so downstream code sees only `MaterialIR`.

| Provider | ID | Selection | Processing | Transport |
| --- | --- | --- | --- | --- |
| Self-hosted | `mineru` | Default | Local for loopback; otherwise classified from the configured endpoint | `GET /health`, `POST /file_parse` |
| Cloud | `mineru-cloud` | Explicit `LIVINGCOURSE_DOCUMENT_PROVIDER=mineru-cloud` | Remote, `public_remote` | Precise API v4 signed local-file upload |

## Self-hosted

Set `MINERU_API_URL` to the self-hosted FastAPI endpoint. The default is `http://127.0.0.1:8000`. Existing `/health` and `/file_parse` behavior and the backward-compatible provider ID `mineru` are preserved.

## Cloud precise API

Set these environment variables only in the process environment:

```text
LIVINGCOURSE_DOCUMENT_PROVIDER=mineru-cloud
MINERU_API_TOKEN=<runtime credential>
MINERU_CLOUD_BASE_URL=https://mineru.net  # optional; this is the default
```

The implementation follows the [official MinerU API documentation](https://mineru.net/apiManage/docs): request one signed upload URL with `POST /api/v4/file-urls/batch`, PUT the source bytes without an added content-type header, poll `GET /api/v4/extract-results/batch/{batch_id}` with finite bounds, and download `full_zip_url` only after `done`. `model_version` is fixed to `vlm` inside the provider. The downloaded ZIP must contain `content_list_v2.json` or the legacy `content_list.json`; Markdown alone is rejected.

The provider's `health()` makes a non-destructive authenticated result lookup using an impossible probe ID. It does not call a fictional `/health`, submit a parse task, or claim availability from token presence alone.

## Privacy and cache behavior

Selecting Cloud causes the CLI and dry-run plan to display:

```text
This parser processes source files on a remote service.
```

The credential is read only from `MINERU_API_TOKEN`. It is never accepted as a CLI flag or workflow option. Authorization headers, signed upload URLs, and ZIP URLs are runtime-only. They do not enter MaterialIR, cache metadata, review packages, reports, or raw artifact names.

Cloud fingerprints include provider ID, `precise-api-v4`, `vlm`, transport implementation version, parse profile, MaterialIR normalizer version, and source SHA-256. They exclude credentials and temporary URLs. An identical second run resolves the cache before network health checks, producing zero Cloud calls, uploads, polls, and MaterialIR regenerations.

## Real smoke test

`pnpm test:mineru-cloud` uses only the public-safe synthetic `tests/fixtures/raw-manufacturing-course/sop.pdf`. When the environment variable is absent, the command prints `REAL MINERU CLOUD SMOKE TEST = NOT EXECUTED`. When present, it performs the real upload/poll/download/normalize path and prints only safe metrics.
