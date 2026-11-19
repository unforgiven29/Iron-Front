# Claude Implementation Guide — Radar Systems

This is the engineering brief for implementing Iron-Front's radar simulation incrementally. It is not a request to fill every folder immediately. The source folders are placeholders; do not assume radar code already exists there.

## 1. Audit before changing anything
Inspect the full repository, current language/framework, build scripts, GitHub Pages deployment configuration, existing radar/sensor code, physics utilities and tests. Search for existing implementations before creating replacements. Reuse or deliberately replace them; never create a second radar engine alongside an existing one. Preserve unrelated game behavior. Do not migrate frameworks or build systems without explaining why.

## 2. Source-of-truth locations
- Radar equipment and processing: `sensors/Radar/`
- Shared geometry, propagation, scattering and clutter: `physics/radar/`
- Requirements: `docs/radar/`
- Aircraft-specific fit/variant/cockpit configuration: inspect and use the project's existing aircraft data area.
- Rendering/debug views: existing graphics area. Rendering consumes simulation outputs and never decides physical outcomes.
Never duplicate a physical model across the sensor and physics layers.

## 3. Shared framework, aircraft-specific equipment
Use common contracts, timing and reusable services, but configure each aircraft with its actual radar equipment, variant, software baseline, installation, modes, limitations, power/cooling needs and controls. Share algorithms only where the physical mechanism is genuinely shared. Do not copy the whole engine for every aircraft, and do not reduce all radars to one generic model with different statistics.

## 4. Preserve the causal signal chain
`mode/task → scheduler → waveform/transmitter → antenna pattern → outbound propagation → target scattering → return propagation → receiver → processing → detection → tracking → display/datalink`
Optimizations may combine stages but must preserve causality and expose intermediate values in tests/lab.
- No power/ready transmitter means no valid pulse.
- Antenna pointing and sidelobes affect illumination/reception.
- Terrain/propagation can block or attenuate a path.
- Target aspect/configuration can change scattering.
- Receiver noise, saturation or failed channels degrade samples.
- Processing cannot recover information never captured.
- Thresholds control misses/false alarms.
- Missed updates make tracks coast/degrade; never secretly update from world truth.

## 5. Architecture-specific behavior
Mechanical scan uses physical movement, inertia, drive limits and scan timing. Pulse uses discrete pulses and echo delay. Pulse-Doppler requires coherence, Doppler processing, clutter rejection and ambiguity handling. CW/FMCW uses continuous transmission, leakage/isolation and beat-frequency processing. PESA models phase control and its transmitter arrangement. AESA models distributed T/R modules, element/subarray control, calibration, module failures, thermal/power limits and finite scheduling. Multichannel/hybrid sets only expose documented channels/tasks. Do not assume every AESA has unlimited simultaneous beams or every advanced mode.

## 6. Authentic aircraft data
For each radar fit, record designation, aircraft variant/block, software baseline, architecture, antenna installation, modes, waveform options, known hardware limits, power/cooling, cockpit controls, startup/BIT behavior and source references. Do not silently transfer capabilities between variants. Mark unknown, estimated, disputed and synthetic/gameplay values explicitly. Never invent precise classified values and present them as fact.

## 7. Data contracts
Use SI units; define coordinate frames, handedness, axes and angle conventions. Distinguish slant range/ground range, bearing/heading and radial velocity/total speed. Use simulation timestamps. Keep world truth separate from detections and tracks. Measurement reports include timestamp, values, uncertainty/quality and source. Tracks include estimate, uncertainty, age, provenance and lifecycle. Remote/fused tracks remain distinguishable from onboard detections. Separate static configuration from mutable runtime state; avoid undocumented global state.

## 8. Detection is statistical
A distance threshold is not a radar model. Build toward signal/noise/interference conditions, clutter statistics, Pd/Pfa under stated assumptions, CFAR or another documented detector, target fluctuation, false alarms, missed detections and track initiation/association/coasting/deletion. Do not expose perfect identity just because the game engine knows the entity type.

## 9. Electronic warfare
Jamming enters the signal environment and receiver/processing chain. Account for geometry, frequency overlap, bandwidth, power, antenna response, timing and processing assumptions. ECCM has trade-offs and limitations. Avoid a fixed percentage reduction to radar range.

## 10. Browser performance
The game is intended for browser/GitHub Pages. Keep core single-player simulation client-side. Use workers for expensive independent work where useful; keep rendering responsive. Use event-driven pulse timing, suitable subsystem update rates, spatial indexes, cached terrain queries, pooling and typed buffers when measured benefits justify them. Do not silently change detection meaning to meet frame rate. Use deterministic seeds for tests/replay. Profile desktop and mobile. Respect the project's actual Pages base path.

## 11. Tests and validation
For each implemented stage add unit tests for equations/units/frames, deterministic end-to-end scenarios, regression cases, boundary/failure tests and performance measurements. Statistical models need statistical tests for Pd/Pfa under declared assumptions. Test power loss, thermal limits, channel failures, misses, false alarms, maneuvers and track uncertainty. A convincing beam mesh or scope is not proof; validate numeric intermediate outputs.

## 12. Radar laboratory
The lab must instantiate the same production modules, equipment data, physics and processing as gameplay. It may add controls, logging, replay and visualization, but never separate detection rules. Visualize antenna patterns/sidelobes, beam direction, scan schedule, waveform timing, propagation, received signal/noise/clutter, range-Doppler, CFAR, detections, track uncertainty and performance.

## 13. Recommended implementation sequence
1. Repository audit and architecture proposal.
2. Units, frames, simulation time, data contracts and deterministic random source.
3. Hardware readiness/lifecycle and event scheduler.
4. One simple mechanically scanned pulse radar end-to-end.
5. Receiver, processing, noise and explicit thresholds.
6. Measurement reports and uncertain track lifecycle.
7. Pulse-Doppler, clutter and ambiguity.
8. PESA/AESA architecture, scheduling and hardware health.
9. Terrain/environment, target fluctuation and electronic attack.
10. Aircraft variants, cockpit, datalink/fusion and radar lab.
11. Validation and browser optimization.

At every stage state what works, what is approximate, what was tested and what is unsupported.

## 14. Definition of done
A folder/class/visual is not a completed subsystem. Completion requires a documented responsibility and input/output contract, correct dependencies, units/frames/timing assumptions, normal/boundary/degraded/failure tests, diagnostics, browser-appropriate performance and explicit limitations/source provenance.
