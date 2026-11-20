# Simulation clock, phases and multi-rate scheduler

**Owner:** game/core/simulation. **Status:** fixed-step accumulator exists; deterministic phase runner and full multi-rate scheduler remain to be built.

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
