# Radar Simulation Documentation

This directory defines the planned radar-simulation domain for Iron-Front. It is documentation and organization only; none of the described systems are implemented by these files.

## Goals and principles

- Model the complete chain from RF generation through antenna, propagation, target scattering, reception, processing, detection, tracking and display.
- Make radar architectures genuinely different. Mechanical, pulse, pulse-Doppler, PESA and AESA systems must not be identical systems with different statistics.
- Keep platform-specific equipment, limitations, controls and variants distinct while reusing well-defined shared simulation services.
- Treat detections and tracks as uncertain estimates, not guaranteed knowledge.
- Use SI units internally and document coordinate frames, assumptions and sign conventions.
- Clearly label public facts, estimates, synthetic values and gameplay tuning.
- Use approximations where browser performance requires them; document their limitations rather than claiming full electromagnetic accuracy.
- The radar laboratory must use the same underlying radar modules as the game.

## Signal-chain overview

1. Radar configuration selects installed equipment and capabilities.
2. RF hardware and waveform systems generate a timed signal.
3. Antenna and beam-control systems determine directional transmit/receive response.
4. Propagation models the path through the environment.
5. Target interaction models scattering and the returned signal.
6. Receiver hardware conditions received energy.
7. Signal processing extracts range, Doppler, angle and signal-quality information.
8. Detection logic applies thresholds and produces uncertain measurement reports.
9. Tracking logic associates reports over time and estimates target state.
10. Modes, displays and integration systems schedule and present information.

## Architecture classification axes

Do not represent a radar with one mutually exclusive "type" field. At minimum, keep these related but independent:
- Waveform/processing family: pulse, pulse-Doppler, CW/FMCW, coherent/non-coherent processing.
- RF/beamforming architecture: mechanically scanned, PESA, AESA, hybrid or equipment-specific.
- Physical aperture construction: parabolic reflector dish, flat slotted-waveguide planar array, horn, phased planar array, conformal array, reflectarray or documented specialized aperture.
- Scan/steering mechanism: fixed, mechanically moved, electronically steered or hybrid.
- Channels and tasks: actual transmit/receive channels, beam scheduling, dwell/revisit and supported simultaneous tasks.

A parabolic dish is a curved reflector with a feed; a flat slotted-waveguide planar array is a flat slot-radiating aperture with a waveguide feed network. Neither construction alone identifies the waveform or establishes AESA/PESA electronics. A mechanically scanned radar can use either aperture when its installation supports it. A conventional fixed-feed slotted array is not automatically electronically steered.

The versioned aperture-data schema is docs/radar/schemas/antenna-aperture.schema.json; its synthetic examples are docs/radar/examples/antenna-apertures.example.json. They define data shape only, not implemented antenna physics.

## Folder guide

| Folder | Responsibility |
|---|---|
| 01-system-architecture | Boundaries, lifecycle, timing, data flow and interfaces |
| 02-radar-types-and-architectures | Mechanical, pulse, pulse-Doppler, PESA, AESA and specialized sets |
| 03-rf-hardware | Exciters, transmitters, power, receiver hardware dependencies, cooling, calibration |
| 04-waveforms-and-timing | Frequency, pulse shape, PRF/PRI, pulse compression and scheduling |
| 05-antennas-and-beamforming | Apertures, element patterns, gain, polarization, sidelobes and beamforming |
| 06-scanning-and-beam-control | Scan patterns, steering, dwell, revisit and resource scheduling |
| 07-propagation-and-environment | Atmosphere, terrain masking, multipath, weather and propagation loss |
| 08-target-interaction-and-rcs | Aspect-dependent scattering, RCS, target fluctuation and return formation |
| 09-receiver-and-rf-front-end | Reception, filtering, gain, noise, dynamic range and digitization |
| 10-signal-processing | Matched filtering, Doppler, integration, ambiguity and clutter processing |
| 11-detection-and-thresholding | Pd/Pfa, CFAR, thresholds and measurement reports |
| 12-tracking-and-track-management | Association, filtering, track lifecycle and uncertainty |
| 13-operating-modes | Search, track, track-while-scan, mapping and mode behavior |
| 14-electronic-attack-and-protection | Jamming, deception, ECCM, interference and emission control |
| 15-multisensor-and-network-integration | Datalinks, cooperative sensing, fusion, IFF inputs and track exchange |
| 16-cockpit-displays-and-human-interface | Radar scopes, symbology, controls, warnings and operator workload |
| 17-damage-degradation-and-maintenance | Faults, calibration drift, thermal limits, battle damage and repair |
| 18-validation-and-performance | Verification, reference cases, numerical tests and browser budgets |
| 19-radar-lab-and-visualization | Shared simulation laboratory, diagnostics and visualizations |
| 20-aircraft-integration-and-data | Aircraft-specific equipment definitions, variants, installation and sources |

## Additional AESA and advanced radar requirements

AESA must not be modeled as an unlimited number of perfect simultaneous beams. Represent a finite array of T/R modules or subarrays, element/subarray calibration, phase/amplitude quantization where appropriate, module power and thermal state, failed elements, sidelobe/grating-lobe behavior, beam scheduling, dwell allocation, resource contention and task priority. Track hardware duty cycle and cooling/power demand. PESA, mechanically scanned and electronically scanned systems must retain their distinct hardware and timing constraints.

Signal processing should expose intermediate quantities for validation: waveform bandwidth/coherence, matched-filter output, range/Doppler cells, clutter/noise estimates, CFAR threshold, detection statistic, angle estimate, ambiguity state and measurement uncertainty. Do not expose a perfect contact merely because the campaign knows an entity exists.

## Separation of responsibilities

- Antenna pattern describes directional gain; beam control decides where and when the antenna points.
- Propagation describes the path through the environment; target interaction describes scattering from the object.
- Receiver produces conditioned samples; signal processing analyzes them.
- Detection creates measurement reports; tracking maintains estimates over time.
- Operating modes schedule capabilities but must not bypass the signal chain.
- Displays present system outputs and must not create detections.
- Electronic warfare changes the signal environment through defined interfaces, not arbitrary range multipliers.
- IRST is a separate passive infrared sensor; radar may cue it, but cannot guarantee an IRST detection.

## Status

Every folder and explanation here is a planning reference. It does not indicate that the corresponding simulation is implemented or validated.
