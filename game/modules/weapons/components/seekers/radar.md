# Radar seeker component profiles

**Purpose:** define radar seeker installations, not implement an independent radar engine. **Owner:** weapon component profiles; processing: sensors/weapon-seeker/radar; RF hardware/physics: sensors/Radar and physics/radar.

## Profile axes

Separate illumination (active onboard transmitter, semi-active external illuminator, or another documented arrangement); antenna/aperture and polarization; waveform/receiver family as supported by evidence; search pattern, beamwidth and revisit; receiver noise/dynamic range; range/range-rate/angle measurement capability; tracking gate; update rate; FOV/gimbal and tracking rate; processing delays; and power/thermal state.

An ARH seeker transmits and receives its own RF energy. A SARH seeker receives target-reflected energy from an external illuminator. Their physical signal chains are distinct even if downstream track interfaces are shared.

## SARH profile distinction

SARH requires a compatible external illuminator and a usable target return. The profile identifies illumination bands/modes, pointing/support dependency, missile receiver scan/angle method and behavior when illumination or track is lost. A monopulse SARH label identifies an angle-tracking architecture, not an autonomous transmitter or a universal chaff-resistance value.

## ARH profile distinction

ARH identifies the onboard active transmitter/receiver plus its midcourse/terminal interface. Its product profile includes whether external updates are supported, seeker standby/search/active modes, terminal search task, search FOV/volume, candidate association and reacquisition. The initial aircraft track is not guaranteed to be the final weapon track.

## Data discipline

Use exact seeker variant/software source. Unknown bandwidth, waveform, receiver sensitivity, tracking rate and processing features stay unknown; do not fill classified gaps with plausible-looking numbers or copy another missile's profile.
