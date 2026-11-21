# Weapon guidance profile index

**Owner:** weapon-specific guidance profile data. Shared guidance laws and state calculations live in physics/guidance. **Status:** architecture/profile specification only.

A weapon's guidance type is not a single enum. Its profile composes information source, navigation/midcourse source, terminal seeker, seeker measurement method, guidance law, actuator/control authority and lost-guidance behavior.

## Detailed guidance families

- [Command and beam riding](../../../../../physics/guidance/command-and-beam-riding.md)
- [SARH: conventional scan and monopulse](../../../../../physics/guidance/semi-active-radar-homing.md)
- [ARH: inertial/midcourse, handover, terminal acquisition](../../../../../physics/guidance/active-radar-homing.md)
- [IR, EO, semi-active laser and optical](../../../../../physics/guidance/infrared-optical-laser-homing.md)
- [Navigation, midcourse, guidance laws and autopilot](../../../../../physics/guidance/navigation-midcourse-and-laws.md)

## Profile fields

- Guidance information source(s): command/director, beam reference, external illuminator, onboard active seeker, passive seeker, or combinations.
- Midcourse navigation: inertial, permitted datalink, command, GNSS/other nav, prebriefed waypoint or none.
- Terminal sensor: none, active radar, semi-active radar, IR scanning, IIR, EO/TV, SAL, passive RF or documented multi-mode.
- Radar angle method: conventional scan/measurement, monopulse or other confirmed implementation.
- Steering law and reference frame.
- Update rate, delay, filter/uncertainty, command limits, autopilot and actuator dependencies.
- Handover/activation conditions, timeouts, coast/reacquisition and self-destruct/termination policy.

## Compatibility

Do not assign incompatible sensor/illumination/link profiles. A SARH configuration requires external illumination; a beam rider requires a valid beam reference; ARH requires an active onboard RF path; a passive IR seeker must not magically become an active sensor. Required missing support must fail validation or enter an explicit unavailable mode.

Use no weapon-name branches in physics/guidance. Shared law implementation is selected by typed capability/configuration.
