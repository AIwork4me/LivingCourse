# Living Engine

LivingCourse updates a course through the smallest valid patch rather than regenerating a deck from scratch.

```text
Read fresh CourseSpec
→ resolve a Semantic Locator
→ produce the smallest current JSON Pointer
→ verify expected old value
→ apply add/remove/replace operation
→ validate the result
→ traverse field-level dependency graph
→ emit BuildPlan
→ preview and verify
```

## ChangeSet

Operations use JSON Pointer paths and can include an expected old value. If the stored value has already changed, the update fails with `LC-CHANGE-001`; stale writes never silently overwrite newer knowledge.

JSON Pointer remains the deterministic patch mechanism. The recommended authoring path is a Semantic Locator such as `{ slideId, section: "knowledge", itemId, field: "text" }`:

```text
Semantic Locator
↓
Fresh Resolution
↓
Smallest JSON Pointer Patch
↓
Impact Analysis
```

The resolver reads the fresh serialized CourseSpec and resolves the current slide/item indices immediately before creating the ChangeSet. Reordering slides changes the current JSON Pointer but not the stable dependency identity, which is derived from `slide.id` and `item.id`. Missing or ambiguous stable IDs fail explicitly.

Change-001 still resolves to `/slides/1/knowledge/items/2/text` for the Golden serialization and replaces `护目镜` with `护目镜与防护面罩`. Its knowledge node reaches one visual requirement, narration, audio, timing, cues, captions and the two plans. Slide 1, Slide 3, shared renderers and vocabulary remain unchanged. The planner requests one visual and one narration regeneration and reports zero unnecessary regeneration.

## Local content-addressed registry

Runtime state lives under `.livingcourse/`:

```text
.livingcourse/
├── registry.json
├── cache/
└── runs/
```

Every artifact records its content hash, source hash, generation fingerprint, local path, provider/model provenance, review status and dependencies. A fingerprint covers source hashes, structured input, prompt-template version, profile version, provider and model. A matching approved artifact must be reused.

## Idempotency and resume

A run ID is derived from CourseSpec content and injected content fingerprints. When a completed run and both outputs exist, subsequent builds reuse them without renderer or AI calls. Matching PPTX and MP4 outputs are also registered in the content-addressed artifact registry, so a changed fingerprint rebuilds only the owned deterministic output. During execution each completed node is persisted atomically. If video fails after PPT succeeds, the next run begins at video; the PPT is not recreated.

The workflow returns the BuildPlan, actual reuse/regeneration/rebuild lists, QA report, output paths and a review package containing only Approve, Reject and Comment actions.
