# Game Core

**Current directories are architectural placeholders; do not assume a complete engine exists.**

- `simulation/config/`: validated global and scenario settings.
- `simulation/simulationclock/`: simulation time, tick, pause/time scale and fixed-step accumulation.
- `simulation/simulationengine/`: lifecycle, deterministic ordering and update scheduling.
- `resources/`: providers/consumers, capacities, flows, allocation and dependency state.

Planned additions: entity identity/lifecycle, event bus and command queue, schema validation, save/load/migrations, diagnostics/replay, spatial indexing, collision interfaces and network authority boundaries. See [core systems architecture](../../docs/core-systems/README.md).
