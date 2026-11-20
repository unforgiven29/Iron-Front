# Simulation clock and scheduler

The simulation clock owns authoritative time and update order. Browser rendering is not the simulation clock. Use a fixed or explicitly bounded step, deterministic tick sequencing and seeded random streams.

Modules declare update domains: fixed-tick, event-driven, sensor revisit, scheduled strategic update or presentation-only. Scheduler applies those rates and publishes tick/time metadata. Document phase ordering and dependencies. Avoid ordering that depends on object iteration, network arrival timing or rendering frame rate.

**Status:** Architecture specification only.
