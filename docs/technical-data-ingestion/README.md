# Technical-data ingestion and provenance workflow

This defines how research becomes usable simulation configuration without turning guesses into false facts.

## Workflow

1. Identify exact applicability: platform, product/variant, operator, block/revision, equipment/software and date.
2. Capture source: document title, publisher/author, revision/date, page/table/figure, URL and redistribution/license limits.
3. Extract one parameter at a time, preserving source units and contextual conditions.
4. Normalize to canonical SI units with a recorded conversion/derivation method.
5. Record evidence status: publicly sourced, measured, derived, estimated, synthetic, gameplay-tuned or unknown.
6. Record uncertainty: bounds/distribution/covariance and known biases; do not manufacture precision.
7. Validate applicability/plausibility and cross-check independent sources where available.
8. Review and mark source/data as reviewed, disputed or needing evidence.
9. Publish as versioned configuration, schema-validate and reference from the owning module manifest.
10. Regression-test affected validation scenarios and record output changes.

Keep source notes/reference indexes separate from machine-readable runtime data. Store reusable family data separately from exact variant and installation data. A platform installation chooses equipment; it does not rewrite the shared equipment model.

Unknown values remain null/unknown. Conflicting references get separate source records and applicability notes; do not average incompatible variants. Estimated values include method, assumptions and range. Gameplay tuning is never presented as measured technical truth.

A link or local personal reference is not permission to redistribute copyrighted manuals, photographs, drawings or models. Store metadata and legally distributable extracts only.

No technical dataset is ready until schema-valid, unit-consistent, variant-applicable, sourced, uncertainty-labelled and reviewed. Its validity envelope and known omissions must be visible to implementers.
