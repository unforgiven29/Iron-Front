# Active radar homing (ARH)

**Owner:** physics/guidance for flight/navigation sequencing; sensors/Radar and sensors/weapon-seeker own onboard RF sensing/tracking; the weapon package provides the exact installation. **Status:** architecture specification only.

An ARH weapon carries its own active radar terminal seeker. Many architectures also use inertial midcourse and may receive permitted external updates before terminal acquisition. Fire-and-forget is not a promise of perfect target knowledge or uninterrupted guidance.

## Separate lifecycle and information states

Model these as explicit phases where fitted:
1. **Pre-launch cue and initialization:** source track, target state estimate, launch reference, alignment and initial uncertainty are captured.
2. **Boost/early flight:** motor and inertial state evolve; seeker may be powered/warming/standby but not yet searching.
3. **Midcourse:** inertial/navigation guidance steers toward the estimated intercept region; authorized datalink messages may update target state. Each message has age, delay, noise, source identity and uncertainty.
4. **Handover/search:** the seeker receives a search task/volume, begins its own scan and produces candidate measurements through its receiver/processing chain.
5. **Acquisition/track:** the seeker establishes a weapon-local track that must meet its own measurement, association and continuity requirements.
6. **Terminal:** guidance uses the weapon-local track and the remaining kinematic/actuator envelope.
7. **Lost/reacquire/end:** stale track, failed acquisition, target leaving field of regard, damage or guidance saturation follows the weapon's defined policy.

Not every ARH weapon uses the same modes, update schedule, acquisition logic or handover threshold. Do not copy one missile's mode list to the entire class.

## Uncertainty is part of the flight model

Maintain covariance/uncertainty or a declared approximation for launch cue, target state, aircraft navigation, weapon inertial navigation, datalink, time alignment and subsequent seeker measurements. The search task is built around the estimated intercept region, not a hidden exact target position. A candidate selected by the terminal seeker may differ from the original cue if multiple returns are observed; candidate association must use measured features and weapon rules.

Falcon BMS's public AIM-120 acquisition article is useful as a design reference for separating midcourse, handover/search and terminal acquisition, and for making cue/datalink/INS uncertainty affect the seeker's search volume. The article explicitly warns that its 4.37.3 AIM-120 model uses assumptions and estimates and does not claim engineering-accurate missile simulation; do not copy its numeric values or treat it as authoritative real-world data.

## Failure and degraded cases

Test no update, delayed update, stale update, corrupted/low-quality cue, datalink outage, navigation drift, seeker standby/power fault, search-volume miss, multiple candidate returns, false alarm, track swap, target maneuver, chaff/ECM clutter interaction, gimbal/rate limit, terminal track loss and actuator authority exhaustion. No target truth access or guaranteed acquisition.

## Validation

Validate each phase transition and observable output independently; test candidate association and false acquisition statistically over recorded seeds. Compare uncertainty growth and search-volume coverage against synthetic analytical cases and appropriately sourced public data. Report unsupported or classified details rather than inventing a detailed waveform or exact performance.
