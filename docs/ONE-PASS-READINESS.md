# One-pass readiness

## Current verdicts

- Traceable raw-material intake: **READY** for the verified PDF, DOCX, PPTX, PNG/JPEG and Markdown/TXT scope.
- Semantic architecture: **READY** for the v0.3.3 candidate-only capability boundary.
- Default CLI semantic configuration: **READY** for the single OpenAI-compatible provider and explicit literal fallback.
- Real semantic end-to-end validation: **NOT VALIDATED** in the recorded v0.3.3 environment because the required real endpoint/model/key were absent.
- Non-technical manufacturing HR one-pass: **NOT READY**.

## What works now

- An approved CourseSpec validates and compiles deterministically.
- The frozen Golden course builds an editable PPTX and narrated Author Review MP4 in one command.
- Dry run reports cost and impact before provider calls.
- Ten approved Golden artifacts are reused; the identical second build performs zero AI calls and zero output rebuilds.
- Incremental Change-001 affects only the Slide 2 dependency subtree.
- QA, review package, resume state, secret scan and production release gate are machine-readable.
- Raw supported materials now produce a traceable `CourseSpecCandidate` and readable review package end to end.
- Knowledge Understanding and Course Design capabilities run in the main create path; deterministic evidence resolution, numeric/negation fidelity, conflict, authority and grounding checks run afterward.
- Material-level semantic cache reuse and candidate-set Course Design cache reuse are verified, including zero semantic AI calls on an identical second run.
- The five-format public-safe semantic fixture produces six candidate-linked slides while filtering irrelevant content and merging exact duplicates.
- `livingcourse create` automatically resolves the OpenAI-compatible semantic provider from environment variables; no embedding application is required.
- Dry run reports configuration, provider, model, local/remote processing, reuse and predicted calls while making zero model requests.
- Transport retry, safe error, base URL, response-shape, cache and secret-persistence behavior is covered by the default offline suite.

## Remaining blockers

- A real semantic endpoint has not yet been run in the recorded v0.3.3 environment, so real-model output quality and provider compatibility are not claimed as validated.
- A non-technical user still needs a guided interface for authority choices, conflicts, source corrections and grounding uploads; the Markdown review package exposes the decisions but is not yet a complete HR workflow.
- Site PPE and real-device evidence require guided collection and authorized review.
- Clean-machine installation and diagnostics remain unvalidated as a one-pass experience.
- The Golden and semantic fixtures are regression evidence, not evidence of reliable arbitrary-course performance or a completed HR pilot.

## Metric

`Non-technical One-Pass Success Rate` is the share of representative manufacturing courses where an HR user supplies materials and required human decisions, then obtains QA-passing Author Review outputs without developer intervention. Production success additionally requires all grounding and release gates.

Non-technical one-pass readiness can become `READY` only after a representative, predeclared evaluation set consistently meets the threshold, clean-machine validation passes, and real HR users complete authority, conflict, grounding and review decisions without developer intervention. Technical unit/regression success alone is insufficient.
