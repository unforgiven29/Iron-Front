# Radar antenna aperture models

**Status: configuration contract and model requirements only. No antenna-pattern solver is implemented here.**

This folder owns antenna/aperture construction, element response and directional transmit/receive patterns. It does not own RF propagation, target scattering, beam scheduling, receiver processing or detection.

## Independent classification

Keep these dimensions separate in data:
- Aperture construction: parabolic reflector dish, flat slotted-waveguide planar array, horn, phased planar array, conformal array, reflectarray or another documented design.
- Steering: fixed, mechanical, electronic, hybrid or unknown.
- RF/beamforming electronics: mechanical feed/drive, PESA, AESA or a documented equipment-specific architecture.
- Waveform and processing: pulse, pulse-Doppler, CW/FMCW and their actual processing capabilities.

Aperture shape does not prove the electronics architecture. In particular, a planar slot array is not automatically an AESA and a reflector dish does not dictate the waveform.

## Parabolic reflector dish

The model should accept reflector diameter/focal geometry, feed type and location, aperture efficiency, illumination taper, blockage, surface accuracy, polarization and frequency. Pattern evaluation should account for the feed's illumination/phase distribution and reflector errors at the selected fidelity tier. A simplified circular-aperture pattern is acceptable only when its assumptions are declared.

## Flat slotted-waveguide planar array

The model should accept aperture width/height, slot positions/orientations/count, row and column layout, feed-network topology, slot coupling/element response and the resulting amplitude/phase distribution. A conventional fixed-feed implementation may have a fixed or frequency-sensitive beam. Model electronic phase steering only when supported by that exact feed/phase-control architecture. Slot and feed faults must affect the aperture pattern locally rather than disabling unrelated radar functions without cause.

## Shared output contract requirements

Pattern evaluation should be deterministic for fixed configuration/state and return enough information for the next stages to use:
- Directional transmit/receive gain or normalized response.
- Frequency and polarization validity.
- Main-lobe/sidelobe/backlobe response and pointing offset where modeled.
- Aperture/element health effects and validity/quality flags.
- Declared approximation tier and applicable frequency/scan envelope.

The caller supplies direction and operating conditions. Beam-control owns pointing/dwell; propagation owns path loss; target-scattering owns target response. The antenna model never creates detections.

## Schema and examples

The versioned configuration contract is docs/radar/schemas/antenna-aperture.schema.json. Synthetic shape-only examples are in docs/radar/examples/antenna-apertures.example.json. Never copy their numeric values into a real aircraft/radar fit. Real equipment records require exact equipment applicability, source provenance, units, uncertainty and review.
