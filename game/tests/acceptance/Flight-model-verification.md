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


## Movable aerodynamic device acceptance cases

### FM-13 — Device taxonomy and fit
Validate that each aircraft declares only its fitted movable devices. Reject a slat/LEF, spoiler/speedbrake or flap/flaperon substitution when the physical mechanism differs. An unconfirmed device remains unknown rather than becoming a default surface.

### FM-14 — Slat versus leading-edge flap
For a slot-forming slat, verify slot gap/overlap and the supported slot-flow/separation model. For an LEF, verify the camber/shape-change model. Test that a source/configuration cannot silently switch between these device types.

### FM-15 — Trailing-edge flap family
Validate actual geometry/type (plain, split, single-/double-slotted, Fowler or other fitted type), deployment travel/time, lift/drag/pitch trends, schedule, control effectiveness changes and supported envelope.

### FM-16 — Flaperon dual function
Prove scheduled symmetric TEF displacement and differential roll-control command are combined without double-counting area or overriding one another. Test asymmetric actuator response and roll/yaw moment.

### FM-17 — Spoiler and lift-dump behavior
For aircraft fitted with spoilers, test local lift reduction, drag increase, roll/yaw/pitch coupling, deployment sequence, ground/flight interlocks and asymmetric deployment. For aircraft without spoilers, ensure no spoiler force or control path is generated.

### FM-18 — Speedbrake/airbrake behavior
Test drag and pitching/yawing moments, panel-by-panel actual motion, finite deployment time, hinge/load effects, blow-back if fitted, configuration interlocks and asymmetric faults. Do not model an airbrake as a spoiler.

### FM-19 — Actuator and hinge-load response
Test rate/force limits, pressure/flow/electrical dependency, hinge-load effects, stops, lag, free play/backlash where supported, jam/runaway, damage and failed position feedback. Actual surface state must differ from command when constraints/faults require it.

### FM-20 — Cross-device coupling and no double counting
Test interactions among LEF/slats, flaps, ailerons/flaperons, stabilators/tailerons, spoilers, speedbrakes, gear and stores. Verify the model does not count the same panel area or coefficient increment twice.
