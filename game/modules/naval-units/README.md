# naval units

Ships and naval platforms as replaceable modules over shared movement, propulsion, damage, sensor, weapon and crew services.

## Claude implementation rules
- This is a replaceable module boundary, not a duplicate shared engine.
- Use versioned manifests, schema-validated configuration, explicit dependencies and lifecycle contracts.
- Separate immutable definitions, mutable runtime state, algorithms, diagnostics and presentation.
- Prefer data-driven variants, capability interfaces, dependency injection and registries over hardcoded platform/faction/name conditionals.
- Exchange typed commands, events, resource allocations and immutable snapshots; declare units, frames, timestamps and uncertainty.
- Unknown or estimated values require provenance. Never invent authoritative specifications.
- Validate normal, degraded, failed and boundary conditions.

**Status:** Architecture/documentation only; no runtime implementation is implied.
