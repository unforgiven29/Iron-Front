# Chaff cloud product and deployment model

**Owner:** countermeasure product profile and deployment. RF scattering/environment remains physics/radar; radar seeker discrimination remains sensors/weapon-seeker.

A chaff release creates a finite, moving and dispersing scattering cloud. It is not a fixed RCS increase attached to the aircraft and not an automatic missile defeat.

## Product/deployment record

Define cartridge type/variant, mass, physical amount or equivalent particle loading, dispenser station/orientation, release impulse/velocity, release timing, deployment envelope, initial cloud geometry, dispersion model, effective lifetime and provenance. Use a calibrated simplified cloud state if individual fibers are too expensive; disclose the approximation.

## Runtime cloud state

Track cloud position/velocity, age, spatial extent/density, orientation/dispersion, wind/turbulence response, effective radar scattering by supported frequency/polarization/aspect, decay/settling and observation validity. Scattering changes with cloud age and viewing geometry. Model only the complexity that affects the selected RF fidelity.

## Integration

The cloud contributes scatter through physics/radar into the radar environment. Each radar/weapon receiver gets only the returned signal after its path, antenna and receiver processing. Guidance does not receive a Boolean chaff-hit result.

## Tests

Test deployment delay and impulse, cloud growth/decay, wind drift, different observation angles/frequencies, radar clutter and false detections, seeker track association and deterministic replay. Vary release time and geometry instead of assigning a fixed effectiveness rating.
