# RWR / ESM Simulation Architecture

**Status: specification and source structure only. This document does not claim that an RWR runtime is implemented.**

Iron-Front's Radar Warning Receiver (RWR) is a passive electronic-support sensor. It detects and characterizes RF energy emitted by other systems, then builds uncertain emitter observations and threat assessments. It does not detect radar echoes, see campaign entities, or receive a perfect list of enemy radars.

Read [the RWR implementation guide](CLAUDE_IMPLEMENTATION_GUIDE.md), [shared sensor architecture](../../docs/sensors/README.md), [radar architecture](../../docs/radar/README.md), and [integrated simulation](../../docs/integrated-simulation/README.md).

## Ownership

- `sensors/RWR/` owns the shared dynamic RWR runtime, generic antenna/receiver processing, channelization, measurements, deinterleaving, emitter association, classification, emitter tracks, threat evaluation, shared interfaces, diagnostics and validation. It does not own aircraft-specific equipment profiles or installations.
- `physics/radar/` and its shared propagation/emission environment own world-space RF propagation and radar-emitter signal representation. Extend existing ownership; do not create a second propagation engine.
- Radar equipment publishes time-bounded emissions from its actual transmitter, waveform, antenna pattern, beam schedule, power state and mode. RWR never queries a radar's private state or target list.
- Aircraft modules select the exact RWR fit, antennas, apertures, software/library baseline, installation, controls, power/cooling and cockpit mapping.
- Avionics and cockpit present RWR reports; they do not create or upgrade detections.

## The RWR is not a radar

A radar usually detects energy returned from an illuminated target. An RWR intercepts energy emitted by a radar or other RF source. It can often receive a direct-path signal without the radar illuminating the RWR-carrying aircraft as a target. Therefore:

- Do not use the radar's target-detection result as the RWR input.
- Do not apply the radar monostatic two-way range equation to the RWR interception path. A simplified direct-path received-power model has a different path-loss relationship; include transmitter EIRP, propagation, receiver antenna gain/pattern, polarization, frequency response and receiver losses/noise.
- A radar may be emitting while not tracking the player; a track/lock cue requires evidence in the received emission behavior and the emitter's observable mode, not hidden radar state.
- A silent, receive-only, powered-down, damaged or non-emitting radar cannot be detected by RF interception merely because it exists in the world.
- A detected emitter is not automatically identified, hostile, tracking the player or launching a weapon.

## End-to-end processing chain

`emitter operating state → actual RF emission event/field → propagation to receiver → aircraft antenna/aperture response → RF front end → channelization/measurement → pulse descriptor extraction → deinterleaving → emitter association → library comparison/classification → emitter track → threat evaluation → cockpit symbology/audio`

Each stage has explicit inputs, outputs, timing, uncertainty and failure states. Optimizations may combine calculations but may not skip causal stages.

## Folder responsibilities

| Folder | Responsibility |
|---|---|
| `architectures/` | RWR receiver/antenna architectures and equipment-specific capabilities |
| `antennas/` | Aperture installation, frequency response, direction finding and calibration |
| `receiver/` | RF front end, sensitivity, bandwidth, noise, filtering, gain and dynamic range |
| `channelization/` | Frequency coverage, channel banks, instantaneous bandwidth and scan dwell |
| `measurements/` | Pulse/event measurements, frequency, amplitude, timing, width and quality |
| `pulse-descriptors/` | Pulse descriptor words/records and measurement uncertainty |
| `deinterleaving/` | Separate overlapping pulse trains and emitter candidates |
| `emitter-association/` | Associate observations over time without premature identity claims |
| `classification/` | Library matching, confidence, ambiguity and unknown emitters |
| `tracking/` | Emitter tracks, bearing history, covariance, coast and lifecycle |
| `threat-evaluation/` | Threat ranking and warning logic from evidence and configured doctrine |
| `cockpit/` | Aircraft-specific display, audio, controls, modes and annunciation |
| `health/` | BIT, calibration, antenna/receiver faults, damage and degradation |
| `data/` | Shared generic definitions and source/uncertainty records; equipment-specific profiles live with each platform |
| `integration/` | Radar emission interface, EW, avionics, datalink and aircraft resource adapters |
| `diagnostics/` | Replay, pulse/event inspection, confidence and error budgets |
| `lab/` | Controlled RWR scenarios using the production processing chain |
| `validation/` | Reference cases, test vectors, metrics and performance budgets |

## Physical and equipment model

