# Naval platform modules

Ship packages own exact hull variant, displacement/draft, geometry, mass/CG/inertia, propulsion/shaft/rudder installation, fuel/electrical/cooling topology, compartments/bulkheads, crew, sensors, antennas, weapons, communications, damage-control, aircraft/deck interface and provenance. Shared rigidbody/collision/propulsion/damage/sensor/weapon services remain external.

World owns water/coast/bathymetry. Naval movement requires physical force/propulsion and supported hydrodynamic/sea-state models; do not directly animate ship position as authoritative movement. Carrier operations coordinate deck/catapult/arresting and aircraft handling but do not own aircraft flight physics.

Validate turning/stopping, draft/grounding, loading, propulsion/rudder damage, flooding/fire boundaries, sensor/weapons integration, carrier deck cycles and logistics.
