# Weapon seeker and countermeasure simulation

**Status: architecture README only for this task. No seeker or countermeasure runtime code was added or retained from this task.**

This directory is reserved for weapon-mounted sensor front ends, acquisition/tracking state, discrimination interfaces and sensor-specific countermeasure interaction. Keep weapon product definitions separate from reusable seeker physics and signal-processing algorithms.

## Planned module boundaries

- **Infrared / imaging infrared:** optical bands, detector physics, optics, FOV, gimbal travel/rate, thermal scene inputs, background/clutter, image/feature extraction, track memory and acquisition limits.
- **Active radar seeker:** independent transmitter/receiver, waveform, antenna/array, RF link budget, target scattering, clutter/interference, range-Doppler processing, detection, monopulse/angle estimation where fitted, and terminal tracking.
- **Semi-active radar seeker:** receiver-only missile front end, external illumination dependency, illuminator waveform compatibility, pulse/track continuity, range/angle measurement and illumination-loss behavior.
- **Passive RF / laser / EO:** architecture-specific observations, geometry, signal limits, track quality and external dependencies.
- **Seeker control:** gimbal, servo, scan pattern, stabilization, rate/acceleration limits, acquisition dwell, memory, coast, reacquisition and failure.
- **Discrimination:** candidate feature observations and uncertainty; target/decoy classification must not receive hidden target/decoy entity labels.
- **Countermeasure physical models:** flare thermal history and spectrum; chaff particle/cloud distribution, orientation, wavelength/polarization response and dispersion; towed/active decoys where supported.
- **ECCM:** product-specific logic and limitations. Do not grant generic immunity to countermeasures.

## Required separation

A seeker measurement method is not a guidance law. Guidance must consume timestamped, uncertain seeker/navigation reports. The missile dynamics determine the actual trajectory. The fuze and warhead are separate components and must not infer a hit from a seeker lock alone.

## Countermeasure susceptibility

Do not reduce susceptibility to a single scalar. Model the causal chain: decoy release and physical state → propagation/scene → seeker observation → filtering and discrimination → track update/track break/reacquisition → guidance response. Include geometry, aspect, range, closing rate, background, spectral band, seeker generation, scan/gimbal state, target signature and countermeasure timing where supported by evidence.

## Data quality and validation

Every seeker/decoy profile must identify exact product and software variant, applicable aircraft/launcher, source provenance, confidence and unsupported areas. Unknown values stay unknown. Synthetic test profiles are explicitly labelled. Build analytic tests and controlled scenarios before making claims about real missile performance.

This document defines future module ownership and behavior. It does not assert that generic seeker or countermeasure algorithms are implemented or calibrated.
