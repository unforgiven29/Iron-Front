# README.md

All content modules are independently identifiable, versioned and replaceable. Shared simulation engines live outside platform/content folders. Module discovery uses manifests and registries, not hardcoded lists.

## Claude implementation rules
- Treat this as a replaceable module boundary, not a second copy of a shared engine.
- Use versioned manifests, schema-validated configuration, explicit dependencies and lifecycle contracts.
- Separate immutable definitions, mutable runtime state, algorithms, diagnostics and presentation.
- Prefer data-driven variants, capability interfaces, dependency injection and registries over hardcoded platform/faction/name conditionals.
- Exchange typed commands, events, resource allocations and immutable snapshots; declare units, frames, timestamps and uncertainty.
- Mark unknown or estimated technical values with provenance. Never invent authoritative specifications.
- Include normal, degraded, failed and boundary validation cases when implementation begins.

**Status:** Architecture/documentation only. This README does not claim that runtime code or validated data exists.
