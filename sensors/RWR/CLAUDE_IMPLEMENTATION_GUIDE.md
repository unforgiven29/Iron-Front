# Claude Implementation Guide — RWR / ESM

Read this with [RWR architecture](README.md), [sensor suite](../../docs/sensors/README.md), [radar](../../docs/radar/README.md), [integrated simulation](../../docs/integrated-simulation/README.md) and the aircraft module guides.

## Mission

Implement a passive RF interception and electronic-support system whose observations arise from actual simulated emissions and receiver limitations. It must not read campaign truth, radar target tracks or emitter private state. Build an end-to-end vertical slice before expanding the library or cockpit.

## First: repository audit and ownership

1. Inspect existing RWR, ESM, EW, radar, RF propagation, aircraft avionics and cockpit code.
2. Record what is implemented, partially implemented, duplicated or missing.
3. Keep one shared RF environment/propagation owner. Extend `physics/radar/` where it already owns radar propagation/emission physics; do not create a second RF world.
4. Keep RWR equipment and processing under `sensors/RWR/`.
5. Select an exact aircraft RWR fit only after the aircraft variant/software baseline is selected. Do not assume all F-16 blocks or all aircraft use the same RWR.
6. Add typed contracts before implementation. Use TypeScript where the current build supports it and keep existing JS interoperable.

## Required module contracts

Define explicit versioned contracts for:

- **Emitter definition/configuration:** stable ID, equipment/variant/software baseline, transmitter/antenna model, waveform family, operating modes, emission schedule, power/EIRP representation, source provenance and uncertainty.
- **Emission event/field:** emitter ID, timestamp/duration, frequency characteristics, pulse/continuous waveform descriptor, pulse timing, antenna pointing/pattern reference, polarization, transmit state and quality. Avoid exposing private target/track state.
- **RF path observation:** path geometry, propagation loss, obstruction/visibility, multipath contribution if modeled, polarization mismatch and model confidence.
- **Receiver configuration/state:** coverage, instantaneous bandwidth, channel map, sensitivity/noise, selectivity, dynamic range, scan/revisit, dead time, calibration, health, power and thermal limits.
- **Raw measurement/Pulse Descriptor Record:** timestamp, frequency, pulse width, amplitude, bearing/angle, modulation features where supported, uncertainties, SNR/quality and validity flags.
- **Emitter candidate/track:** candidate IDs, confidence, supporting evidence, bearing/covariance, history, age, source, lifecycle and ambiguity.
- **Threat assessment:** evidence-backed category/priority, confidence, reason codes and warning state. Separate emitter identity, hostility, tracking evidence and launch warning.
- **Cockpit sample:** timestamp, validity, quality, symbol/audio request, display/mode context and source report ID.

Keep immutable configuration separate from mutable runtime state. SI units and explicit coordinate frames. Never use untyped bags of fields or ambiguous degrees/radians.

## Vertical slice implementation order

1. **One emitter:** create a radar transmitter that emits only when its actual hardware/mode/scheduler says it is transmitting. Publish time-bounded emissions to the shared RF environment.
2. **One receiver fit:** define a documented RWR receiver with limited coverage, bandwidth, sensitivity, channelization and antenna installation.
3. **One path:** compute received direct-path signal level from emitter output, directional antenna response, propagation and receiver antenna response. This is an interception path, not a radar echo.
4. **Measurement:** create an observation only when the received signal passes receiver/processing conditions. Add timing/frequency/amplitude/bearing error and missed detections.
5. **Pulse records:** emit timestamped descriptor records with uncertainty and quality.
6. **Association:** group observations into emitter candidates. Include a deliberately unknown source.
7. **Track:** update a bearing-only emitter track, covariance and age. Demonstrate coast and loss.
8. **Cockpit:** render only the resulting report and track state.
9. **Tests:** prove each stage with deterministic fixtures and negative cases.
10. Expand to multiple emitters, variable waveforms, more realistic antenna/receiver architectures and EW interactions.

Do not begin by building a decorative threat ring or a huge emitter library.

## Physical correctness rules

