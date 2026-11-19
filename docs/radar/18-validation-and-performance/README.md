# 18 — Validation and Performance

## Purpose
Define how radar behavior is tested, calibrated, compared with references, and kept within browser performance budgets.

## Validation categories
- **Physics checks:** dimensional consistency, limiting cases, monotonic relationships, and analytical test cases.
- **Signal-chain cases:** known transmit/receive conditions and expected intermediate values.
- **Detection statistics:** Monte Carlo tests for Pd/Pfa under documented assumptions.
- **Waveform tests:** range/Doppler resolution, ambiguity, and pulse-compression behavior.
- **Antenna tests:** beamwidth, gain, sidelobes, scan loss, and array-fault effects.
- **Propagation tests:** line of sight, terrain obstruction, attenuation, and multipath scenarios.
- **Tracking tests:** maneuvers, missed detections, false alarms, crossing tracks, and uncertainty growth.
- **Regression scenarios:** fixed seeds and repeatable cases.
- **Reference data:** source, version, units, conditions, confidence, and measured/published/estimated/synthetic status.
- **Model limitations:** document approximations and validity conditions.

## Performance categories
- **Update-rate budgets:** pulse events, hardware state, processing, tracking, and display.
- **Adaptive fidelity:** reserve expensive calculations for important engagements or lab views.
- **Spatial acceleration:** terrain queries, line-of-sight checks, and candidate selection.
- **Worker scheduling:** move expensive work off the render thread where useful.
- **Memory/data transfer:** avoid excessive allocation and large worker messages.
- **Mobile profiles:** thermal limits, memory, GPU capability, and battery.
- **Scalability:** multiple radars, targets, emitters, and simultaneous engagements.
- **Determinism/replay:** reproducible timing and random seeds for debugging.

## Rule
Do not label a model physically exact merely because it looks plausible. State assumptions, validation coverage, and limitations.
