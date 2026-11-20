# Game core

**Current folders describe intended ownership; they are not proof that a complete runtime engine exists.**

Core is the platform-neutral simulation foundation. It remains independent of aircraft, weapon, campaign, DOM and rendering implementations.

## Canonical responsibilities

- Simulation clock, fixed-step accumulator, tick phases and multi-rate scheduler.
- Module manifest discovery, dependency resolution, lifecycle and capability registry.
- Entity identity/lifecycle and authoritative state ownership.
- Typed command queue, event dispatch and immutable snapshot publication.
- Resource providers/consumers, topology, allocation and dependency diagnostics.
- Global configuration/schema validation.
- Save/load, migrations and deterministic replay.
- Coordinate transforms, spatial indexing and world/entity queries.
- Structured logs, telemetry, profiling and fault explanations.
- Networking authority/replication boundaries as replaceable adapters.

The clock controls authoritative time. Modules declare update domains. Core validates commands, dispatches events deterministically and publishes tick-stamped snapshots. Rendering/UI run separately.

One subsystem owns each mutable state. Core coordinates but does not absorb domain algorithms: resource allocation is shared, while the electrical system models its bus and equipment models its response.

Core contracts may be consumed by physics, sensors, weapons, platforms, world and campaign. Core must not import aircraft/faction/weapon-specific implementations. See docs/ARCHITECTURE_OVERVIEW.md and docs/core-systems/README.md.

**Status:** Runtime implementation remains future work.
