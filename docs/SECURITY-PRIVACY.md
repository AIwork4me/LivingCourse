# Security and privacy

Raw enterprise material is potentially confidential. LivingCourse v0.3 therefore treats document parsing as an explicit processing boundary.

## Defaults

- MinerU defaults to `http://127.0.0.1:8000`; Markdown/TXT parsing is in-process.
- A private or public remote parser is used only when the user explicitly sets `MINERU_API_URL` or workflow configuration.
- Every `MaterialIR` records provider, local/remote processing mode and endpoint classification. The course review package exposes the same facts.
- Endpoint display removes username, password, query and fragment components. Credentials are never written to provenance.
- Logs and structured failures do not print complete source content.
- Raw parser responses and MaterialIR caches are stored below `.livingcourse/`, which is gitignored.
- LivingCourse does not send original material or raw parser responses to telemetry.

## Raw artifact lifecycle

MinerU ZIP entries needed for debugging and provenance are preserved under `.livingcourse/providers/mineru/<fingerprint>/`. They are not the machine source of truth; normalized `MaterialIR` is. Delete the workspace `.livingcourse` directory according to the organization's retention policy when the review is complete.

Do not commit `.livingcourse`, provider credentials, signed URLs or customer documents. The repository security scan checks text files for common credential, signed-URL, private-key and private-record patterns.

## Remote processing review

Before configuring a remote endpoint, the operator must confirm organizational permission, data location, retention, access control and the provider's current terms. LivingCourse only classifies an endpoint as local, private remote or public remote; that classification is not a legal or compliance determination.
