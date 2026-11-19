# RWR Validation, Equipment Data and Benchmark Standard

This document governs how Iron-Front measures RWR fidelity. It supplements [RWR architecture](../../sensors/RWR/README.md).

## 1. What "accuracy" means

Do not collapse accuracy into visual similarity or the number of emitter types. Report separate metrics:

- **Interception:** probability of detecting a valid emission under a defined received-signal condition.
- **Measurement:** frequency, pulse timing, pulse width, amplitude and bearing error distributions.
- **Deinterleaving:** pulse assignment precision/recall and ambiguous/unknown rate.
- **Classification:** confusion matrix, top-k accuracy, false identification rate and confidence calibration.
- **Tracking:** bearing error, covariance consistency, track continuity, false-track rate and coast behavior.
- **Warning logic:** missed/false warning rates and latency for explicitly defined observable events.
- **Robustness:** performance under overlapping emitters, agility, jitter, multipath, interference, damage and degraded power/cooling.
- **Performance:** CPU time, memory, event throughput and frame impact for specified browser/device scenarios.

Every result needs a scenario definition, equipment/configuration version, random seed, simulation timestep, reference data provenance and tolerance.

## 2. Data provenance schema

Every nontrivial parameter should include:

- Stable parameter ID and description.
- Numeric value/distribution and SI unit, or an explicit unknown.
- Equipment/variant/software applicability.
- Source title, publisher, document revision, page/table/figure and URL when available.
- Evidence status: public-source, measured-from-public-test, estimated, synthetic, gameplay-tuned or unknown.
- Confidence and uncertainty/range.
- Validity conditions and known exclusions.
- Date added and data revision.

Do not disguise synthetic tuning values as manufacturer specifications. Do not infer classified values from a game or forum post and then label them real.

## 3. Receiver/antenna reference tests

Create controlled tests for:
- Frequency response and band edges.
- Receiver sensitivity and detection probability versus input level.
- Noise floor and false-alarm behavior.
- Channel bandwidth/selectivity and adjacent-channel rejection.
- Scan dwell/revisit and short-pulse capture probability.
- Dynamic range, compression, blocking and recovery.
- Antenna azimuth/elevation pattern, nulls, polarization and installed coverage.
- Bearing error versus SNR, aspect, frequency, installation sector and calibration state.
- Timestamp and frequency measurement errors.

Use analytically derived fixtures for baseline correctness, then public measured data where it exists. Synthetic fixtures are useful for regression but are not evidence of real-world fidelity.

## 4. Signal and deinterleaving test corpus

Include deterministic datasets for:
- Stable periodic pulse trains.
- Jittered and staggered intervals.
- Frequency-agile and variable-width signals.
- Scan-modulated amplitude/bearing sequences.
- Multiple emitters with similar parameters.
- Overlapping trains and partial observations.
- Missed pulses, false pulses and receiver dead time.
- Low signal-to-noise ratio and intermittent reception.
- Unknown emitters and incomplete/contradictory library records.

Measure pulse assignment quality and preserve an "unresolved" outcome. A forced label is not a successful classification.

## 5. Bearing and track tests

Test angle wraparound, ownship attitude/rotation, coordinate transforms, antenna-sector bias, multipath outliers, crossing bearings, multiple emitters at similar azimuth, missed updates and coast. Verify covariance grows when observations stop and that bearing-only tracks do not claim range. If a bearing-only localization method is later added, validate observability and geometry separately.

## 6. Comparative benchmark protocol

A claim such as "more accurate than DCS" requires:
1. A named, versioned DCS aircraft/equipment baseline and configuration.
2. The same defined scenarios and observable outputs for both systems.
3. Public or otherwise legitimately available reference truth for each test.
4. Identical measurement definitions and scoring rules.
5. Repeated runs, documented seeds and confidence intervals where stochastic.
6. Separate results for detection, measurement, classification, tracking, warnings and runtime cost.
7. Published limitations and cases where either system is intentionally simplified.

If equivalent DCS internal data is unavailable, do not make a numerical superiority claim. Compare only observable behavior against documented public reference cases and report the scope honestly.

## 7. Browser performance budgets

Set budgets after profiling the actual application and target devices. Track:
- Emissions and pulses generated per simulated second.
- Candidate paths evaluated and culled.
- Receiver channels active and occupied.
- Measurements produced, dropped and rejected.
- Deinterleaving/classification work per update.
- Emitter tracks maintained.
- CPU milliseconds per simulation tick and memory use.
- Rendering/UI cost separately from sensor simulation.

A performance optimization must not silently change detection probability, angular uncertainty or track quality. If fidelity is reduced, expose the selected quality tier and diagnostic reason.
