# Entity identity and lifecycle

**Owner:** game/core/entities. **Status:** design only; no complete entity store/lifecycle runtime exists.

## Responsibility
Assign stable identities and manage construction, activation, retirement and destruction. Entity identity is not display name, renderer object, array index or campaign label.

## Entity versus component
An entity is an identity/composition record, not a global mutable bag. Rigid-body state belongs to physics; fuel to fuel system; sensor tracks to sensor; faction/objectives to campaign. Components expose typed interfaces and own their mutable state.

## Lifecycle
Define constructing, active/ready, degraded, retiring, destroyed/disposed states with explicit transitions. Distinguish destroyed, despawned, memory-unloaded, captured, surrendered and campaign-removed; they are not synonyms. Retirement coordinates scheduler entries, sensor references, resource allocations, weapon links and presentation attachments.

## Identity and persistence
Stable IDs derive from scenario/content identity or deterministic creation input. Preserve through save/load and replay. A wreck/campaign record may persist after active simulation components are retired. Streaming out a render chunk must not destroy the entity.

## Tests
Duplicate ID, failed construction cleanup, invalid composition, save/load identity, idempotent destruction, dependent sensor/weapon cleanup, streaming unload without deletion and ownership isolation.
