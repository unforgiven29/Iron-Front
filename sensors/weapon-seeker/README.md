# Weapon seeker observation and track processing

**Owner:** sensors/weapon-seeker. **Status:** architecture specification; no weapon-seeker runtime exists.

This is the shared runtime boundary for missile- or weapon-mounted sensors after physical energy has passed through the appropriate sensor front end. It converts available RF/IR/EO/laser/passive-RF measurements into weapon-local candidate reports and seeker tracks. Weapon packages supply exact hardware/configuration; existing Radar, IRST, optics and RF physics owners remain authoritative for their physical mechanisms.

## Read this page first

The seeker runtime is a small pipeline:
1. Read exact weapon seeker profile and state (power, cooling, alignment, scan/standby/search mode).
2. Request observations from the applicable physical front end: radar, infrared, EO/TV, laser or passive RF.
3. Apply seeker-specific gates, measurement quality, scan/gimbal/rate constraints and false-alarm handling.
4. Create candidate measurements with time, frame, covariance/uncertainty, source and observed features.
5. Associate candidates to a track using the selected seeker's own discrimination/association logic.
6. Publish acquisition, track, coast, lost, reject or reacquire state to weapon guidance.

A cue from the launching aircraft is a search cue, not an automatic seeker lock. A track is a weapon-local estimate, never a campaign entity reference.

## Canonical physical owners

- RF path, antenna, waveform, receiver and radar signal effects: sensors/Radar plus physics/radar.
- IR radiance, atmosphere, optics, detector inputs and thermal scene: sensors/IRST, sensors/EO-FLIR, physics/optics, physics/thermal and physics/environment.
- Visible/laser optical path and obscuration: physics/optics and installed EO/laser receiver capability.
- Passive RF emission observation: sensors/ESM-compatible receiver path, with source/frequency/bearing uncertainty.
- Weapon profile: game/modules/weapons/components/seekers.

This folder must not implement a second radar propagation solver, thermal scene renderer or optics engine. It owns the weapon seeker state machine and association policy.

## Child guides

- [Radar seeker processing](radar/README.md)
- [Infrared/EO seeker processing](infrared-and-eo/README.md)
- [Dynamic countermeasure discrimination](countermeasure-discrimination/README.md)

## State and outputs

Track state contains candidate/track ID local to the weapon; acquisition timestamp; measured features; LOS/angle/range/range-rate where actually available; covariance/uncertainty; SNR/contrast/quality; gate status; association score; track age; seeker mode; gimbal and scan state; power/cooling readiness; and confidence/validity.

Keep detection probability, false-alarm probability, association probability and probability of decoy confusion distinct. No static CM susceptibility or flare-effect field is permitted as the runtime decision.

## Failure and test contract

Support sensor startup/warm-up, power/cooling loss, field-of-regard, scan gaps, false alarms, missed detections, stale cues, candidate swaps, multiple candidates, countermeasure scenes, gimbal/rate saturation, damage and track memory. Tests must be deterministic under fixed observations/seed and must prove that no seeker receives hidden target truth.