- Use a direct-path interception/link-budget model for RWR. Do not use the radar's monostatic echo equation or target RCS as the primary received-power calculation.
- Use transmitter EIRP or an equivalent physically consistent source model with frequency, antenna direction, path loss, polarization and receiver antenna gain/loss. Keep units and reference planes explicit.
- The receiver must have finite sensitivity, bandwidth, selectivity, dynamic range, channel capacity and processing time.
- A receiver with swept/channelized coverage may miss short emissions outside its dwell or between revisits.
- Antenna coverage, frequency response, aircraft installation, airframe masking, pattern nulls and damage matter.
- Bearing is uncertain. Model method-specific errors, ambiguity, bias, calibration, multipath and ownship attitude.
- A single bearing does not provide range. No precise emitter location without an explicitly modeled and validated ranging/triangulation method.
- Deinterleaving must tolerate jitter, stagger, frequency agility, pulse overlap, missing pulses and false measurements.
- Classification is probabilistic. Similar signatures and incomplete libraries must produce ambiguity or unknown results.
- Do not infer lock, hostile intent or missile launch from mere energy detection.
- No perfect 360° coverage, unlimited simultaneous channels, zero-latency processing or perfect emitter IDs unless the selected equipment model explicitly supports the relevant behavior—and still preserve measurement limits.
- Never expose an emitter's hidden target list, lock state or campaign identity to the receiver. The observable signal is the only evidence.

## Cross-system integration

- Radar emission comes from the radar transmitter/waveform/antenna/beam scheduler. It is not a manually generated RWR cue.
- Radar and RWR operate on the same simulation clock but distinct receive/transmit chains.
- Jamming/interference enters the RF environment and receiver front end; implement blocking, masking, desensitization and processing consequences where appropriate.
- Electrical power, cooling, antenna/cable/receiver health and calibration affect performance.
- Datalinked emitter reports retain remote source, timestamp, uncertainty and age.
- Cockpit audio/symbols use actual threat assessment and aircraft-specific warning logic.
- Damage to one antenna or receiver channel must not disable unrelated equipment unless the documented architecture connects them.

## Tests that must exist before calling the first slice complete

1. Emitter silent/off → no RWR observation.
2. Emitter transmits but antenna points away → lower received level according to pattern; not an automatic detection.
3. Increasing separation changes received level according to the direct-path model.
4. Receiver sensitivity threshold and noise produce misses/false alarms at controlled conditions.
5. Short burst outside a swept receiver's dwell can be missed.
6. Strong nearby source can saturate/block and mask a weaker source.
7. Two overlapping pulse trains can be ambiguous and later separate.
8. Unknown emitter remains unknown; classification confidence is calibrated.
9. Bearing-only track uncertainty grows during coast; no fake range is displayed.
10. Radar tracks a different aircraft while RWR receives its emission: RWR may detect the radar, but must not claim the radar is tracking the player.
11. A receive-only/silent radar is not detected as an emitter.
12. A radar mode change is inferred only when measurable emission characteristics change.
13. Ownship attitude and antenna installation change measured bearing/coverage correctly.
14. Antenna damage, receiver fault, electrical loss and cooling fault produce specific degradations.
15. Datalink report is visibly remote and ages independently of local RWR.
16. Seeded replay produces repeatable measurements and tracks.

## Performance and profiling

Use event-driven pulse/emission scheduling, spatial indexes, conservative culling, cached antenna/terrain data, bounded candidate sets and multi-rate processing. Never skip a physically relevant emitter just to meet a frame budget without reporting the approximation. Profile dense scenes and mobile browsers. Add diagnostics for emitted events, path loss, receiver level, channel occupancy, dropped pulses, false alarms, deinterleaving groups, classification confidence and track covariance.

## Acceptance gate

The RWR vertical slice is accepted only when the complete causal chain is connected, the tests above pass, source/uncertainty records exist, and the cockpit is driven by actual RWR output. The RWR is not complete merely because a display resembles a real aircraft warning panel.

Do not claim it is more accurate than DCS or any real-world system without a defined benchmark, public reference baseline and reproducible comparison. The project should instead publish measured fidelity, known limitations and validation coverage.
