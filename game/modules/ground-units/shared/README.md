# Shared ground-platform data contracts

This folder contains common configuration shapes and interfaces for ground platform identity, crew/stations, mount points, mobility configuration, weapon stations, damage zones and sight/sensor installations. It is not a home for generic physical solvers.

Track/wheel/suspension mechanics belong in physics/ground-mobility; rigid-body state in physics/rigidbody; collision in physics/collision; projectiles in physics/ballistics; penetration in physics/armour; resource arbitration in core/resources; electrical/hydraulic/fuel in game/systems.

Shared schema changes must be backward-compatible or versioned and tested against materially different tracked and wheeled consumers. Avoid platform-specific required fields in universal contracts.
