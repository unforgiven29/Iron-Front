# Ground vehicle and weapon-system modules

Platform packages own exact vehicle variant, geometry, mass/CG/inertia, suspension layout, engine/transmission fit, armour layers, crew, weapon stations/sights, communications, ammunition stowage, damage routing, animations and provenance. Shared mobility, rigidbody, collision, ballistics, armour, sensors, resources and damage engines remain outside.

## Families and integration
Families: tanks; IFV/APC; artillery; air-defence; and shared platform contracts. Air-defence may be one integrated vehicle or separate search/engagement radar, command post, launcher and support vehicles. Artillery may be self-propelled, towed or rocket artillery; exact setup, fire-control, crew, ammunition and mobility are variant-specific.

Ground forces connect to infantry dismounts, squad transport, forward observation, artillery fire missions, air-defence coverage, logistics, command posts, fortifications and campaign front sectors. A unit is not only a map counter: crew, carried stores, fuel, readiness, damage, repair, morale and command link affect behavior. Campaign strategic strength is a projection of these unit states/records, not a second hidden total.

AI receives observations/orders, not hidden enemy state. Movement emerges from track/wheel traction, terrain, powertrain, suspension and contact. Weapons use launcher/fire-control contracts; armour effects use shared physics.

Validate acceleration/braking/gradeability, turning, suspension, terrain, recoil/stabilization, fire-control, armour impact, crew consequences, system loss, ammo/fuel use, repair, dismount/embark and representative entity counts.
