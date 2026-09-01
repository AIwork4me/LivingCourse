# One-pass readiness

## Current verdict: NOT READY

LivingCourse Core v0.2 is closer than the Golden workflow, but an arbitrary non-technical manufacturing HR user cannot yet provide raw enterprise materials on a clean machine and reliably receive a high-quality, maintainable, production-eligible course with only necessary review.

## What works now

- An approved CourseSpec validates and compiles deterministically.
- The frozen Golden course builds an editable PPTX and narrated Author Review MP4 in one command.
- Dry run reports cost and impact before provider calls.
- Ten approved Golden artifacts are reused; the identical second build performs zero AI calls and zero output rebuilds.
- Incremental Change-001 affects only the Slide 2 dependency subtree.
- QA, review package, resume state, secret scan and production release gate are machine-readable.

## Remaining blockers

- Raw SOP/PDF/DOCX/PPTX/image ingestion does not yet produce a reviewable candidate CourseSpec end to end.
- A non-technical user still needs help mapping source authority, grounding and anchors.
- Site PPE and real-device evidence require guided collection and authorized review.
- On the validation machine, `doctor` reports FFmpeg and FFprobe missing from `PATH`; Remotion can render with its bundled compositor, but clean-machine diagnostics are not one-pass.
- The Golden fixture is one course, not evidence of reliable arbitrary-course performance.

## Metric

`Non-technical One-Pass Success Rate` is the share of representative manufacturing courses where an HR user supplies materials and required human decisions, then obtains QA-passing Author Review outputs without developer intervention. Production success additionally requires all grounding and release gates.

Readiness can become `READY` only after a representative, predeclared evaluation set consistently meets the threshold, clean-machine doctor passes, and failures give actionable non-technical recovery steps. Technical unit/regression success alone is insufficient.
