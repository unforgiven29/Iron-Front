# Air-to-air missile variants

**Owner:** air-to-air product definitions. Shared vehicle dynamics are physics/ballistics/propulsion; guidance is physics/guidance; seeker processing is sensors/weapon-seeker. **Status:** architecture specification.

## Variant composition

Record exact missile variant/block/production standard/software fit; airframe length/diameter/reference datum; mass/CG/inertia versus motor burn and warhead state; motor thrust-time/stage/ignition; aerodynamic/control-surface dataset; navigation and permitted update source; guidance composition; seeker; fuse/arming; warhead/effects; launcher compatibility; and source/provenance.

## Guidance/seeker composition

Support only evidence-backed architectures. Profiles may combine:
- Inertial midcourse with permitted datalink updates and ARH terminal acquisition.
- Semi-active radar homing with a compatible aircraft/ship/ground illuminator.
- SARH with conventional scan-based angle tracking or monopulse angle measurement where fitted.
- IR homing with a particular scanning or imaging detector architecture.
- Command guidance or radar/laser beam riding where actually installed.
- Passive RF/HOJ, EO/IIR or dual-mode combinations where confirmed.

These are not all interchangeable. A missile's information source, terminal sensing, angle measurement, guidance law and navigation source are separate data dimensions. See [guidance profiles](../../components/guidance/README.md) and [seeker profiles](../../components/seekers/README.md).

## Flight and control behavior

Include powered and coast mass change; fin/actuator travel and rate/force limits; guidance update interval; maximum supported lateral command/vehicle response; aerodynamic coefficient domain; dynamic pressure/Mach effects; gravity/drag; autopilot and control saturation; and asymmetric damage. Use declared point-mass, 3-DoF or 6-DoF model tier—do not claim full 6-DoF behavior when using a point-mass trajectory.

## Seeker/target information rules

The launch platform supplies a timestamped cue/track estimate with source and uncertainty. The seeker performs its own search, detection, association and track maintenance. For ARH, model midcourse uncertainty and candidate search; for SARH, retain the external illumination dependency; for IR, use target/decoy/environmental radiance and the installed detector type. No hidden target-truth access.

## Countermeasure interaction

No universal chaff/flare number. The missile uses its exact seeker profile and the shared dynamic discrimination model. Candidate association can maintain target, transfer to another observation, reject decoy, coast, lose track or reacquire based on the current scene and track history.

## Required validation

Launch/release compatibility; initial state and separation; motor curve/mass depletion; aerodynamic envelope; guidance-law response; seeker search/acquisition; FOV/gimbal/rate limits; source/illumination/link loss; target maneuvers; chaff/flare scenes; track swaps; fuze safety; warhead effect; and deterministic replay. Values remain variant-specific and sourced.
