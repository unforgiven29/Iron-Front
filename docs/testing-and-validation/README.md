# Testing and validation strategy

Testing is part of the architecture, not a cleanup phase. Every module and cross-system feature must prove behavior within a declared fidelity/validity envelope.

## Test layers

1. Schema/data: manifests, configuration, units, ranges, provenance, compatibility and migrations.
2. Unit: numerical kernels, state transitions, filters, algorithms, failures and random streams.
3. Contract: providers/consumers conform to shared interfaces and failure semantics.
4. Integration: real modules connected through production interfaces and scheduler.
5. Scenario/system: end-to-end causal behavior in controlled scenes.
6. Regression: previously passing behavior remains stable.
7. Performance: CPU, memory, allocation rate, worker messaging, entity scale and frame/tick time.
8. Presentation: cockpit controls, displays/audio and renderer reflect authoritative snapshots without owning state.

## Mandatory subsystem cases

Cover nominal, minimum/maximum, boundaries, invalid input, missing dependency, stale input, degraded/total resource loss, damage, partial failure, recovery, save/load and deterministic replay where applicable. Document unsupported conditions.

## Cross-system causal tests

- Electrical generation/bus failure changes allocations, equipment availability and cockpit indications.
- Hydraulic circuit loss affects connected actuators/gear/brakes while unrelated circuits continue.
- Fuel burn/transfer changes tank state, mass, CG and inertia; engine feed follows pumps/valves/pressure.
- Engine damage changes thrust, temperature, vibration, fuel use and signature.
- Store release changes mass/CG/drag and creates a weapon runtime with correct separation.
- Radar emissions propagate; receiver processing creates uncertain detections; RWR independently intercepts emissions.
- Terrain/structure changes affect collision, LOS, propagation, navigation and rendering through their respective interfaces.
- Sensor/datalink reports age; AI never receives hidden exact truth.

## Negative/isolation tests

Prove sensors cannot read hidden entity/campaign state; cockpit cannot mutate physics; aircraft modules cannot call other aircraft private code; weapon cannot bypass compatibility/release; optional-module failure leaves unrelated modules working; one resource branch cannot corrupt another; renderer frame rate cannot alter simulation results; unknown equipment IDs are not silently mapped.

## Determinism/replay

Use seeded random streams partitioned by stable subsystem/entity identity, deterministic event ordering and versioned numerical behavior. Record commands/external inputs. Replay the same stream and compare authoritative snapshots within documented tolerances. Isolate and document intentionally nondeterministic sources.

## Reference validation

Every comparison states source, exact variant/configuration, conditions, units, uncertainty and tolerance. Compare trends across an operating envelope. Separate sourced facts, estimates and gameplay tuning. Do not claim superiority over another simulator without repeatable public benchmarks.

## Performance budgets

Define representative scenes and measure simulation CPU per tick/by subsystem, worst/percentile tick time, render time separately, memory/allocation growth, entity/emitter/projectile/particle/chunk scaling, worker latency/copy cost, long-run memory and save size. Optimizations must preserve tested outputs/determinism.

## Evidence and completion

A feature is not complete because a model renders, a boolean changes or a sound plays. Completion requires reproducible scenarios, assertions on authoritative outputs, failure tests, performance evidence and documented fidelity limits.
