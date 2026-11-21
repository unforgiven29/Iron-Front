# Reusable weapon component profiles

**Owner:** game/modules/weapons/components. **Status:** profile/contract architecture only.

A weapon is composed from small, typed profiles. This directory describes component configurations and interfaces; canonical physics/sensor owners implement behavior. Keep product data, shared algorithms and runtime state separate.

## Composition layers

1. **Physical vehicle:** body geometry, mass properties, aerodynamic/control surfaces, motor and staging.
2. **Navigation/guidance:** guidance information source, navigation updates, guidance law, autopilot and actuator limits.
3. **Seeker/sensing:** seeker hardware architecture, physical band, aperture, scan/image method, receiver/detector, search/track gates, supported modes and resource requirements.
4. **Mission/effect:** fuze/arming, warhead, launcher/rack/station, separation and permitted external links.
5. **Environment/interactions:** power, cooling, thermal state, damage, decoys and seeker discrimination.
6. **Evidence:** exact product/version applicability, sources, units, uncertainty, provenance and envelope.

## Configuration versus behavior

- Component profile: immutable selected equipment/configuration values.
- Runtime component state: actual temperature, power, motor phase, seeker mode, navigation state, track, actuator position, damage and remaining inventory.
- Shared owner: equations, state transitions and algorithms.
- Platform/launcher: actual mounting station, interface wiring, release impulse, pointing/illumination, and commands.

A profile must not contain hidden mutable runtime state. A component must not become a separate module/package merely because it has a folder.

## Component indexes

- [Seekers](seekers/README.md)
- [Guidance](guidance/README.md)
- [Motors](motors/README.md)
- [Fuzes and warheads](fuzes-warheads/README.md)
- [Launchers and stores](launchers-and-stores/README.md)

Every profile must declare required/optional capabilities. A missing required datalink, illuminator, cooling or seeker capability causes an explicit unavailable/degraded mode, not silent substitution.

## Composition validation

Validate profile references, type compatibility, allowed combinations, dependency cycles, units, exact product/version applicability, launcher match, power/cooling interfaces and missing required fields before the weapon can be loaded in a scenario.
