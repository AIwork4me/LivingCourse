# Security and privacy

Raw enterprise material is potentially confidential. LivingCourse v0.3.3 therefore treats document parsing and semantic generation as explicit processing boundaries.

## Defaults

- Self-hosted MinerU defaults to `http://127.0.0.1:8000`; Markdown/TXT parsing is in-process.
- MinerU Cloud is used only when `LIVINGCOURSE_DOCUMENT_PROVIDER=mineru-cloud` is explicit. The CLI warns before upload that processing is remote.
- Cloud credentials are read only from the `MINERU_API_TOKEN` process environment variable. There is no token CLI flag or workflow option.
- Every `MaterialIR` records provider, local/remote processing mode and endpoint classification. The course review package exposes the same facts.
- Endpoint display removes username, password, query and fragment components. Credentials and Authorization values are never written to provenance, cache metadata, reports, or logs.
- Signed upload URLs and `full_zip_url` are used in memory and discarded. They never become source-of-truth or long-lived provenance fields.
- Logs and structured failures do not print complete source content.
- Raw parser responses and MaterialIR caches are stored below `.livingcourse/`, which is gitignored.
- LivingCourse does not send original material or raw parser responses to telemetry.
- The OpenAI-compatible transport reads its credential only from `LIVINGCOURSE_SEMANTIC_API_KEY`; there is no credential constructor parameter or CLI flag.
- Semantic base URLs must be HTTP(S) and cannot include credentials, query strings or fragments. Root and `/v1` forms normalize to a single `/v1/chat/completions` endpoint.
- Semantic capabilities receive provider-neutral MaterialIR through the configured transport. Provider/model/prompt identity is auditable on the review candidate, while credentials, endpoint URLs, raw prompts and raw responses remain outside MaterialIR, CourseSpec, caches, candidates and reports.
- Remote semantic execution is disclosed before parsed source content is sent. Dry run reports the local/remote classification and performs zero semantic calls.
- Transport errors use `LC-SEMANTIC-TRANSPORT-*` messages and exclude upstream response bodies and credential values. Retries are finite and limited to timeout, transient network, 408/409/425/429 and 5xx failures.

## Raw artifact lifecycle

MinerU ZIP entries needed for debugging and provenance are preserved under `.livingcourse/providers/<provider-id>/<fingerprint>/`. Temporary transport URLs are not preserved. Raw artifacts are not the machine source of truth; normalized `MaterialIR` is. Delete the workspace `.livingcourse` directory according to the organization's retention policy when the review is complete.

Do not commit `.livingcourse`, provider credentials, signed URLs or customer documents. The repository security scan checks text files for common credential, signed-URL, private-key and private-record patterns.

## Remote processing review

Before configuring a remote endpoint, the operator must confirm organizational permission, data location, retention, access control and the provider's current terms. LivingCourse classifies loopback semantic endpoints as local and all other semantic endpoints as remote; that classification is not a legal or compliance determination.