### Emission and propagation

Represent an emitter as a time-varying source, not a static radar icon. Its observable emission depends on transmitter state, waveform, carrier/frequency agility, pulse timing, antenna gain toward the receiver, scan/beam pointing, duty cycle, operating mode and equipment faults. A radar that changes mode changes the emitted signal sequence.

The shared RF environment evaluates the path from emitter to receiver: distance, free-space spreading, antenna gains, polarization mismatch, terrain obstruction, Earth curvature where relevant, atmospheric effects appropriate to the band, multipath/reflection where justified, and any modeled interference. The RWR receives only what survives that path and its own hardware limits.

Do not pretend a browser simulation is a full-wave Maxwell solver. Use a documented hierarchy: analytical link-budget/path-loss baseline; frequency- and geometry-aware antenna patterns; terrain/line-of-sight and selected multipath effects; optional higher-cost propagation in bounded test scenes. State the validity limits of every approximation.

### Antenna and direction finding

RWR installations differ. Model the aircraft's actual number and placement of apertures, azimuth/elevation coverage, frequency-dependent gain/sensitivity, polarization, pattern nulls, airframe shadowing, installation loss, cable/combiner paths, calibration and damage. Never grant perfect 360-degree coverage unless the fitted antenna system supports it.

Support direction-finding methods only where the selected equipment architecture supports them. Possible model families include amplitude-comparison sectors, phase/interferometric baselines and time/scan-based methods. They have different observables, calibration needs, ambiguity behavior, angular errors and coverage. Do not give every RWR a perfect bearing sensor.

Bearing output is a measurement with error, not the emitter's exact world bearing. Include quantization, noise, calibration bias, installation error, multipath, low SNR, sidelobe reception, ambiguous sectors and transient uncertainty. Preserve body/world frame transforms and ownship attitude.

### Receiver and channelizer

Model receiver characteristics that materially affect interception:
- Tuned frequency coverage and gaps; instantaneous bandwidth versus swept/channelized coverage.
- Sensitivity/noise floor, noise figure or an equivalent calibrated receiver-noise model.
- Selectivity, filter bandwidth, channel overlap, scan dwell and revisit delay.
- Gain stages, compression/saturation, dynamic range, blocking/desensitization and recovery.
- Frequency measurement error, time-tag error, amplitude measurement error and pulse-width resolution.
- Intermodulation/false responses and adjacent-channel interference at an appropriate fidelity tier.
- Temperature, supply voltage, cooling, component aging, calibration drift and damage.

A broadband receiver is not automatically unlimited. Strong nearby emitters can mask weak signals; simultaneous signals may compete for finite channels and processing. The receiver must sometimes miss, merge, mismeasure or saturate.

### Pulse descriptor extraction and deinterleaving

Create timestamped pulse descriptor records from received events/samples. Fields may include measured RF/frequency band, time of arrival, pulse duration, amplitude, angle/bearing measurement, modulation/within-pulse features when supported, quality flags and uncertainty. Do not treat every emitter as a perfectly stable fixed-frequency fixed-PRI source.

Support realistic variation: jitter, staggered/variable PRI, frequency agility, pulse-width variation, scan modulation, missing pulses, overlapping emitters, low-SNR measurements, receiver dead time and false pulses. Deinterleaving groups observations probabilistically using multiple features and temporal consistency. It must handle ambiguous and crossing pulse trains rather than assigning every pulse to the nearest known radar.

### Emitter identification and library

An emitter library is a set of observable signal-characteristic distributions and known limitations—not a magic ID lookup. Compare measured features to candidate signatures using likelihood/confidence and account for:
- Incomplete or outdated library entries.
- Similar or shared waveform families.
- Software/variant differences and unknown operating modes.
- Measurement uncertainty and receiver bias.
- Partial/intermittent observations.
- Novel, modified, deceptive or intentionally ambiguous emitters.

Output candidates, confidence, supporting observations and unresolved ambiguity. Unknown emitter is a valid result. Identification confidence must be separate from hostility and threat priority. Never invent classified signature values; use public, estimated or synthetic records explicitly labelled with provenance and uncertainty.

### Emitter tracking and threat evaluation

Maintain emitter tracks from successive bearing/parameter observations. Track state should include bearing estimate, covariance/uncertainty, measured parameter history, source sensor, first/last observation, age, confidence, candidate identities and lifecycle. Use angle-aware filtering and handle ownship motion, wraparound, missed detections, multiple emitters at similar bearings and track splits/merges.

