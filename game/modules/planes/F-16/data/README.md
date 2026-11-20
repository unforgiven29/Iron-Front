# F-16C Block 50 variant data

**Owner:** this directory owns machine-readable F-16C Block 50 variant/equipment parameter records. It does not own shared algorithms or runtime state. **Status:** selected baseline and research indexes exist; this is not yet a complete validated parameter database.

## Data classes
Variant metadata and exact applicability; geometry/datum; structural reference dimensions; mass/CG/inertia and mass contributions; aero tables and validity envelopes; engine fit; system topology/configuration; equipment and software fit; stores and attachment transforms. Separate exact Block 50 from Block 52, export, modernization and software baselines.

## Parameter record rules
Use common technical-parameter schema. Record stable parameter ID/name, numeric value or explicit unknown, SI unit, platform/block/operator/equipment/software/date applicability, source document/revision/page/table/figure, source units, conversion/derivation, confidence/uncertainty/range and review status. Sourced/derived/estimated/synthetic/gameplay-tuned/unknown remain distinct.

## Prohibited shortcuts
Do not derive detailed aero/engine/radar maps from one headline performance number. Do not silently inherit data from another block. Do not use a visual model as authoritative dimensions or mass. Never invent precise classified/undocumented values.

## Review and validation
Cross-check independent sources where possible, identify conflicts, attach exact conditions and define operating envelope. Validate unit/range/cross-field consistency and regression cases before data is consumed by runtime.
