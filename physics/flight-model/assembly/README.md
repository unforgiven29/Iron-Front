# Flight-model assembly and update orchestration

**Owner:** physics/flight-model/assembly. **Status:** architecture only.

The assembly composes shared physics services and one aircraft's configuration into a single deterministic flight-model tick. It is analogous to the A-4E-C FlightModel coordinator, but it is not a monolithic home for engine, fuel, aerodynamic, actuator or rigid-body algorithms.

## Responsibilities

- Resolve the exact aircraft configuration and required capability versions before simulation starts.
- Construct the configured surface/element graph from aircraft-owned data.
- Receive immutable tick inputs and resource/actuator results through public contracts.
- Execute the agreed calculation phases in deterministic order.
- Collect force/moment contributions from aerodynamic elements, propulsion installation and other owners.
- Publish an auditable result for rigid-body integration and telemetry.

The assembly must be thin enough to unit-test. Component algorithms remain in their canonical owners.

## Tick input contract

One tick input includes: simulation tick and fixed dt; rigid-body pose, world/body velocity, angular velocity and current centre of mass; atmosphere and wind at the aircraft; exact mass/inertia snapshot; installed configuration ID/version; actual control-surface and high-lift-device positions; damage and equipment readiness snapshots; engine output snapshots; relevant resource grants/quality; and world/contact context required by the enabled model tier.

All frames and units are explicit. A missing required field fails or marks the slice invalid; it is not silently replaced by zero.

## Phase contract

1. Validate tick/configuration and input freshness.
2. Resolve control commands through the aircraft-specific control package.
3. Consume actual actuator outputs; do not advance resource solvers a second time.
4. Read engine outputs and installation transform(s).
5. Evaluate per-surface local flow and coefficient data.
6. Evaluate explicitly enabled interactions and configuration effects.
7. Collect non-aerodynamic contributions from their owners.
8. Convert each force to a moment about the same current CG exactly once.
9. Aggregate deterministically and publish a force/moment frame.
10. Publish diagnostics and validity.

When a producer depends on a previous phase, the dependency is explicit in the simulation scheduler; no hidden callback ordering is allowed.

## Output contract

Publish a typed force/moment frame with source contributions, total body/world force and moment, reference CG, units, frame, tick, configuration version and validity. Diagnostic output may include per-element airspeed, AoA, sideslip, dynamic pressure, coefficient values, lookup domains, force vector, moment vector and approximation warnings. Diagnostics are not a way for AI/sensors to query hidden world truth.

## Lifecycle

Cold, hot and airborne starts are scenario-state initialization profiles, not separate physics models. Each initializer establishes component state through its owner and records which systems are powered/ready. Reset must be deterministic and must not leave stale force, previous-AoA, filter or actuator history from a preceding aircraft/session.

## Failure behavior

A missing optional panel, absent sensor or optional model interaction may be omitted only through an explicit degraded configuration. Missing required geometry/coefficient data prevents the associated capability from claiming supported operation. An engine or actuator failure is consumed as its actual state, not replaced with an arbitrary thrust or control multiplier.

## Tests

Test ordering, single contribution ownership, no double-counted application-point moments, mirrored element assembly, stale snapshot rejection, failed optional/required dependencies, deterministic aggregation under input ordering changes, cold/hot/airborne reset and save/replay of all stateful component history.
