# Radar Source Structure

**Status: documentation and empty placeholders only. No radar algorithms or gameplay code have been implemented here.**

Read [the subsystem reference](../../docs/radar/README.md), [Claude's implementation brief](../../docs/radar/CLAUDE_IMPLEMENTATION_GUIDE.md), and [shared radar physics](../../physics/radar/README.md).

## Ownership
- `sensors/Radar/` owns radar equipment and radar-specific processing: architecture, hardware state, waveform control, antenna/beam control, receiver, processing, detection, tracking, modes and radar-facing integration.
- `physics/radar/` owns reusable world/physics models: geometry, propagation, terrain masking, target scattering/RCS and clutter.
- Aircraft definitions select the exact radar set, variant, software baseline, installation and capabilities. They must not duplicate the radar engine or put platform-specific values in global defaults.
- Cockpit displays and controls real radar state; they never fabricate contacts.
- The radar lab uses the same production modules and data as gameplay.

## Folder map
| Folder | Responsibility |
|---|---|
| core | Composition, configuration, lifecycle, scheduling and interfaces |
| architectures | Mechanical, pulse, pulse-Doppler, CW/FMCW, PESA, AESA and multichannel families |
| rf-hardware | Exciter, transmitter, power, cooling, calibration and hardware health |
| waveforms | Pulse shapes, PRF/PRI, timing, compression and frequency agility |
| antenna | Aperture geometry, element/array models, gain patterns, sidelobes, nulls and polarization |
| beam-control | Scan patterns, steering, dwell/revisit and resource scheduling |
| receiver | RF front end, filtering, amplification, conversion, digitization and noise |
| signal-processing | Matched filtering, range/Doppler, integration, clutter, angle and ambiguity |
| detection | Thresholds, CFAR, Pd/Pfa and measurement reports |
| tracking | Initiation, association, state estimation, track lifecycle and uncertainty |
| modes | Equipment-supported search, track, TWS, mapping and emission control |
| electronic-warfare | Interference, jamming effects in the signal chain and ECCM |
| integration | Datalink, sensor fusion, IFF and navigation inputs |
| cockpit | Displays, symbology, controls and alerts |
| health | Built-in test, faults, degradation and maintenance |
| diagnostics | Telemetry, performance and deterministic replay |
| data | Radar definitions, variants, capability records and sources |
| lab | Controlled scenarios and visualizations using production modules |

## Causal signal flow
`mode/task → scheduler → waveform/transmitter → antenna pattern → outbound propagation → target scattering → return propagation → receiver → signal processing → detection → tracking → cockpit/datalink`

Optimizations may combine computational stages but must preserve causal dependencies. Modes schedule/configure capabilities; they do not bypass the chain.

## Different architectures must be different systems
- Mechanical scan: physical movement, inertia, drive limits, stabilization and scan timing.
- Pulse: discrete transmit/receive timing, echo delay and pulse/receiver constraints.
- Pulse-Doppler: coherence, Doppler processing, clutter rejection and range/velocity ambiguity.
- CW/FMCW: continuous transmission, leakage/isolation and beat-frequency processing.
- PESA: phase-controlled aperture with shared high-power transmitter architecture.
- AESA: distributed T/R modules, element/subarray behavior, calibration, failed modules, power/thermal limits and finite task scheduling.
- Multichannel/hybrid: only the apertures, channels and simultaneous tasks supported by that specific set.

Do not make one generic radar with different range/accuracy/refresh-rate numbers. Architecture labels do not grant capabilities automatically; configuration must be specific to radar designation, variant and software baseline.

## Non-negotiable separations
- Antenna pattern is directional response; beam control chooses pointing and timing.
- Propagation describes the path; target scattering describes the object response.
- Receiver creates conditioned samples; processing analyzes them.
- Detection creates uncertain measurements; tracking estimates state over time.
- IFF/classification is not physical detection.
- Remote/fused tracks are not onboard detections; preserve source, age and uncertainty.
- Jamming enters the signal environment; it is not a universal range multiplier.
- Damage affects the relevant component, not arbitrary unrelated systems.
- Game-world truth must never be passed to radar as a perfect contact list.

## Engineering conventions
Use SI units internally; explicit coordinate frames, angle conventions and simulation timestamps; separate world truth from measurements/tracks; keep configuration separate from runtime state; prefer typed input/output contracts; use seeded randomness for reproducible noise/fluctuation tests. Use event-driven pulse timing and appropriate update rates rather than recalculating everything every render frame. Make fidelity tiers and approximation limits explicit. Profile desktop and mobile browsers.

## Expected contracts (design guidance, not code)
Hardware reports readiness, limits, health, power and thermal state. Waveforms describe frequency, bandwidth, pulse timing/shape and coherence. Antenna evaluation returns directional gain/polarization. Beam scheduling allocates time-bounded pointing/dwell tasks. Physics returns path effects and target scattering. Receiver returns conditioned samples. Processing returns observables and quality/ambiguity data. Detection returns timestamped measurements with uncertainty. Tracking returns estimated state, uncertainty, provenance and lifecycle.

Do not use a single `radarRange` threshold, unlimited AESA beams, visual meshes as detection logic, invented classified values, or copied radar implementations per aircraft. These folders are planned boundaries, not a demand to implement everything immediately.
