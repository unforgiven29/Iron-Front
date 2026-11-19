# 05 — Antennas and Beamforming

## Purpose
Describe the radiating/receiving aperture, geometry, element behavior, polarization, and directional response.

## Categories
- **Antenna geometry:** dish, horn, slot array, planar array, conformal array, and documented aperture types.
- **Element patterns:** gain, directivity, phase center, polarization, and frequency response.
- **Array geometry:** element spacing, layout, orientation, subarrays, and aperture dimensions.
- **Gain and beamwidth:** main-lobe gain, azimuth/elevation beamwidth, aperture efficiency, and scan loss.
- **Sidelobes and backlobes:** sidelobe structure, grating lobes, back radiation, and interference implications.
- **Nulls and pattern shaping:** commanded/adaptive nulls, tapering, weighting, and trade-offs.
- **Polarization:** linear/circular polarization where applicable, mismatch losses, and environmental/target effects.
- **Mechanical antenna behavior:** gimbal limits, stabilization, vibration, and physical orientation.
- **AESA element/module behavior:** phase/amplitude control, failed modules, calibration errors, and element variation.
- **PESA phase control:** phase shifters, quantization, scan limits, and architecture constraints.
- **Coupling and calibration:** simplified or detailed element interaction models, with fidelity clearly stated.

## Interactions
The antenna pattern must affect signal strength and interference in the simulation; it cannot be merely a visual effect. Failures and scan angle may change the pattern.

## Boundary
Owns aperture physics and pattern formation. Choosing where and when to point belongs in folder 06.
