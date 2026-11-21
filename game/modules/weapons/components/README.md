# Reusable weapon component profiles

**Owner:** game/modules/weapons/components. **Status:** profile/contract architecture only.

A weapon is composed from small, typed profiles. This directory describes component configurations and interfaces; canonical physics/sensor owners implement behavior. Keep product data, shared algorithms and runtime state separate.

## Composition layers

1. **Vehicle:** body geometry, mass properties, aerodynamic/control surfaces and damage zones.
2. **Propulsion:** motor family, ignition, stages, thrust-time/energy output, propellant mass and nozzle.
3. **Guidance/navigation:** information source, navigation updates, terminal mode, guidance law, autopilot and control authority.
4. **Seeker/sensing:** sensor architecture, band, aperture, scan/image method, receiver/detector, search/track gates and supported modes.
5. **Power/thermal:** onboard power, umbilicals, cooling, warm-up, endurance and thermal limits.
6. **Mission/effect:** fuze/arming, warhead, launcher/rack/station, separation and permitted external links.
7. **Environment/interactions:** damage, decoys and dynamic seeker discrimination.
8. **Evidence:** exact product/version applicability, sources, units, uncertainty, provenance and envelope.

## Component guides

- [Weapon profile composition contract](profile-contract.md)

- [Airframe, vehicle and aerodynamic data](airframe-and-aerodynamics/README.md)
- [Control system, autopilot and actuators](control-systems/README.md)
- [Motors and propulsion profiles](motors/README.md)
- [Navigation/guidance profile index](guidance/README.md)
- [Seeker profile index](seekers/README.md)
- [Power and thermal installation](power-and-thermal/README.md)
- [Fuzes and warheads](fuzes-warheads/README.md)
- [Launchers and stores](launchers-and-stores/README.md)

## Configuration versus behavior

- Component profile: immutable selected equipment/configuration values.
- Runtime component state: actual temperature, power, motor phase, seeker mode, navigation state, track, actuator position, damage and remaining inventory.
- Shared owner: equations, state transitions and algorithms.
- Platform/launcher: actual mounting station, interface wiring, release impulse, pointing/illumination and commands.

A profile must not contain hidden mutable runtime state. A component must not become a separate module/package merely because it has a folder.

## Composition validation

Validate profile references, type compatibility, allowed combinations, dependency cycles, units, exact product/version applicability, launcher match, power/cooling interfaces and missing required fields before a weapon can be loaded in a scenario. Missing required datalink, illuminator, cooling or seeker capability causes an explicit unavailable/degraded mode, not silent substitution.
