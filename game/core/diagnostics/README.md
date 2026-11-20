# Simulation diagnostics and observability

**Owner:** game/core/diagnostics. **Status:** specification only.

Diagnostics explain simulation behavior; they do not become a second truth source or gameplay API.

## Facilities
Structured logs with tick/module/entity IDs; correlated command/event traces; module/dependency/lifecycle inspection; resource grant/shortfall reason; fault records; per-subsystem CPU/update/allocation/queue metrics; config/schema/provenance reports; replay markers and comparison.

## Fault record
Include stable code, severity, owner module, affected capability/entity, start tick, cause/evidence, downstream effects, recovery status and next action where known. If cause is not established, say unknown rather than guessing.

## Boundaries
High-volume pulse/physics telemetry must be sampled/bounded. Developer inspection may access internals but must not leak to AI, sensors or ordinary cockpit APIs.

## Tests
Known injected fault creates correct trace; bounded buffers; correlation preserved; telemetry does not perturb deterministic results; gameplay cannot subscribe to developer-only state.
