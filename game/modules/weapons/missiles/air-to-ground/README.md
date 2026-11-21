# Air-to-ground missile variants

**Owner:** air-to-ground product definitions. Shared trajectory/propulsion/guidance/sensing algorithms remain in canonical owners. **Status:** architecture specification.

## Product data

Record exact variant/software fit; vehicle geometry and mass properties; motor and mass-flow curve; aero/control data; launch platform/station; launch envelope; navigation; seeker/designation architecture; fuze/arming; warhead/effects; datalink/command links; and provenance.

## Seeker and guidance families

Use only the architecture fitted to the selected weapon:
- Command/radio guidance and wire/fibre command updates where fitted.
- Radar beam-riding or laser beam-riding, which follow a director reference beam.
- Semi-active laser homing, which observes reflected designator energy.
- EO/TV or imaging infrared terminal homing.
- Active millimetre-wave/radar seeker.
- Passive RF/anti-radiation seeker.
- Inertial/GNSS or other navigation to a prebriefed/updated aimpoint.
- Dual-mode terminal sensing when confirmed.

A seeker cue/designation is not guaranteed acquisition. Target designation/updates enter through typed sensor or command-link observations with time, source, quality and uncertainty. Do not provide campaign target coordinates as perfect weapon truth.

## Moving/static target treatment

Record which target motion/feature classes the weapon can actually engage. The seeker can lose, reacquire or associate to another valid return. Obscuration, background clutter, weather, target contrast, illumination interruption, stale coordinates and link outage affect the real measurement chain.

## Validation

Test designation handoff and age; seeker search/acquisition/reacquisition; command/beam/laser link loss; moving target state uncertainty; terrain/weather/obscuration; gimbal/track limits; decoy interaction where applicable; launch separation; fuze/warhead and damage effects. No universal direct-hit correction.