A single bearing does not provide range. Do not silently manufacture range or a precise map location. Range/location may only be estimated through a separately modeled method (for example, multi-platform triangulation or a documented ownship-motion/bearing-only estimator), with its own geometry, observability and uncertainty.

Threat evaluation is a separate layer. It may use emitter class confidence, observed mode/behavior, bearing, recency, repetition, known platform fit and configured mission doctrine. It must not promote an uncertain emitter ID into a certain launch warning. A tracking/illumination warning requires the RWR to observe evidence consistent with that behavior. A missile launch warning requires a separately justified observable cue or another fitted sensor/system; do not infer launch solely from a generic radar detection.

## Cross-system coupling

- Radar transmitter state, waveform, scan schedule and antenna pattern publish actual emissions into the shared RF environment.
- RWR observations are affected by ownship orientation, speed, installation, antenna damage, receiver health, electrical supply and cooling.
- Jammers and other emitters add signals to the environment. Their effects emerge through receiver bandwidth, dynamic range, filtering and processing; never use a generic RWR-range penalty.
- RWR detects only emissions it can receive. A radar in receive-only/passive mode or a silent sensor may be invisible to RWR.
- A radar may be detected by RWR even when it has no target track on the player.
- Radar mode changes can alter observable pulse/scan behavior, but the RWR must infer the mode from measurements and may be wrong.
- Datalinked ESM reports remain remote reports with source, age, uncertainty and coordinate provenance; they are not local RWR detections.
- Cockpit audio and symbols depend on equipment state, selected display/mode, warning logic and real report quality.
- Power/cooling failure, antenna damage, cable faults, calibration drift or software faults degrade only affected channels/functions according to the installed architecture.

## Accuracy, uncertainty and fidelity tiers

The project target is a highly detailed, testable RWR simulation. "More accurate than DCS" is a comparative claim that cannot be established by documentation or feature count. Do not claim it until a repeatable benchmark suite, public/reference data, documented equipment baselines and side-by-side measured results support it.

Use explicit fidelity tiers:
1. **Baseline:** direct-path RF link budget, fitted antenna coverage, receiver sensitivity/bandwidth, pulse timing/frequency/amplitude measurements, bearing uncertainty, simple emitter association and unknown classifications.
2. **Detailed:** frequency-dependent antenna patterns, installation shadowing, channel scan/revisit, dynamic range/blocking, pulse descriptor extraction, PRI/frequency variation, deinterleaving, scan-pattern observations, probabilistic classification and emitter tracks.
3. **Advanced bounded scenarios:** multipath and terrain edge cases, correlated measurement errors, multiple simultaneous emitters, detailed receiver nonlinearity, array/phase DF where supported, calibration drift, hardware aging, deceptive/interfering signals and high-fidelity replay.

Every equipment definition states which tier is active and which features are approximated or absent. Do not silently simulate unsupported capabilities.

## Performance strategy

Use event-driven emission/pulse scheduling rather than per-frame loops over every emitter-pulse pair. Spatially index emitters and receivers, cull physically irrelevant paths conservatively, cache static terrain/antenna data, and allocate expensive propagation/processing according to receiver bandwidth, scan state and scenario importance. Preserve deterministic seeds and replayable event ordering. Profile dense emitter scenes on desktop and mobile browsers.

## Validation requirements

- Link-budget sweeps versus range, frequency, transmitter EIRP, antenna gain, polarization and receiver sensitivity.
- Correct direct-path path-loss scaling; explicitly prove the RWR does not use radar echo two-way range logic.
- Antenna pattern/sector coverage, nulls, installation shadowing and angular error.
- Receiver sensitivity, channel gaps, scan dwell/revisit, saturation, blocking and recovery.
- Pulse timestamp/frequency/width measurement error under controlled SNR.
- Deinterleaving of jittered, staggered, agile, overlapping and partially missing pulse trains.
- Unknown and ambiguous emitter classification; confidence calibration and library versioning.
- Bearing-only track behavior, ownship maneuver effects, covariance growth and track coast.
- Multiple emitters, similar bearings, false pulses, multipath and intermittent reception.
- Silent radar, receive-only mode, radar transmitting away from aircraft, and radar detecting another target without tracking the player.
- Electrical/cooling/antenna/receiver damage and calibration faults.
- Jamming/interference effects through the signal chain.
- Datalink age/uncertainty preservation and no conversion to local detection.
- Deterministic replay, timestep sensitivity and browser performance budgets.

