# F-16C Block 50 — flight-model validation plan

**Target:** F-16C Block 50 / GE F110-GE-129. **Status:** validation plan only; no validated FM results are claimed.

## Variant and evidence gate

Each test binds exact aircraft block, engine, operator/software configuration, data revision, mass/store state, centre of gravity, atmosphere and model version. A result is labelled synthetic consistency, sourced-data comparison, game-log comparison or independent real-aircraft validation. These evidence classes must not be conflated.

## Test envelope

Build the envelope only from supported source/test data. At minimum plan:
- Static geometry/mass/CG and force/moment sign checks.
- Ground idle/taxi and takeoff configuration, including gear and high-lift state.
- Clean and representative takeoff/landing configuration.
- 1-g trimmed level flight at several supported speeds/altitudes.
- Climb/acceleration and power response with the F110 installation.
- Coordinated turns and roll/pitch/yaw response.
- High-AoA/stall and recovery only within evidence-backed data.
- Leading-edge/trailing-edge device deployment and asymmetric faults.
- Gear/speedbrake/store/pylon/tank drag and mass effects.
- Engine-out or thrust-loss cases where supported.
- Hydraulic/electrical loss changing actual actuator response.
- Structural-load limit and damage response.

## Verification outputs

Record trim error, required control deflection, speed/altitude/attitude trajectory, angular rates, AoA/sideslip, normal/axial/lateral load, engine thrust/fuel flow, panel forces/moments, actuator targets/actual positions, model validity and uncertainty. Compare only like-for-like configurations and environments.

## Acceptance rules

A model must not pass by adding global multipliers or forcing a maneuver to match one log. Tune only identifiable parameters using calibration data, then verify against held-out cases. If no suitable source exists for an envelope region, label that region unvalidated and keep model validity explicit.
