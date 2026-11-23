# Entity identity and lifecycle

**Owner:** game/core/entities. **Status:** identity and lifecycle registry implemented in `game/src/core/entities/EntityRegistry.ts` (tests: `game/tests/unit/EntityRegistry.test.ts`). Not yet implemented: component composition records, save/load of registry state and campaign records that outlive retirement.

## Implemented contract
- `deriveEntityId(scenarioId, ...spawnPath)` builds ids like `scenario-a/flight-1/lead`. The registry rejects ids that aren't in this form. An id is never reused, even after retirement.
- States are `constructing`, then `active`, which can switch to and from `degraded` (a stated cause is required), then `retiring`, then `retired`. Any other transition throws. Every transition returns a tick-stamped record.
- Retirement reasons are distinct: `destroyed`, `despawned`, `captured`, `surrendered`, `campaign-removed`.
- Owners attach keyed retirement hooks (scheduler entries, sensor refs, resources), which run in key order. A hook that throws is reported as a `HookFault`, and retirement still completes. Retiring an already-retired entity is a no-op. Retiring from `constructing` cleans up a failed construction.
- Streaming residency (`resident`/`unloaded`) is separate from lifecycle. Unloading never retires an entity or runs its hooks.

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
