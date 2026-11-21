# Shared aircraft flight-model verification acceptance

**Purpose:** Define integration and validation evidence for the shared FM architecture and per-aircraft installations. **Status:** requirements only; no complete flight model is implemented.

## Entry conditions

- The selected aircraft variant and engine installation are resolved.
- Stage prerequisites in the implementation roadmap have passed.
- Shared rigid-body, atmosphere, propulsion and aerodynamic interfaces have explicit owners and tests.
- Surface geometry and coefficient datasets pass schema/provenance validation.
- Every run records aircraft/data/software versions, initial mass/CG/inertia, atmosphere, stores, controls, seed and fixed tick.

## Shared acceptance cases

### FM-01 — Force/moment ownership and frame consistency
A known force at a known station produces the expected force and r × F moment exactly once. Body/world/stability/wind transforms and positive directions pass cardinal cases. Current CG is the single declared moment reference.

### FM-02 — Per-element local airflow
At each surface station, local airflow accounts for aircraft translation, wind and angular rate. Pure roll/pitch/yaw fixtures produce the expected station velocity signs. One aircraft-wide AoA/q value cannot be substituted for all panels.

### FM-03 — Coefficient-data validity
Exact table knots, interpolation, axes, units and discrete configurations are tested. Out-of-domain data produces an explicit invalid/unsupported/estimated result; no silent clamping or invented zero coefficient.

### FM-04 — Symmetric baseline and trim
A symmetric undamaged aircraft with symmetric loading produces symmetric surface forces and moments. Trim conditions are evaluated against sourced mass, CG, engine state, atmosphere and coefficients. Any remaining trim bias is diagnosed by component rather than hidden through a global multiplier.

### FM-05 — Control command versus achieved motion
Pilot input and flight-control logic generate targets; actuator/resource systems produce actual positions/rates; aerodynamic elements consume achieved positions. Rate limits, stops, low hydraulic pressure, electrical servo loss and mechanical jam alter behavior causally.

### FM-06 — High-lift/drag configuration
Flaps, slats, spoilers, speedbrakes, gear and store configuration change their documented aerodynamic effects and move over time. Left/right asymmetric deployment or damage produces asymmetric output. A switch position is not treated as achieved device position.

### FM-07 — Propulsion installation and asymmetry
Engine model thrust is transformed through exact aircraft installation station/axis once. Twin-engine aircraft preserve independent engine states; asymmetric thrust and engine failure generate the correct moment sign. Fuel loss and accessory loads remain in their owning systems.

### FM-08 — Flow interactions
Ground effect, downwash, wake, LERX/LEX, propwash and jet interaction are enabled only where a model/data package explicitly supports them. Compare enabled/disabled effects against validated reference cases. Visual vapour/contrail output has no force authority.

### FM-09 — Damage and structural response
Local element/actuator/engine damage changes connected components only. Structural overload uses sourced threshold/duration criteria and distinct limit/ultimate/fatigue states where implemented. A generic wing health multiplier cannot replace local damage topology.

### FM-10 — Flight-log replay and comparison
Import time-series logs with explicit time, units and frames. Preserve the original file and a normalization map. Compare time-aligned trajectory and state signals with bias/RMS/max/percentile metrics and tolerances. Calibration data and held-out validation data are separate.

### FM-11 — Determinism and save/replay
Identical initial conditions, commands, data versions, fixed ticks and random streams reproduce the same force/moment contributions and authoritative state within declared floating-point tolerance. Stateful filters/interactions/actuators are serialized or deterministically reinitialized.

### FM-12 — Browser performance
Measure assembly cost per aircraft and per aerodynamic element separately from rigid-body, propulsion, sensors and renderer. Record allocations, memory, tick overruns and interaction cost. Fidelity reductions require explicit configuration and must not silently change during a mission.

## Required evidence

For each case record test ID, aircraft identity, dataset provenance, initial state, input sequence, seed, tick, assertions, tolerance, result, limitation and report artifact. Distinguish synthetic unit tests, internal consistency, comparison against game logs, comparison against DCS logs and independent real-aircraft validation. One successful maneuver or visual demo does not validate the full envelope.
