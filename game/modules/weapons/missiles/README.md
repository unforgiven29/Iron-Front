# Missile families — entry point

**Owner:** game/modules/weapons/missiles. **Status:** content composition architecture; individual complete missile runtime is not implemented.

All missile variants compose physical vehicle data, motor, aerodynamic/control model, navigation/guidance, seeker if fitted, command/datalink/illumination support, fuze/arming, warhead, launcher compatibility and evidence. Shared equations and state machines remain in physics, sensors and game/systems owners.

## Read the relevant family only

- [Air-to-air](air-to-air/README.md)
- [Air-to-ground](air-to-ground/README.md)
- [Anti-tank guided missiles](anti-tank/README.md)
- [Anti-radiation](anti-radiation/README.md)
- [Anti-ship](anti-ship/README.md)
- [Surface-to-air and MANPADS](surface-to-air/README.md)

## Shared missile lifecycle

Stored/safe → selected/configured → release request → launcher checks compatibility/interlocks/envelope → separation/initial conditions → boost/sustain/coast → navigation/midcourse → seeker search/acquisition/track where fitted → terminal guidance → fuze/impact/miss/dud/self-destruct/inert → effect report.

Not all missiles have every phase. Each transition has explicit conditions, timing, required inputs, fault response and provenance. Commands are not state. Do not treat a seeker cue as a confirmed lock or a valid track as a guaranteed hit.

## Shared component owners

For a concrete, typed profile-composition shape, see [the weapon profile contract](../components/profile-contract.md).

Read [weapon composition](../components/README.md), [seeker profiles](../components/seekers/README.md), [guidance profiles](../components/guidance/README.md), [motor](../components/motors/README.md), [fuze/warhead](../components/fuzes-warheads/README.md), and [launcher/store](../components/launchers-and-stores/README.md) only as needed. Dynamic decoy response belongs in sensors/weapon-seeker/countermeasure-discrimination.

Each product is data-driven; shared code must never branch on weapon display name.
