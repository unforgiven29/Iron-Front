# Dynamic seeker countermeasure discrimination

**Owner:** sensors/weapon-seeker/countermeasure-discrimination. **Status:** architecture specification; no discrimination runtime exists.

A weapon must not have one constant countermeasure-susceptibility value. Decoy effectiveness is a time-varying result of the real seeker observation chain, target/decoy geometry, signatures, environment, signal processing and track logic. A static product rating may appear in a qualitative reference table, but it must never drive runtime outcomes.

## Runtime question

At each seeker update, compare the current target-track hypothesis with every observed candidate and decide whether the seeker should maintain, transfer, reject, coast or lose the track. The model outputs candidate-specific likelihood/score and uncertainty; the track manager applies the installed algorithm. It does not simply roll one flare/chaff percentage.

## Shared inputs

- Target and decoy observed measurements from the seeker front end, not entity truth.
- Target/decoy relative bearing, angular separation, apparent size/extent, range/range-rate or Doppler when measured, angular rate and temporal continuity.
- Signal/scene quality: SNR, contrast, saturation, clutter, atmospheric/optical transmission, background and uncertainty.
- Seeker architecture: scan or imaging mode, spectral/RF band, FOV/field of regard, gimbal/rate, update interval, tracking gates, processing memory and discriminant capabilities actually fitted.
- Target signature state: aspect, engine/thrust/thermal state, afterburner if modeled, body/engine radiance or radar return profile, emission state and maneuver.
- Decoy state: type, deployed time, position/velocity, dispersion/trajectory, signature-versus-time, spectral/RF behavior, orientation, activation/power and age.
- Environment and platform effects: wind, turbulence, temperature, cloud/precipitation, solar/background scene, terrain/sea/ground clutter and propagation.
- Track history: previous innovation/residual, confidence, time since last update, candidate continuity and prior discrimination decisions.

## Radar-guided weapons and chaff/active RF decoys

The chaff/decoy object supplies its changing RF scattering/emission observation through physics/radar and the radar seeker receiver. The seeker processing evaluates only measured features it can observe: return strength/quality, angle/range/range-rate consistency, Doppler relationship, angular motion, cloud extent, scan/track continuity and permitted ECCM/HOJ logic.

A chaff cloud is a moving, dispersing set of scattering material, not a fixed RCS bonus. Its return changes with age, spatial spread, target/weapon geometry, frequency/polarization, environment and the radar's processing. Active repeaters/towed decoys require their own emission, timing, movement, power and geometry state. A radar seeker may maintain the aircraft, associate to another candidate, follow a decoy, reject both, or lose track; the result emerges from candidate observations and processing.

For SARH, maintain the external illuminator/return dependency. For ARH, model the missile's terminal observations and any permitted home-on-jam behavior. Do not equate every active radar decoy, chaff cloud or noise jammer.

## Infrared-guided weapons and flares

Flare objects provide time-varying spectral radiance, burn/decay, temperature, apparent size, trajectory and motion through the IR scene. Their measured contrast depends on bandpass, detector response, atmosphere, background, target radiance/aspect, range, angular separation, scan/image processing, saturation and track history.

An older scanning seeker may respond to temporal modulation/track gates differently from an IIR focal-plane seeker using spatial/scene features. A dual-band seeker can compare only bands it actually measures. Do not grant all IIR seekers perfect flare rejection or all older seekers automatic flare attraction.

## No universal IRCCM switch

IRCCM is a family of seeker-specific discrimination features, not a single immunity percentage. Profile the actual supported mechanisms: spectral comparison; scan/track timing logic; spatial/shape/scene processing; kinematic/track continuity; background discrimination; rejection/hold-off logic; and other evidence-backed features. Unknown details remain unknown. Gameplay tuning must be a clearly labeled profile parameter with a test record, not disguised as real-world capability.

## Runtime outputs

Per candidate and update, publish: detection validity; measurement quality; target/decoy hypothesis likelihood or association score; innovation/gate result; track continuity; discrimination reason code; confidence/uncertainty; and chosen transition (maintain/transfer/reject/coast/lost/reacquire). Preserve random seed and observation history for deterministic replay.

For a probabilistic implementation, treat each observed candidate as a hypothesis. Its relative association weight is derived from the likelihood of the current measurement given the predicted track, the candidate's observed features, the seeker architecture, environment and history, multiplied by the prior track/association weight. Normalize only among actually detected candidates and include a no-valid-detection hypothesis. Preserve uncertainty; do not turn the result into a single missile-level constant.

Probability may be used for detector noise and association uncertainty, but it must be conditioned on the current observation and track history. A reproducible stochastic process is not the same as a static random success roll. Separate at least detection probability, false-alarm probability, track-association probability, decoy-transfer probability and track-loss probability. They are related outputs of the scene/processing model, not interchangeable tuning knobs.

## Required tests

1. Same weapon, same setup, no decoy: baseline track stability.
2. Same release with decoy timing varied: show the timing window and geometry matter.
3. Same decoy with target aspect/signature changed.
4. Decoy released outside FOV / outside track gate versus inside.
5. Decoy and target angularly unresolved versus resolved.
6. Vary cloud/decoy age, spread, wind and separation.
7. Vary target/decoy range-rate and seeker update gaps for radar.
8. Vary spectral contrast, background, saturation and frame continuity for IR.
9. Use scanning IR and IIR profiles against the same scene and compare their distinct processing.
10. Test simultaneous decoys, multiple real targets, false alarms, candidate swaps and track memory.
11. Damage, power/cooling loss and seeker misalignment.
12. Deterministic replay over fixed observation streams and seed.

Never assert a decoy guarantees defeat. The model should expose why a track was maintained, transferred, rejected or lost.
