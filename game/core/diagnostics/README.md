# Simulation diagnostics and observability

**Owner:** game/core/diagnostics. **Status:** bounded structured fault log implemented in `game/src/core/diagnostics/DiagnosticsLog.ts` (tests: `game/tests/unit/DiagnosticsLog.test.ts`). Not yet implemented: per-subsystem performance metrics, command/event trace stitching across the bus, and a developer UI.

## Implemented contract
- A record has a stable `UPPER_SNAKE_CASE` code, severity, owner module, tick and message, and optionally entity, capability and correlation IDs. If a cause or recovery status isn't stated, it is recorded as `"unknown"`, never guessed. Records are frozen.
- The log is a bounded ring buffer. Sequence numbers keep running after eviction, and `evicted` counts dropped records, so gaps are visible.
- It can be queried by code, entity, correlation ID, minimum severity and tick.
- It is not connected to the message bus, so gameplay, sensors and AI cannot subscribe to it.

Diagnostics explain simulation behavior; they do not become a second truth source or gameplay API.

## Facilities
Structured logs with tick/module/entity IDs; correlated command/event traces; module/dependency/lifecycle inspection; resource grant/shortfall reason; fault records; per-subsystem CPU/update/allocation/queue metrics; config/schema/provenance reports; replay markers and comparison.

## Fault record
Include stable code, severity, owner module, affected capability/entity, start tick, cause/evidence, downstream effects, recovery status and next action where known. If cause is not established, say unknown rather than guessing.

## Boundaries
High-volume pulse/physics telemetry must be sampled/bounded. Developer inspection may access internals but must not leak to AI, sensors or ordinary cockpit APIs.

## Tests
Known injected fault creates correct trace; bounded buffers; correlation preserved; telemetry does not perturb deterministic results; gameplay cannot subscribe to developer-only state.
