# Weapon electrical power, seeker cooling and thermal state

**Owner:** weapon component profile for fitted power/thermal equipment. Shared electrical, cooling and thermal behavior remain with game/systems and physics/thermal. **Status:** architecture only.

A weapon does not have infinite electrical energy or an always-ready seeker. Its electronics, inertial unit, command receiver, radar/IR seeker, actuator and fuze may have different power, warm-up, cooling and endurance requirements. The product profile identifies the installed arrangement; shared services model the actual supply and thermal response.

## Configuration

For each fitted subsystem declare source (battery, thermal battery, launcher umbilical, aircraft supply, generator/alternator or other documented source); activation method and delay; voltage/current/power envelope as known; stored energy and endurance; load priority; connector/separation transition; charge/servicing restrictions; thermal mass/limits; cooling type/consumables; warm-up/cool-down time; and fault behavior.

A seeker cryogenic/cooling resource is not interchangeable with electrical power. Thermal battery activation is not an infinite DC supply. External launcher power is not available after separation unless the architecture explicitly provides it.

## Runtime state

Track source state, energy/charge remaining, bus/load quality, startup sequencing, temperature, thermal capacity, cooling inventory/flow, subsystem readiness, brownout/reset and fault latches. A weapon may be physically released while a seeker is not yet fully ready; mode transitions follow the product-specific startup timeline.

## Separation and lifecycle

Launcher umbilicals/disconnects and onboard sources transition according to actual hardware. If an external power/cooling/command connection is lost at separation, the weapon changes to its onboard supply and supported mode. Do not grant post-release support simply because the launcher had power before release.

## Validation

Test cold/warm start, activation delay, finite battery/thermal-battery endurance, load peaks, seeker warm-up/cooling, brownout, connector separation, power loss, thermal limits, cooling failure and replay. Unknown source architecture remains unknown rather than being replaced by a generic battery.
