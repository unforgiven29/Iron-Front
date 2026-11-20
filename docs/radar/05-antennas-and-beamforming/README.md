# 05 — Antennas and Beamforming

## Purpose
Describe the radiating/receiving aperture, geometry, element behavior, polarization, directional response, and any actual phase/amplitude control. Aperture construction, RF electronics, and scan mechanism are separate configuration dimensions.

## Parabolic reflector dish
Represent a parabolic-reflector aperture using its physical reflector and feed arrangement, not as a generic planar array.

Configuration should capture, where known:
- Reflector diameter, focal length or focal ratio, shape/deformation and surface RMS error.
- Prime-focus, offset-focus or documented dual-reflector feed arrangement; feed phase-center location and feed type.
- Feed illumination taper and phase distribution across the reflector; edge taper, spillover and support/feed blockage.
- Aperture efficiency, polarization, frequency range, manufacturing/alignment error and radome losses where applicable.
- Mechanical mount, pointing limits, stabilization, vibration and pointing error (the mount/scan controller owns movement).
- Main-lobe gain/beamwidth and sidelobe/backlobe structure as a function of frequency and orientation.

The reflector/feed illumination determines the aperture distribution. Do not approximate every dish as an ideal uniformly illuminated circular aperture unless that is the explicitly selected and documented fidelity tier. A dish does not by itself specify pulse, pulse-Doppler, CW, PESA or AESA electronics.

## Flat slotted-waveguide planar array
Represent this as a waveguide-fed slot aperture, not automatically as an active phased array.

Configuration should capture, where known:
- Flat aperture width/height, number of slots, rows/columns and slot spacing.
- Slot orientation, offset, dimensions/coupling and row/column layout.
- Waveguide type, feed-network topology (series, parallel, corporate or equipment-specific), terminations and insertion losses.
- Slot-to-slot phase progression, amplitude distribution/taper and polarization.
- Frequency range, bandwidth, frequency sensitivity/dispersion, scan behavior and supported phase-control mechanism.
- Manufacturing tolerances, failed/blocked slots, feed-network faults and calibration limits.

The pattern should be formed from the slot-element response, slot positions/coupling and feed-network amplitude/phase distribution. A fixed-feed array may have a fixed beam, a frequency-dependent beam or a mechanically steered installation; electronic steering is only available when the actual feed/phase-control architecture supports it. Do not assign AESA T/R modules simply because the aperture is planar.

## Other aperture and element categories
- **Horn and feed antennas:** aperture dimensions, flare, feed pattern, phase center, polarization and bandwidth.
- **Phased planar arrays:** element/subarray geometry, spacing, element patterns, phase/amplitude control, scan limits and coupling. State whether the RF architecture is PESA, AESA or another documented implementation.
- **Conformal arrays:** element locations and local orientations on a curved platform surface.
- **Reflectarrays and specialized apertures:** use equipment-specific geometry and avoid forcing them into a dish or slotted-waveguide model.

## Shared pattern and beamforming requirements
- **Element/aperture response:** gain, directivity, phase center, polarization and frequency response.
- **Array/aperture distribution:** geometry, illumination, amplitude taper, phase distribution, subarrays and aperture dimensions.
- **Gain and beamwidth:** main-lobe gain, azimuth/elevation beamwidth, aperture efficiency and scan loss.
- **Sidelobes and backlobes:** sidelobe structure, grating lobes, spillover and back radiation, with interference implications.
- **Nulls and pattern shaping:** commanded/adaptive nulls, tapering, weighting and their physical/processing trade-offs.
- **Coupling and calibration:** simplified or detailed element interaction models, with fidelity clearly stated.
- **Faults and degradation:** damaged reflector, blocked/deformed slots, failed elements, feed faults, phase/amplitude drift and alignment errors.

## Runtime separation
Antenna evaluation returns directional transmit/receive response for a specified frequency, polarization, direction and equipment state. It does not choose the scan direction or declare a detection. Beam control (folder 06) schedules pointing and dwell. Propagation and target scattering (physics/radar) determine the path and target response. Receiver, processing, detection and tracking remain separate stages.

## Data and validation
The first versioned aperture data contract is docs/radar/schemas/antenna-aperture.schema.json; schema-valid synthetic examples are in docs/radar/examples/antenna-apertures.example.json. Example numbers are schema fixtures, not real-world equipment specifications.

Test at least:
- Frequency-dependent gain/beamwidth and aperture efficiency behavior.
- Main-lobe, sidelobe and backlobe patterns against analytic limits or sourced/measured tables.
- Dish feed taper, blockage and surface-error effects.
- Slotted-array slot count, layout, feed topology, phase progression and slot/feed faults.
- Mechanical pointing errors separately from the aperture's intrinsic pattern.
- Pattern symmetry, normalization, polarization and coordinate-frame conversions.
- Performance and determinism for repeated pattern evaluations.

The pattern must affect simulated received signal strength and interference; it cannot be only a visual effect. Do not claim full-wave electromagnetic accuracy without a validated numerical solver.
