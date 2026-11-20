# Weapon module architecture

Weapons are independently configurable content modules composed from shared guidance, seeker, fuze, warhead, launcher, ballistics, collision, damage and resource interfaces. A weapon package describes one exact product/variant and its supported configuration; generic physics and processing remain outside it.

## Content categories

- Guns and ammunition.
- Air-to-air, air-to-ground, anti-radiation, anti-ship and surface-launched missiles.
- Guided/unguided bombs and glide weapons.
- Rockets and rocket pods.
- Naval weapons where supported.
- Launchers, pylons, racks, stations and release adapters.
- Countermeasures and expendables.

## Composition

A weapon can reference seeker capability/configuration, guidance law/navigation, fuze and arming conditions, warhead effect model, propulsion/motor data, launcher compatibility/station geometry, telemetry/faults and asset/audio/cockpit references. Not every weapon has every capability; absence is explicit. Similar weapons may share an implementation but retain their own limits and data.

Launcher validates compatibility and release conditions. After release the weapon owns its flight state and consumes only observations available through its seeker/navigation/datalink contracts. Guidance requests control; shared propulsion/ballistics/actuator models affect motion; fuze/warhead acts only when arming/trigger conditions are satisfied. Damage is applied through shared damage services.

Do not allow hidden-target reads, perfect tracking, arbitrary target reacquisition or instantaneous arming. Each weapon has exact variant ID, mass/geometry, propulsion, seeker/guidance, fuze/warhead, release compatibility, safe envelope, provenance and uncertainty.

**Status:** Architecture/folders only; no functioning weapon simulation is implied.
