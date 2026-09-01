# Why deterministic

Training content combines uncertain interpretation with high-consequence production. A language model is useful for extracting a candidate structure from messy materials, but it is a poor place to hide layout rules, release policy, hashes or incremental dependency logic.

LivingCourse draws the boundary after an approved CourseSpec:

```text
probabilistic understanding → reviewed contract → deterministic production
```

This makes three product promises testable:

1. The same approved specification produces the same plans.
2. A source change has a traceable, minimal impact surface.
3. Safety and release decisions fail closed with stable reasons.

AI structured output passes through extract, syntax repair, parse, normalize, schema validation and business validation. Repair may fix quotation marks or a trailing comma; it may never rewrite an SOP value or invent grounding. Provider retries are finite and limited to retryable transport/status failures.

Binary MP4 bytes may vary across operating systems and codecs, so reproducibility is judged at the correct layer: canonical plan equality, structural media properties, selected visual frames, content hashes and approved quality checks.
