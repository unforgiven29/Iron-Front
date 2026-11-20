# Ground-unit module architecture

Each tank, IFV, APC, artillery platform, air-defence vehicle and support vehicle is a variant-specific module over shared mobility, rigid-body/contact, ballistics, armour, optics, sensors, damage and resource services.

## Platform ownership

A platform package owns exact geometry, mass/CG/inertia, track/wheel layout, suspension, engine/transmission fit, armour layout, crew stations, weapon stations, sights/sensors, communications, ammunition stowage, damage routing, animations and source provenance. Shared engines own reusable calculations.

## Behavior domains

Model track/wheel traction, steering, braking and drivetrain limits; suspension travel/damping; terrain slope/surface/obstacle/water effects; turret and weapon stabilization; optics/thermal sights/rangefinding limitations; armour impact/penetration/spall/internal effects; crew visibility/workload/injury/incapacitation; fuel/electrical/cooling/ammunition/maintenance; and damage/repair state.

Infantry behavior, suppression, morale and personal equipment belong to infantry modules and shared contracts, not tank-specific logic.

## Information and AI

Ground AI receives sensor observations, communications and orders like other units. It must not use hidden world positions or know it has been detected unless a sensor/communication path supports that knowledge.

## Validation

Validate acceleration/braking, gradeability, steering, suspension, traction/bogging, recoil/stabilisation, weapon accuracy, armour impacts, crew effects, resource failures, damage isolation and representative unit counts.

**Status:** Architecture and folder structure only.
