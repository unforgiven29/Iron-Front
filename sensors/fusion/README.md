# Multi-sensor and multi-source fusion

**Owner:** sensors/fusion. **Status:** design only; no fusion runtime.

Correlate reports from radar, RWR/ESM, IRST, EO/FLIR, IFF, MAWS, datalink and external observers. Fusion does not own sensor tracks or create physical detections.

Inputs retain source, acquisition/publication time, frame, estimate, covariance/error bounds, quality, confidence, age and local/remote provenance. Transform through valid frame contracts. Account for latency and correlated copies; relayed versions of one track are not independent evidence.

Define association gates, source correlation, track-to-track/measurement policy, duplicate suppression, split/merge and stale-source handling. Preserve conflicting hypotheses when identity is uncertain. Outputs include contributing sources and uncertainty so consumers can distinguish onboard detection from remote/fused track.

Test delayed reports, duplicate relays, frame mismatch, outliers, source dropout, conflicting IFF, track split/merge and deterministic replay.
