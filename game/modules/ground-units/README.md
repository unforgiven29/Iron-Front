# Ground vehicle and weapon-system modules

Platform packages own exact vehicle variant, geometry, mass/CG/inertia, suspension layout, engine/transmission fit, armor layers, crew, weapon stations/sights, comms, ammo stowage, damage routing, animations and provenance. Shared mobility, rigidbody, collision, ballistics, armor, sensors, resources and damage engines remain outside.

Families: tanks; IFV/APC; artillery; air-defence; shared platform contracts. AI receives observations/orders, not hidden enemy state. Movement emerges from track/wheel traction, terrain, powertrain, suspension and contact. Weapons use launcher/fire-control contracts; armor effects use shared physics.

Validate acceleration/braking/gradeability, turning, suspension, terrain, recoil/stabilization, fire-control, armor impact, crew consequences, system loss, ammo/fuel use, repair and representative entity counts.
