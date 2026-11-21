# Fuzes, arming logic and warhead component profiles

**Owner:** fuze/warhead product profiles and weapon safe/arm state. Shared collision, armour, blast/fragment and damage interactions remain with their physical owners. **Status:** architecture only.

Keep four concepts separate: weapon safety/arming; fuze sensing/trigger; warhead initiation/output; target physical damage after interaction.

## Fuze families

A profile may define only the fitted trigger method:
- Contact/impact sensing.
- Proximity sensing with its own compatible RF, optical, laser or other detector.
- Time/delay fuze.
- Command or externally initiated function where fitted.
- Height/altitude or other environment-referenced trigger where supported.
- Multi-mode logic only when documented.

The fuze's sensor observes an uncertain physical condition. It does not read target truth or simply detonate at a scripted distance.

## Safe/arm state machine

Define safe, arming-in-progress, armed, triggered, initiated, dud/inert and self-destruct/expired states as applicable. Arming prerequisites can include safe separation, elapsed time, travel distance, acceleration/spin, launcher umbilical separation or other exact hardware conditions. Each condition has a source and validity. A launch command alone never arms the weapon.

Model safing inhibits, arming delay, impact/trigger qualification, false trigger prevention, power loss, sensor failure, self-destruct and dud behavior. The launcher/weapon lifecycle owns the sequence; the fuze does not bypass it.

## Warhead families and effect profiles

A warhead definition records type, casing/fragmentation model or shaped/penetrating effect family as applicable, mass distribution, initiation location, energetic output class with units/provenance, directional pattern if fitted, delay/impact compatibility and uncertainty. Separate blast, fragmentation, penetration, incendiary/thermal and kinetic effects where supported by the actual product.

Do not equate nominal explosive output with target damage. The warhead produces a physical effect field/impulse/fragment population at a location/time. Physics/collision/armour and the damage system determine what surfaces, components and occupants are affected.

## Required validation

Test arming prerequisites and interlocks; safe separation; contact/proximity/time sensing; trigger boundary and false trigger; delay; dud/inert/self-destruct; damage to fuze; initiation failure; warhead output conservation/uncertainty; geometry-dependent target interaction; and save/replay. Never infer detonation solely from target distance becoming zero.
