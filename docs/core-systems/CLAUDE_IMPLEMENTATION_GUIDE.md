# Claude Implementation Guide — Core Systems

Audit the current HTML/JavaScript skeleton before implementing these boundaries. Do not assume placeholder folders contain a working engine.

## Service contracts
- **Simulation clock:** simulation time, fixed-step accumulator, pause/time scale, tick index and bounded catch-up. Rendering interpolates; frame delta is not authoritative physics time.
- **Simulation engine:** ordered registration/lifecycle (initialize, start, fixed update, presentation update, pause, resume, shutdown), declared dependencies and update domains. Detect duplicate registration and dependency cycles.
- **Entity lifecycle:** stable IDs, spawn/despawn, team/ownership metadata and lifecycle state. Identity is not a mesh or DOM node; pooling cannot corrupt saved references.
- **Commands/events:** commands request changes; owning systems validate/apply at deterministic boundaries. Events report facts after changes. Include timestamp, source, target, type and schema version. Avoid loops and unbounded queues.
- **Resources:** electrical power, hydraulic pressure, fuel, cooling and ammunition have producers, consumers, capacity, flow/limits and failure state. Expose why a consumer is unavailable.
- **Configuration:** immutable definitions separate from mutable runtime state. Validate units, ranges, references, required fields and version.
- **Persistence:** save stable campaign/simulation state, schema version, seed, campaign time and stable IDs. Validate imports and provide migrations; never serialize render caches or arbitrary object graphs.
- **Diagnostics:** structured logs, event traces, subsystem health, physics/frame timing, memory and entity counts. Keep telemetry optional and bounded.
- **Spatial services:** reusable broadphase, terrain/obstacle access and coordinate transforms. Sensors/AI must not scan every entity every frame.
- **Networking boundary:** isolate transport from game rules; define authority, replication and reconciliation. Static Pages alone cannot host authoritative shared state.

## Data flow
Input/AI command → validation → owning subsystem state change → domain event → dependent systems react → snapshot/telemetry → rendering/UI. UI and rendering are consumers, never simulation truth.

## Tests
Clock determinism, update order, pause/resume, catch-up bounds, event ordering, duplicate IDs, entity lifecycle, resource starvation, dependency failures, save/load round trips, schema migration, malformed imports, seeded replay and load performance.
