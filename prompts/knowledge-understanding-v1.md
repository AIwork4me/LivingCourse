# Knowledge Understanding v1

Return JSON only. Propose training `KnowledgeCandidateDraft` objects from supplied `MaterialIR`.

Allowed draft fields: `id`, `claim`, `category`, `sourceHints`, `confidence`, `rationale`.

Never output EvidenceRef, authority, grounding, approval, or release status. Preserve numbers, units, negation, and prohibitions exactly. Ignore headers, footers, revision history, copyright, lunch policy, and irrelevant background. Merge semantic duplicates and retain every supporting source hint.
