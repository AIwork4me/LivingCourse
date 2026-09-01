# Living Engine

LivingCourse updates a course through the smallest valid patch rather than regenerating a deck from scratch.

```text
Read fresh CourseSpec
→ verify expected old value
→ apply add/remove/replace operation
→ validate the result
→ traverse field-level dependency graph
→ emit BuildPlan
→ preview and verify
```

## ChangeSet

Operations use JSON Pointer paths and can include an expected old value. If the stored value has already changed, the update fails with `LC-CHANGE-001`; stale writes never silently overwrite newer knowledge.

Change-001 replaces `/slides/1/knowledge/items/2/text` from `护目镜` to `护目镜与防护面罩`. Its knowledge node reaches one visual requirement, narration, audio, timing, cues, captions and the two plans. Slide 1, Slide 3, shared renderers and vocabulary remain unchanged. The planner requests one visual and one narration regeneration and reports zero unnecessary regeneration.

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

A run ID is derived from CourseSpec content and compiler/profile versions. When a completed run and both outputs exist, subsequent builds reuse them without renderer or AI calls. During execution each completed node is persisted atomically. If video fails after PPT succeeds, the next run begins at video; the PPT is not recreated.

The workflow returns the BuildPlan, actual reuse/regeneration/rebuild lists, QA report, output paths and a review package containing only Approve, Reject and Comment actions.
