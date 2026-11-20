# Optical path and visibility physics

**Owner:** physics/optics. **Status:** shared path-model design only; no EO/FLIR detector/detection engine.

Provide wavelength/band-dependent optical transmission and path effects for EO, FLIR, IRST and laser-related systems: absorption, scattering, aerosols, haze/fog, precipitation, smoke/dust, humidity and background where supported. World/physics supplies physical obstruction; renderer depth buffers are never the LOS authority.

Sensor owns aperture, optics, detector, processing and detection. Target signature source supplies uncertain radiance/contrast. This service returns path transmission/quality and limitations, not a target identity or detection.

Validate clear-air limiting case, wavelength behavior, attenuation trends, weather bounds, terrain/structure obstruction, background contrast and deterministic repeatability.
