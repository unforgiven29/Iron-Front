# Radar source structure

**Status: documentation and folder scaffold only for the radar work requested here. No radar runtime code was added by this task.**

This is the equipment-side organization guide. It defines future code/data ownership for radar sets and their processing chain. The [radar documentation](../../docs/radar/README.md) is the requirements authority; [shared radar physics](../../physics/radar/README.md) owns reusable propagation, geometry, scattering and clutter requirements.

## Ownership

- `sensors/Radar/` owns radar equipment and radar-specific processing: architecture, hardware state, waveform control, antenna/beam control, receiver, processing, detection, tracking, modes and radar-facing integration.
- `physics/radar/` owns reusable world/physics models: geometry, propagation, terrain masking, target scattering/RCS and clutter.
- Aircraft definitions select the exact radar set, variant, software baseline, installation and capabilities. They must not duplicate the radar engine or put platform-specific values in global defaults.
- Cockpit displays and controls present real radar state; they never fabricate contacts.
- The radar lab uses the same production modules and data as gameplay once those modules are implemented.

## Folder map

| Folder | Responsibility |
|---|---|
| core | Composition, configuration, lifecycle, scheduling and interfaces |
| architectures | Mechanical, pulse, pulse-Doppler, CW/FMCW, PESA, AESA and multichannel families |
| rf-hardware | Exciter, transmitter, receiver, power, cooling, warm-up and BIT |
| waveforms | Pulse definitions, modulation, PRF/PRI, bandwidth and CPI |
| antennas | Reflectors, slotted waveguides, planar arrays, conformal apertures and patterns |
| beam-control | Search patterns, steering, dwell, revisit and task scheduling |
| receiver | Front-end, filtering, noise, compression, digitization and calibration |
| processing | Pulse compression, Doppler, integration, ambiguity and clutter suppression |
| detection | Thresholding, CFAR, Pd/Pfa and measurement reports |
| tracking | Association, state estimation, uncertainty and track lifecycle |
| modes | Search, track, TWS, mapping and equipment-specific modes |
| electronic-attack | Jamming, deception, ECCM and emission control |
| integration | Datalink, IFF, sensor fusion, cockpit and aircraft interfaces |
| validation | Signal, detector, scenario, platform and performance validation |

This README is a structure/ownership guide only. A folder or README must never be reported as an implemented radar capability.
