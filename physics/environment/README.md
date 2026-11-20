# Environment and atmosphere physics

Canonical owner for shared world atmosphere and weather fields. The previous misspelled path physics/enviroment/ has been migrated here; do not create systems under the legacy path.

The atmosphere is a three-dimensional, time-dependent field, not a single global wind vector. Responsibilities include pressure, temperature, density, humidity/moisture and speed-of-sound profiles; standard/scenario weather profiles; altitude/position/time-dependent wind, shear and frontal boundaries; seeded correlated gusts/turbulence; thermals, downdrafts, mountain waves and terrain-flow approximations; precipitation, icing, visibility and surface conditions; shared queries for aircraft, sensors, weapons and world; interpolation, caching, deterministic seeds and validation.

Atmospheric flow is sampled consistently by nearby surfaces and aircraft. Avoid uncorrelated per-frame random noise. Rendered weather is separate from physical weather effects. See docs/flight-model/README.md.