A feature is not complete because a threat ring or audio tone appears. It is complete when the signal chain produces measured, uncertain observations; failure and ambiguity behave plausibly; tests validate the results; and cockpit output reflects actual equipment state.

## Data provenance

Every equipment and emitter parameter must record units, source/document/page where available, variant/software applicability, confidence, uncertainty and status: publicly sourced, estimated, synthetic, unknown or gameplay-tuned. Keep classified or unavailable values unknown rather than filling gaps with invented precision.


## Shared dynamic engine and aircraft-specific configuration

The intended implementation is **one shared, dynamic RWR runtime**, not a separate simulator for every aircraft or receiver. Equipment differences are supplied by immutable, validated configuration profiles and aircraft installation adapters. This repository currently contains architecture and folder scaffolding only; these folders do not imply working runtime code or historically validated equipment data.

### Intended source layout

| Path | Owns |
|---|---|
| `sensors/RWR/core/` | Shared runtime orchestration, lifecycle and processing sequence |
| `sensors/RWR/hardware/` | Reusable receiver/processor interfaces and hardware models |
| `sensors/RWR/receiver/` | Generic receiver response and limitations |
| `sensors/RWR/antennas/` | Generic aperture response/DF algorithms and contracts; no aircraft-specific placement |
| `sensors/RWR/interfaces/` | Typed contracts for emissions, observations, contacts, commands and snapshots |
| `sensors/RWR/libraries/emitter-library/` | Shared reusable emitter records with provenance and uncertainty |
| `sensors/RWR/validation/` | Shared scenarios, tests and metrics |
| `game/modules/planes/F-16/RWR/` | F-16C Block 50 profile, installation, antennas, library selection, display and audio |
| `game/modules/planes/MiG-29A/RWR/` | Product 9.13 profile, installation, antennas, library selection, display and audio |

Aircraft-specific profiles must not be stored under the shared RWR engine. A platform composes the shared runtime by selecting an equipment configuration and supplying its own installation adapters.

The existing shared `receiver/`, `antennas/`, `channelization/`, `measurements/`, `pulse-descriptors/`, `deinterleaving/`, `emitter-association/`, `classification/`, `tracking/`, `threat-evaluation/`, `cockpit/`, `health/`, `data/`, `integration/`, `diagnostics/` and `lab/` directories remain in place. Aircraft-specific RWR folders contain only profile/configuration/installation/presentation data and adapters. Do not duplicate shared algorithms.

### Configuration layers

1. **Equipment profile:** receiver architecture, supported bands, sensitivity, instantaneous bandwidth, channel capacity, measurement accuracy, direction-finding method, processing limits, threat logic, BIT/fault behaviour and supported display/audio features.
2. **Aircraft installation:** equipment selected for the exact aircraft variant, antenna count and local transforms, airframe/store masking, cable/installation losses, electrical bus and cooling dependencies, self-interference paths, damage zones and cockpit wiring/mapping.
3. **Emitter library:** observable signature ranges/distributions and mode characteristics, each versioned and labelled with provenance. The library is not a source of hidden emitter state.
4. **Runtime state:** warm-up/BIT, receiver health, live measurements, candidate identities, tracks, uncertainty, warning states and display snapshots. Runtime state must never be written back into immutable configuration.

Do not fill ALR-67 or SPO-15LM profiles with invented precise performance values. Unknown values remain explicitly unknown; estimated or synthetic values carry labels and uncertainty. A named equipment profile is not evidence that a particular aircraft/operator/variant actually carried it. Validate the exact installation before selecting it.

### Cross-system interaction contracts

