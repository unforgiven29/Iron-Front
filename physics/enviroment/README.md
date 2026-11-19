# Environment and Atmosphere Physics (legacy path spelling retained)

The existing directory is named `enviroment`; preserve it until a separately reviewed path migration. This is the canonical owner for ambient atmosphere/weather unless the architecture is deliberately migrated to a new `physics/atmosphere/` module. Do not implement duplicate atmosphere engines.

The atmosphere is a 3D, time-dependent world field, not one global wind value. Planned responsibilities:
- Pressure, temperature, density, humidity/moisture and speed-of-sound profiles.
- Standard atmosphere and mission-specific weather profiles.
- Altitude/position/time-dependent wind, wind shear and frontal boundaries.
- Seeded, spatially correlated gusts and turbulence.
- Thermals, downdrafts, mountain waves and terrain-induced flow approximations.
- Precipitation, icing, visibility and environmental surface conditions.
- Shared atmosphere queries for aircraft surfaces, sensors, weapons and world simulation.
- Spatial/temporal interpolation, caching, deterministic seeds and validation fixtures.

Atmospheric flow must be sampled consistently by nearby surfaces and aircraft. Avoid uncorrelated per-frame random noise. Rendering weather is separate from physical weather effects. See [PFM architecture](../../docs/flight-model/README.md).
