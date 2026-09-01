# CourseSpec

`CourseSpec` is the only course source of truth. Renderer files, prompts, cached assets and build reports are derived data and cannot override it.

## Three layers

Each slide separates:

- `knowledge`: facts and stable, addressable knowledge items.
- `presentation`: teaching intent, visual requirements, layout and motion intent.
- `governance`: review state, gates, risks, blockers and release eligibility.

Narration and grounding are explicit sibling contracts because they connect facts to audio and evidence.

Presentation fields remain intent. `layout.kind` is sufficient for a normal slide; deterministic profiles resolve geometry and safe areas into `PresentationPlan`. `regions`, `safeAreas`, motion `atMs`, and motion `durationMs` are optional expert overrides rather than required production coordinates or timestamps. Narration cues may use an optional one-based `occurrence` when a phrase appears more than once.

## Material contract

A material records `id`, `type`, `ref`, SHA-256, title, version, effective date, authority and source class. Supported types are SOP, PDF, DOCX, PPTX, Markdown, image, equipment photo, web reference and synthetic source. Source classes are `controlled_internal`, `external_authoritative`, `reference`, `synthetic` and `unknown`.

No provider name, model ID, voice ID, Remotion property or PowerPoint implementation field is allowed in the serialized contract. Narration uses a stable `voiceProfile`; a provider adapter maps that profile to an internal voice ID outside CourseSpec.

## Validation and normalization

`validateCourseSpec` combines JSON Schema and business validation and returns every issue as `{code, path, message, severity}`. Dedicated validators cover slides, materials, review decisions and release eligibility.

Normalizers may fill deterministic defaults, canonicalize safe representations, sort stable collections and derive deterministic metadata. They may not invent facts, change safety values, improve grounding, or promote synthetic evidence. Normalization is idempotent.

## Versioning and migration

`COURSE_SPEC_VERSION` is independent of npm package versions and is `0.2.1`. Migration steps are pure, contiguous and deterministic. The `0.1.0 → 0.2.0 → 0.2.1` ladder is automatic, missing migration paths fail loudly, and migrating an already-current document is idempotent. The frozen Golden `0.2.0` fixture is validated through migration without being edited.

## Review and state

Review is machine-readable through `ReviewDecision`: artifact, gate, decision, reviewer, time, scope, comments and accepted risks. A candidate cannot jump directly to production approval. State transitions and release checks are code policy, not prompt instructions.

The complete Golden example is `examples/manufacturing-entry-safety/course-spec.json`; the cross-language schema is `packages/core/src/schema/course-spec.schema.json`.
