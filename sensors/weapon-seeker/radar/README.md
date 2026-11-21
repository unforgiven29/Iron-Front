# Weapon radar seeker processing

**Owner:** sensors/weapon-seeker/radar for weapon-specific search/track state and candidate association. RF hardware and propagation remain with sensors/Radar and physics/radar. **Status:** architecture only.

## Seeker architecture axes

A missile radar profile separately defines active vs semi-active illumination; antenna/aperture and polarization; waveform/PRF family as supported by evidence; search pattern, beamwidth and revisit; receiver noise/dynamic range; range/range-rate/angle measurement capability; tracking gate; update rate; FOV/gimbal and tracking rate; processing delays; and power/thermal state.

An ARH seeker transmits and receives its own RF energy. A SARH seeker receives target-reflected energy from an external illuminator. Their physical signal chains are distinct even if the downstream track interface is shared.

## Search and track stages

Standby/warm-up → search task → receiver observation → detection candidates → range/angle/velocity gates supported by the design → association → track initiation → track update → coast/lost/reacquisition. A cue may constrain the search task, but candidate selection must use observations and configured association.

ARH terminal search may use a launch/midcourse uncertainty region and can acquire a candidate that differs from the original cue when multiple contacts are present. SARH track validity depends on continued illumination/usable return. Do not share one transition graph if the architectures' prerequisites differ.

## Countermeasure-relevant features

Keep raw measurements/features separate from track decisions: received power/SNR, angular error and rate, range/range-rate where measured, Doppler consistency, polarization or spectral response where fitted, pulse/scan consistency, clutter, sidelobe/angle ambiguity, track continuity and gate innovation. The decoy-discrimination policy consumes these features; it must not set signal strength directly to fooled or not fooled.

Monopulse is a measurement/angle-tracking architecture; conventional scanning angle trackers have their own scan-induced modulation and loop state. Neither one implies universal immunity to chaff.

## Validation

Test active/SARH chain separation; seeker scan/revisit; measurement uncertainty; multiple candidate contacts; target/decoy association; range/range-rate and angle gating; external illumination interruption; clutter/noise; false alarms; track swaps; link/cue uncertainty; and terminal gimbal/rate limits.
