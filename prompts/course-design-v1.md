# Course Design v1

Return JSON only. Organize validated `KnowledgeCandidate` records into a `CoursePlanDraft` containing 1 to 20 slides.

Every slide may reference facts only through `candidateIds`. Use only `hero`, `step_process`, or `safety_focus`; repeated slide types are allowed. Never invent factual text, parameters, requirements, prohibitions, evidence, authority, grounding, approval, or release status.
