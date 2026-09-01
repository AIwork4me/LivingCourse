# Grounding and release

Manufacturing training is allowed to be incomplete for PoC and Author Review, but incompleteness must be visible and cannot cross the production boundary.

## Grounding

Every slide records source references, source class, verification state, anchor, replacement requirement and release scope. An anchor connects a claim or highlighted device region to controlled evidence and a human confirmation when required.

| Risk | Minimum production evidence |
|---|---|
| `illustrative` | human visual review |
| `procedural_general` | grounded authoritative source plus human review |
| `device_specific` | real-device source, approved SOP/WI, verified anchor and production review |

Synthetic assets can support a disclosed PoC or Author Review. They cannot be promoted by a normalizer, provider or renderer.

## Production gate

`validateReleaseEligibility` hard-blocks production when any of these apply:

- synthetic or PoC-only grounding;
- unverified procedural grounding;
- missing real-device evidence or anchor for device-specific content;
- unresolved slide release blockers;
- missing production-scoped `approved_for_release` decision;
- security-scan findings.

The Golden Slide 3 is intentionally synthetic and contains a native disclosure. Its Author Review PPTX/MP4 can be built; `livingcourse release` returns `LC-RELEASE-001` and related grounding/review errors until real equipment, approved SOP and authorized anchors replace it.

Review decisions are data. The CLI writes them only after validating the lifecycle transition. Production approval re-runs all eligibility policy and cannot bypass a blocker.
