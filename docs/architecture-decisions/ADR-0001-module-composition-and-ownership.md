# ADR-0001: Module composition and shared-engine ownership

- Status: Accepted as the target architecture
- Date: 2026-11-19
- Scope: Repository-wide

## Context

The simulator contains many interacting domains and platform-specific variants. Duplicating engines per aircraft/weapon creates inconsistent behavior; a central class full of platform-name conditionals creates equally fragile coupling.

## Decision

Use shared simulation engines with independently versioned, data-driven content modules and platform-specific installation adapters.

1. Loadable modules declare stable identity, version, kind, capabilities, dependencies, configuration schemas and lifecycle in a manifest.
2. Shared engines own reusable algorithms and authoritative generic behavior.
3. Platform modules own exact variant definitions, installation geometry, wiring, controls, compatibility, cockpit mappings, source data and supported capability declarations.
4. Modules communicate through versioned contracts, typed commands/events, resource interfaces, observations and immutable snapshots.
5. Shared code never selects behavior by aircraft/faction/weapon/equipment display-name conditionals.
6. Unknown/unsupported capabilities remain unknown/unavailable; no silent fallback to a nearby variant.
7. Simulation clock owns deterministic update ordering. Rendering/audio consume snapshots and cannot mutate state.
8. Technical parameters carry units, applicability, provenance and uncertainty.
9. Campaign is an optional gameplay module composing world, factions, logistics, missions and persistence; it does not own physical simulation or become a global mode switch.

## Alternatives

- Monolithic game manager: rejected due to global coupling and broad regressions.
- Private engine per aircraft/weapon: rejected due to duplicated fixes and divergent behavior.
- Deep inheritance tree with optional fields: rejected due to fragile null/boolean capability representation.
- Name-based dispatch: rejected because adding variants would require editing shared engines.

## Consequences

Benefits: configuration-level equipment replacement, reusable shared physics/resource services, independently testable integration and data corrections without algorithm rewrites.

Costs: manifests/schemas/contracts require discipline; dependency diagnostics are essential; data changes also require validation/tests.

Affected areas: docs/module-system/, docs/integration-contracts/, docs/data-standards/, game/core/, game/modules/, physics/, sensors/ and game/graphics-engine/.

Migration: consolidate legacy placeholders only when a canonical owner is identified. Do not move working runtime files blindly. This ADR adds no runtime implementation.
