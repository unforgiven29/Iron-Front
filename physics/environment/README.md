# Environment, atmosphere and weather fields

**Owner:** physics/environment. **Status:** standard atmosphere, gravity, wind-field contract and local airflow implemented in `game/src/physics/environment/Atmosphere.ts` (tests: `game/tests/unit/Atmosphere.test.ts`). Not yet implemented: humidity, seeded gusts/turbulence, thermals, terrain flow, precipitation, icing, visibility and real-world weather data.

## Implemented contract
- **Atmosphere:** ISO 2533:1975 (identical to ICAO and US 1976 below 32 km), using its defined constants only. Valid from -2 km to 32 km geopotential. Outside that it throws `AtmosphereEnvelopeError` rather than extrapolating. Every sample names its model.
- **Non-standard days:** an explicit ISA+dT temperature offset (±60 K) keeps standard pressure and derives density and speed of sound from it.
- **Gravity:** inverse-square from g0. `sampleEnvironment` supplies a world-ENU gravity vector for the rigid body.
- **Wind:** a `WindField` contract (`sample(positionEnu, time)`), with `uniformWind` and `layeredWind`. Layered wind interpolates linearly between layers and holds the end layers at the extremes. A non-finite wind is rejected.
- **Local airflow:** body velocity relative to the air mass, in world and body frames, with true airspeed, Mach and dynamic pressure. Compute it per element where rotation or wind gradient matters.
- **Local approximation:** altitude is origin MSL + ENU z, with Earth curvature ignored until the geodesy slice.
- **Verified:**
  - Matches the US 1976 tables at -1, 0, 5, 11, 15, 20, 25 and 32 km (pressure within 1e-5 relative).
  - The profile is continuous across layer boundaries.
  - The envelope is refused outside its limits, and ISA+dT behaves as stated.
  - Results don't depend on query order. The misspelled physics/enviroment path is deprecated; do not add new systems there.

Provide coherent environmental state for a position and simulation time. Include pressure, temperature, density, humidity/moisture and speed of sound; mean wind, shear, seeded correlated gust/turbulence; thermals/downdrafts, terrain-flow/mountain-wave approximations; precipitation, icing, visibility and surface condition when supported.

This is not one global wind vector or a visual cloud effect. Aerodynamics samples each surface; engine maps use ambient conditions; weapons query wind/air density; sensor owners query radar/optical propagation. Renderer only visualizes.

Seed weather/turbulence by stable scenario/spatial/time identities so query order does not change results. Cache/interpolate fields, maintain tile seam continuity and state explicit approximation envelope.

Validate standard atmosphere references, profile continuity, wind interpolation, turbulence autocorrelation/repeatability, precipitation/visibility bounds, terrain flow limits and query-order determinism.
