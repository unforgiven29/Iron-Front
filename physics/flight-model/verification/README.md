# Flight-model verification and flight-log comparison

**Owner:** physics/flight-model/verification. **Status:** verification tooling specification; no flight-log verifier is implemented.

One valuable feature of the A-4E-C ExternalFM repository is that it has both unit-test projects and standalone verification utilities. Its FM_Verify tool reads Tacview-exported CSV state samples and compares calculated force/flight behavior against recorded trajectories. Iron-Front should build the same class of independent evidence, but should not copy its C++ tooling or assume Tacview values are direct truth.

## Verification layers

1. **Analytical fixtures:** equations with known limiting/closed-form results (dynamic pressure, force transforms, moment arms, standard atmosphere points).
2. **Component fixtures:** coefficient interpolation, panel local flow, control surface mapping, actuator response, engine installation transforms.
3. **Integrated scenario tests:** trim, climb, acceleration, turn, sideslip, stall/recovery, asymmetric stores, engine-out and system-failure response.
4. **Flight-log comparison:** import time-series observations from supported formats, normalize units/frames and compare the simulated trajectory/derived signals.
5. **Regression corpus:** versioned reference cases run on each relevant change with output differences and uncertainty tolerances recorded.

## Flight-log ingestion

A log adapter maps each source's timestamp, position, altitude, velocity/TAS, attitude, angular rates, AoA/sideslip, accelerations/G, control positions, engine state and configuration into a canonical record. Preserve original columns and source metadata. Explicitly document conversion from Tacview/DCS conventions to Iron-Front ENU/FRD; do not infer the orientation sign from names.

Logs may contain sampled, filtered, quantized or game-engine-produced values. Record provenance and fidelity. Never claim a log is an independent real-aircraft measurement unless it is sourced as such.

## Comparison metrics

Compare time-aligned position/velocity/attitude trajectories, speed/altitude trends, angular rates, AoA/sideslip, load factor, control response, energy changes and engine response where available. Use initial-state alignment and declared interpolation; account for different sample rates and time origins.

Report error metrics (bias, RMS, percentile/max deviation, drift over time), accepted tolerance, uncertainty, missing channels, out-of-envelope segments and scenario identity. A single visual overlay is not enough.

## Validation discipline

Separate calibration data from held-out validation data. Do not tune coefficients against the same case and then call that case independent validation. Version each dataset and each simulation build. Preserve input commands/state snapshots and deterministic seed where applicable.

## Tests

CSV/parser unit cases; missing/reordered columns; malformed timestamps; unit/frame conversion; resampling; known quaternion/angle fixtures; deterministic replay; metric calculation; calibration-vs-validation separation; and generated report content.
