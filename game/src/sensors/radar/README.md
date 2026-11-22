# Radar simulation source area

**Status: folder scaffold and README only for this task. No radar runtime code was added or retained from this task.**

This directory is reserved for the future executable radar equipment and processing implementation. The requirements and architecture authority is [docs/radar](../../../../docs/radar/README.md); the top-level equipment ownership map is [sensors/Radar](../../../../sensors/Radar/README.md); shared world/physics requirements are [physics/radar](../../../../physics/radar/README.md).

## Intended module boundaries

| Planned module area | Responsibility |
|---|---|
| equipment profiles | Exact radar hardware/software variant, fitted modes, limits, installation interfaces and evidence |
| waveform and timing | Pulse families, PRF/PRI, pulse width, modulation, bandwidth, coherent intervals and ambiguity |
| RF hardware | Exciter, transmitter, receiver, power, cooling, warm-up, calibration, BIT and failures |
| antenna and beam control | Aperture, element/subarray structure, antenna pattern, steering, scan, dwell, revisit and scheduling |
| signal processing | I/Q samples, filtering, matched processing, pulse compression, Doppler, integration and clutter rejection |
| detection | Noise/interference estimates, CFAR family, thresholds, Pd/Pfa assumptions and uncertain measurement reports |
| tracking | Measurement association, track initiation, filtering, uncertainty, coast, merge/split and deletion |
| integration | RWR/ESM, datalink, IFF, sensor fusion, aircraft systems, cockpit displays and diagnostics |

## Required architectural behavior

- Mechanical, PESA and AESA architectures must have genuinely distinct hardware and resource constraints.
- A radar must not know perfect campaign/world entity state. It receives physical returns and produces uncertain measurements.
- Transmit power, receive sensitivity, aperture, waveform, scan geometry, resource limits, noise, clutter, interference and target aspect must affect the result.
- AESA capacity must be finite: T/R-module count/health, subarray topology, channels, phase/amplitude control, thermal limits, power and task scheduling all matter.
- RWR observations remain passive measurements. Do not fabricate emitter range or identity from hidden world state.
- Use shared physics interfaces while keeping aircraft/radar-specific data and software variants separate.
- All values require source provenance, units, variant applicability and uncertainty; synthetic test values must be labelled.

## Suggested implementation order

1. Radar equipment profile and units/coordinate contracts.
2. Shared RF path and target-scattering interfaces.
3. Waveform timing and hardware resource lifecycle.
4. Antenna/aperture/beam-control models.
5. Receiver noise/interference and sample representation.
6. Range/Doppler processing and detector.
7. Measurement/track lifecycle.
8. Terrain/weather/clutter integration.
9. ESM/RWR, fusion, datalink and cockpit presentation.
10. Aircraft-specific radar profiles and validation.

This document is a design guide. It does not claim any of these systems are implemented, tested or aircraft-calibrated.
