# Security and privacy

Raw enterprise material is potentially confidential. LivingCourse v0.3.1 therefore treats document parsing as an explicit processing boundary.

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

## Raw artifact lifecycle

MinerU ZIP entries needed for debugging and provenance are preserved under `.livingcourse/providers/<provider-id>/<fingerprint>/`. Temporary transport URLs are not preserved. Raw artifacts are not the machine source of truth; normalized `MaterialIR` is. Delete the workspace `.livingcourse` directory according to the organization's retention policy when the review is complete.

Do not commit `.livingcourse`, provider credentials, signed URLs or customer documents. The repository security scan checks text files for common credential, signed-URL, private-key and private-record patterns.

## Remote processing review

Before configuring a remote endpoint, the operator must confirm organizational permission, data location, retention, access control and the provider's current terms. LivingCourse only classifies an endpoint as local, private remote or public remote; that classification is not a legal or compliance determination.
