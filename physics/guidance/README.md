# Shared weapon guidance physics

**Owner:** physics/guidance. **Status:** initial executable laws are in `game/src/physics/guidance/GuidanceLaws.ts`: true proportional navigation, augmented PN and pure pursuit, using timestamped uncertain estimates and acceleration bounds. These laws are not a complete autopilot or weapon package.

This is the platform-neutral guidance calculation owner. It transforms navigation estimates and seeker/command observations into bounded steering requests. It does not own weapon definitions, seeker hardware, target truth, missile propulsion, aerodynamic control surfaces or rigid-body integration.

## One weapon, separate orthogonal layers

Do not encode every missile as one enum such as SARH or IR. A product definition composes separate choices:
1. **Information source:** onboard seeker, external illuminator, command link, beam reference, inertial/navigation solution or combinations.
2. **Navigation/midcourse:** inertial coast, permitted datalink updates, command updates, GNSS/INS or prebriefed aimpoint where fitted.
3. **Terminal measurement:** active radar, semi-active radar, infrared, imaging IR, EO/TV, semi-active laser, passive RF or no terminal seeker.
4. **Angle/range measurement architecture:** for example conventional radar angle tracking or monopulse; the exact method is seeker hardware/processing, not a guidance law.
5. **Guidance law:** proportional navigation family, command-to-line-of-sight, beam-centering, pursuit, waypoint/trajectory following or other supported law.
6. **Control execution:** autopilot, fin/jet/TVC actuators, rate/acceleration authority and vehicle dynamics.

A named guidance type is a composition of these layers, not a monolithic behavior copied between missile variants.

## Contract

Inputs are timestamped, framed and uncertain state estimates: missile position/velocity/attitude, target state estimate or aimpoint, relative geometry, navigation quality, seeker measurements/track quality, command/datalink updates, actuator/vehicle limits and configuration. Output is a bounded acceleration/attitude/line-of-sight command with reference frame, validity and confidence. Missile dynamics then determine the actual trajectory.

Guidance must not receive direct campaign/entity truth, future target state, a guaranteed intercept point or a hidden perfect lock. If the seeker loses track, guidance follows the variant's configured coast, inertial memory, command-degraded, reacquisition or termination policy.

## Architecture guides

- [Command and beam-riding guidance](command-and-beam-riding.md)
- [Semi-active radar homing](semi-active-radar-homing.md)
- [Active radar homing](active-radar-homing.md)
- [Infrared, optical and laser homing](infrared-optical-laser-homing.md)
- [Navigation, midcourse and guidance laws](navigation-midcourse-and-laws.md)

## Failure and fidelity

Model update delay, measurement noise/uncertainty, stale reports, link interruption, illuminator loss, beam loss, seeker rejection, gimbal/rate saturation, actuator/fin damage, motor/energy limits, target maneuver and navigation drift. Guidance-law fidelity must not exceed the quality of its measurements and missile dynamics.

Use one shared implementation per physical/law family and data-driven profiles per weapon. Never branch on a weapon display name. Compare deterministic synthetic cases first, then sourced data and held-out trajectory cases. Keep approximate/gameplay-tuned values clearly tagged.
