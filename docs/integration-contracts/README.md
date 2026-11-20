# Integration contracts

This document defines how modules communicate. Independent modules are useful only if interfaces share consistent semantics, timing, failure behavior and ownership.

**Status:** Contract specification only; no runtime event bus/resource allocator is claimed to exist.

## Principles

- Every authoritative value has one owner.
- Consumers use public interfaces, never private state.
- Commands are requests; events are committed facts.
- Observations are imperfect and retain source/time/uncertainty.
- Snapshots are immutable read models.
- Resource grants come from shared allocators/services.
- Contracts are versioned and schema-validated.
- No circular dependencies; integrate through a shared contract or orchestrator.

## Message envelope

Where applicable, messages carry: message ID; contract ID/version; producer module ID; entity ID; simulation tick/time; coordinate frame; correlation ID; provenance; quality/status; uncertainty. Use simulation time, not wall-clock time. Absence must not ambiguously change meaning.

## Commands, events, observations and snapshots

**Command:** request such as set radar mode, move control, fire weapon or allocate load. Includes issuer, target, requested value, tick, preconditions, expiry/cancellation and correlation ID. It may be rejected, delayed, limited or fail.

**Event:** fact such as mode changed, weapon released, bus lost, component damaged or track dropped. Published by the authoritative owner after state transition.

**Observation/report:** measured or inferred result such as radar detection, RWR pulse descriptor, IRST contact or datalink report. Includes source, acquisition time, age, frame, uncertainty, confidence and quality. Never convert it into ground truth.

**Snapshot:** immutable tick-stamped representation for consumers, AI, cockpit and renderer. Includes validity/staleness.

## Authority examples

- Cockpit sends switch command; aircraft subsystem validates/changes state and publishes status.
- Engine requests fuel/electrical/cooling; resource services issue grants; engine reports consumption/state.
- Radar owns private tracks and publishes approved reports. RWR receives RF emissions through shared propagation, not radar target tracks.
- World owns terrain/structure truth; physics/sensors query services; renderer consumes geometry snapshots.
- Launcher validates release; after release, weapon owns its flight state.

## Resource contracts

Providers publish capacity, quality, availability, limits and transient behavior. Consumers declare demand, priority, minimum viable grant and fallback behavior. Allocation reports grants, shortfalls, source and reason.

Keep electrical power/voltage, hydraulic pressure/flow, fuel mass/flow, coolant/temperature, oxygen and data-link quality dimensionally distinct. A boolean may be derived for presentation but cannot replace the resource model.

## Failure semantics

Every contract documents missing producer, stale/invalid/out-of-range data, mid-operation dependency loss, stop/degrade/coast/retry/fallback behavior, diagnostic reason and recovery conditions. Never replace invalid technical data with plausible defaults.

## Time and frames

Contracts declare update domain (per tick, event-driven, sensor revisit, strategic interval or presentation-only), timestamps/maximum age, allowed interpolation/prediction, latency/order and determinism. Every spatial value names frame, axes, handedness and units. SI is the simulation default; convert only at boundaries.

## Example producer/consumer pairs

| Producer | Contract | Consumer | Constraint |
|---|---|---|---|
| Radar transmitter | RF emission | RF environment | Emitted signal, not target tracks |
| RF environment | Received RF | Radar/RWR receiver | Propagation and limitations |
| Resource allocator | Power/pressure/flow grant | Equipment/actuator | Quantity, quality and fault reason |
| Sensor engine | Detection/track report | Avionics/AI/fusion | Preserve source/time/uncertainty |
| Launcher | Release event | Weapon runtime | Compatibility and safe separation |
| World query | Terrain/LOS result | Physics/sensors/navigation | Not renderer visibility |
| Core | Entity snapshot | Cockpit/renderer | Immutable and tick-stamped |

## Acceptance tests

Test nominal, missing dependency, stale/invalid data, partial and total resource loss, mid-operation failure, recovery, duplicate/out-of-order messages, replay determinism and unrelated-consumer isolation. Include negative tests proving one branch's failure does not corrupt another.
