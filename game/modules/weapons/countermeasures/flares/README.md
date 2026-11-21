# Infrared flare product and deployment model

**Owner:** countermeasure product profile and deployment. IR scene/propagation and detector response remain in the IR/thermal sensor and physics owners; seeker discrimination remains sensors/weapon-seeker.

A flare is a time-varying IR/thermal source with its own trajectory, burn state and spectrum. It is not a universal flare-strength value and must not directly tell a missile to miss.

## Product/deployment record

Define flare type/variant, mass, deployment mechanism, station/orientation, ejection impulse/velocity, ignition delay, spectral radiance/temperature versus time, burn duration/decay, apparent source size, spectral band support, safe-separation requirements and source provenance. Unknown classified spectral details remain unknown or use explicitly synthetic test profiles.

## Runtime state

Track position/velocity, age, ignition/burn phase, temperature/radiance by modeled band, size/shape, orientation if needed, wind/turbulence and decay. The radiance seen by a seeker depends on range, aspect, atmosphere, background, bandpass, optics/detector response and scene processing.

## Integration

The flare enters the thermal/IR scene. Weapon IR seekers receive the resulting measured scene through their detector/processing architecture. Different scanning and imaging seekers can produce different candidate/track results from the same scene.

## Tests

Vary release time, target/flare separation, target aspect/throttle/thermal state, flare age, wind, range, background, cloud/obscuration, detector band and seeker architecture. Test multiple-flare scenes, saturation and false candidate association. No fixed flare-immunity multiplier.
