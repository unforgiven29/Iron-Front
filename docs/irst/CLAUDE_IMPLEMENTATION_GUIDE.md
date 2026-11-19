# Claude Implementation Guide — IRST and Passive Infrared Sensors

The IRST area is currently a placeholder. Implement this as a passive sensor chain with explicit equipment and environment dependencies. Do not build a camera that reads target positions from the game world.

## 1. Audit and ownership first

Inspect existing sensor, radar, RWR, atmosphere, weather, target/engine thermal state, terrain visibility, sensor-fusion, aircraft module, cockpit and renderer code. Reuse shared contracts. Do not create another atmosphere, track manager or rendering pipeline.

Canonical boundaries:
- `sensors/IRST/`: IRST hardware/equipment, optics/detector, scan scheduler, processing, detections and tracks.
- Shared environment/physics: radiative/thermal background, atmosphere and line-of-sight queries.
- Propulsion/aircraft systems: engine and airframe thermal state.
- Aircraft variant: exact installation, field of regard, sensor controls and data.
- Sensor fusion: combines uncertain reports from independent sensors.
- Graphics: image/scope/debug presentation only.

## 2. Implement one honest vertical slice

Start with one aircraft sensor fit and a simplified but causal chain:
1. Static equipment configuration with documented band, aperture, FOV, scan limits and sensitivity assumptions.
2. Sensor orientation and field-of-regard geometry.
3. Line-of-sight and shared atmospheric transmission query.
4. Target radiance/contrast profile based on aircraft engine state, aspect and background.
5. Detector/noise model with explicit threshold and uncertainty.
6. Timestamped angular measurement report.
7. Track initiation/coasting/deletion with uncertainty.
8. Cockpit/debug display driven by those reports.
9. Deterministic scenario tests.

A simplified model is acceptable if its limitations are explicit. A world-coordinate range threshold or visible-mesh check is not.

## 3. Critical correctness rules

- IRST is passive; do not add a radar-like transmitted pulse.
- Never read exact target range/identity/faction from world truth to create a detection.
- Angular line-of-sight is the normal measurement; do not output exact range unless a separately implemented method supports it.
- Target IR signature varies with engine state, afterburner, aspect, skin heating, shielding and damage.
- Background radiance and atmospheric transmission affect contrast.
- Detector noise, saturation, dwell, scan geometry and stabilization affect probability/quality.
- A missed observation must degrade/coast a track.
- Radar cueing may point the IRST but cannot guarantee an IRST detection.
- Classification is distinct from detection and must carry uncertainty.
- The renderer must not create or suppress sensor detections.

## 4. Data model and uncertainty

Every report should carry sensor ID, timestamp, coordinate frame, angular measurement, angular uncertainty, quality/SNR-like metric, detection confidence, mode and validity. Tracks carry estimated state, covariance/uncertainty, age, source history and lifecycle. Keep raw candidate, detection, track and classification as separate stages.

Configuration data must include provenance and confidence. Label public, estimated, synthetic and unknown values. Do not imply exact classified spectral signatures or detector performance.

## 5. Staged implementation

- Stage A: interfaces, units, frames, time and deterministic test harness.
- Stage B: field-of-regard, scan and line-of-sight.
- Stage C: target thermal state and background/environment queries.
- Stage D: spectral transmission and radiance/contrast approximation.
- Stage E: optics, detector noise, thresholding and angular measurement.
- Stage F: track management and sensor fusion.
- Stage G: cockpit, debug visualization, failures and performance.

Do not add every aircraft's IRST until one equipment fit has been validated.

## 6. Required tests

Test sensor boresight, gimbal limits, scan timing, stabilization under aircraft motion, aspect-dependent signature, engine throttle/afterburner transients, background contrast, atmospheric attenuation, terrain obstruction, false alarms, missed detections, angular error, track coasting, power/cooling failure and deterministic replay. Statistical detection tests must declare assumptions and sample sizes.

## 7. Browser performance

Use spatial indexing for candidate geometry, bounded target evaluation, appropriate scan update rates and cached environment queries. Do not evaluate every target at every pixel every frame. Keep imagery resolution and thermal detail scalable. Profile dense scenes and mobile browsers. Performance optimizations must not turn passive detection into a fixed-radius shortcut.

## 8. Required PR report

List the actual sensor fit implemented, source data and assumptions, causal chain stages completed, tests and statistical results, measured performance, unsupported behavior and next step. Do not claim full IRST fidelity because a thermal camera texture or target glow has been added.
