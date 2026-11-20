# Environment, atmosphere and weather fields

**Owner:** physics/environment. **Status:** design only; no complete queryable 3D time-varying field. The misspelled physics/enviroment path is deprecated; do not add new systems there.

Provide coherent environmental state for a position and simulation time. Include pressure, temperature, density, humidity/moisture and speed of sound; mean wind, shear, seeded correlated gust/turbulence; thermals/downdrafts, terrain-flow/mountain-wave approximations; precipitation, icing, visibility and surface condition when supported.

This is not one global wind vector or a visual cloud effect. Aerodynamics samples each surface; engine maps use ambient conditions; weapons query wind/air density; sensor owners query radar/optical propagation. Renderer only visualizes.

Seed weather/turbulence by stable scenario/spatial/time identities so query order does not change results. Cache/interpolate fields, maintain tile seam continuity and state explicit approximation envelope.

Validate standard atmosphere references, profile continuity, wind interpolation, turbulence autocorrelation/repeatability, precipitation/visibility bounds, terrain flow limits and query-order determinism.
