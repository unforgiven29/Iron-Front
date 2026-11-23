# Simulation clock, phases and multi-rate scheduler

**Owner:** game/core/simulation. **Status:** fixed-step accumulator and deterministic phase runner/multi-rate scheduler implemented (`game/src/core/simulation/SimulationScheduler.ts`, tests in `game/tests/unit/SimulationScheduler.test.ts`). Not yet implemented: time-scale/slow-motion policy, save/restore of pending scheduled work, event-driven message delivery (owned by game/core/events) and a load-validated rate configuration.

## Implemented contract
- Phases run in this fixed order: `commands`, `lifecycle-resources`, `environment`, `controllers`, `forces`, `integration`, `commit-events`, `sensors`, `decisions`, `publish`.
- Recurring tasks declare a phase, an integer priority, `periodTicks` and `offsetTicks`. Within a phase they run by (priority, id). Registration order never matters.
- One-shot work (`scheduleAt`) runs by (priority, sequence). At equal priority it runs after recurring tasks. From inside a tick, work can target a later phase of the same tick or any future tick. Targeting the current or an earlier phase throws.
- `timeSeconds = tick * stepSeconds`, so there is no accumulated drift. `elapsedSeconds` = `periodTicks * stepSeconds` for multi-rate tasks.
- Registering, unregistering or stepping during a tick throws. Mutation only happens between ticks.
- A throwing task is reported as a `TaskFault` (tick, phase, source, message) and disabled. The rest of the tick still runs, so a replay reproduces the same faults.
- Pause accumulates no time and reports the frame time removed. Overload backlog and the suspension clamp pass through from `SimulationClock`. `step()` executes exactly one tick for tests/replay and clears any partial-frame accumulator.

## Responsibility
Own simulation time and authoritative update order. Browser frame time requests advancement but never becomes physical integration time. Render interpolation occurs after snapshot publication and cannot feed back into simulation state.

## Domains
Declare fixed-tick, event-driven, sensor-revisit, scheduled/multi-rate and presentation-only domains. 120 Hz is the initial rigid-body/control target, not a requirement for every system. Engine/system, sensor, guidance, tactical AI and campaign intervals should be declared by configuration and validated under load.

## Suggested phase contract
Apply accepted commands → resolve lifecycle/resources → update environment/spatial state → update controllers/engines/actuators → accumulate forces → integrate rigid bodies/contacts → commit damage/events → process sensors → AI/campaign decisions → publish snapshots/diagnostics. Specify whether each event affects this tick or next tick. Stable phase, priority and sequence keys are mandatory.

## Overload and suspension
Expose executed steps, backlog, overload and time removed by the explicit tab-suspension clamp. Never silently discard accumulated time, reduce fidelity or alter module update rates to meet frame rate. A visible pause/slow-time policy must be explicit.

## Determinism tests
Different render cadences covering equal simulation time should produce equivalent authoritative results within documented tolerances. Test same-tick command timing, multi-rate due scheduling, stable order, overload/backlog, pause/suspension, replay and long-run tick precision.