| Connected system | Data entering/leaving the RWR | Required behaviour |
|---|---|---|
| Radar equipment | Time-stamped emission events containing waveform/pulse timing, frequency, power/EIRP, antenna pattern/beam direction, scan schedule, mode evidence and transmitter health | Radar publishes emissions; RWR never reads radar target tracks, lock booleans or private target lists |
| Shared RF environment in `physics/radar/` | Propagated direct-path RF at the receiver location, including path loss, terrain/LOS, atmosphere, polarization and interference | This is the sole shared RF propagation owner; RWR does not create a second propagation world or use radar echo/two-way range equations |
| Aircraft pose and geometry | Position, attitude, angular motion, antenna transforms and fitted store/gear configuration | Recompute line-of-sight and antenna response in the correct frames; include airframe masking and installation effects |
| Electrical and cooling systems | Allocated bus power, voltage/quality, cooling availability and fault events | Warm-up, degraded operation, shutdown and recovery follow the actual installation profile; avoid a universal `powered` boolean |
| Electronic warfare / jammers | Jammer emissions, own-jammer schedule, blanking/look-through timing and interference | Jamming affects the received signal and receiver processing. Own-jammer leakage/blanking is installation-specific; do not apply a generic detection-range multiplier |
| Damage and maintenance | Antenna/receiver/cable/processor/display damage, calibration state, repair and BIT results | Degrade only the affected channels/functions and preserve fault causes in diagnostics |
| Avionics and cockpit | Operator mode/sensitivity/declutter/handoff commands; immutable RWR display and audio snapshots | Cockpit consumes RWR outputs and sends typed commands; it must not create detections or mutate receiver internals |
| Datalink / cooperative ESM | Remote emitter reports with source platform, timestamp, age, coordinate frame and uncertainty | Remote reports remain distinguishable from local intercepts and age naturally when updates stop |
| Radar, IRST and other sensors | Independent tracks/measurements with source, time and uncertainty for optional correlation | Fusion may associate observations, but must not upgrade an RWR bearing into an exact range or identity without supporting evidence |
| MAWS / missile warning | Independent missile-warning observations and confidence | MAWS remains a separate sensor. Correlation may combine warnings; RWR must not pretend to detect an infrared/UV missile plume as RF |
| AI and campaign systems | Only published RWR reports and confidence/age metadata | AI decisions use the same imperfect observations available to the aircraft, not hidden campaign truth |

### Causal update sequence

At each scheduled sensor update, the shared runtime should:

1. Read validated equipment and installation configuration plus current resource/health snapshots.
2. Consume only RF emission events published by transmitter-owning systems.
3. Ask the shared RF environment for the signal arriving at each installed antenna aperture.
4. Apply antenna pattern, installation masking, cable loss, receiver bandwidth/sensitivity, blanking, saturation and channel availability.
5. Produce timestamped measurements/PDWs with uncertainty and quality flags.
6. Deinterleave and associate observations into emitter candidates.
7. Compare candidates against the loaded library and preserve ambiguity/unknown classifications.
8. Update bearing-only emitter tracks and their covariance/age.
9. Evaluate equipment-specific search/track/launch evidence and threat priority without reading hidden radar or missile state.
10. Publish an immutable equipment-specific display/audio snapshot and diagnostic trace.

The simulation clock owns update order. Rendering is not the sensor clock. Expensive pulse/event work should be event-driven and bounded by receiver/processor capacity.

### Equipment-specific behaviour without duplicate engines

The common runtime owns the physical and signal-processing pipeline. Equipment profiles provide capability flags, parameter curves, limits and replaceable strategy implementations only where the real equipment architecture requires a different method. For example, an SPO-15LM profile can use its own programmed type-lamp recognition, azimuth-channel priority, power-scale, CW-channel and own-radar-interlock behaviour; an ALR-67 profile can use its configured receiver/channelization, emitter-processing and display capabilities. Do not give either system features unsupported by its selected variant.

The installation profile binds an equipment profile to an aircraft. A MiG-29A installation must not inherit F-16 antenna geometry or cockpit mapping. Aircraft variants resolve an explicit equipment + installation pair; no automatic fallback to a more capable RWR is permitted.

### First integration scenarios

- A search radar emits while scanning away from the aircraft: the RWR may receive sidelobe energy or nothing, depending on geometry and receiver limits.
- The radar turns its beam toward the aircraft and changes mode: measured pulse/scan evidence can change the RWR assessment after processing delay.
- The radar stops transmitting: the RWR track coasts, ages and eventually drops; it does not remain permanently locked.
- Two emitters overlap in frequency/time: channel and processor limits can cause missed, merged or ambiguous observations.
- Own radar or jammer transmits: only the configured bands/sectors/timing are desensitized or blanked.
- Antenna damage, bus loss or cooling failure: only affected functions degrade, with corresponding BIT/diagnostic state.
- A remote wingman shares an ESM report: the cockpit can show it as a datalinked report, not a local antenna detection.
- Radar/IRST correlation adds context: source provenance and uncertainty remain visible and no unsupported range is invented.

A vertical slice is complete only when the same runtime can load two materially different equipment profiles and two different aircraft installations, receive the same controlled emission scenario, produce observably different but causally valid results, and pass deterministic integration tests. Folder creation and configuration placeholders alone are not implementation.
