# Naval platform modules

Ship packages own exact hull variant, displacement/draft, geometry, mass/CG/inertia, propulsion/shaft/rudder installation, fuel/electrical/cooling topology, compartments/bulkheads, crew, sensors, antennas, weapons, communications, damage-control, aircraft/deck interface and provenance. Shared rigidbody/collision/propulsion/damage/sensor/weapon services remain external.

## Platform families
Support surface combatants, escorts, frigates/destroyers/cruisers, amphibious ships, auxiliaries, carriers, merchant/civil vessels and submarines as distinct exact variants. A submarine is not a surface ship with a visibility flag: buoyancy/trim, depth, propulsion/energy, acoustic signature, mast/periscope, underwater sensors, weapons and communications are separate installed capabilities. See [subsurface and maritime operations](subsurface-and-maritime-operations/README.md).

## Maritime operations
Fleet/formation composition, carrier groups, escort and merchant convoys, replenishment, patrol, sea control, blockade, anti-submarine warfare, anti-ship strike, amphibious approach/landing and port access are mission/strategic behaviors. Sea control is an estimate/derived state from available forces, location, readiness, sensor picture and losses, not a permanent ownership bit. Convoys carry typed cargo and use route capacity/time; interdiction reduces actual deliveries.

## Physical and operational boundary
World owns water/coast/bathymetry. Naval movement requires physical force/propulsion and supported hydrodynamic/sea-state models; do not directly animate ship position as authoritative movement. Damage control owns compartment flooding/fire/isolation; crew and campaign personnel own human outcomes. Carrier operations coordinate deck/catapult/arresting and aircraft handling but do not own aircraft flight physics.

Validate turning/stopping, draft/grounding, loading, propulsion/rudder damage, flooding/fire boundaries, sensor/weapons integration, submarine state, convoy cargo/route loss, sea control, blockade/port throughput, carrier deck cycles and logistics.
