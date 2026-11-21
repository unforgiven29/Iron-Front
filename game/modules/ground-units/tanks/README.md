# Tank platform modules

A tank module describes one exact vehicle variant and its installed configuration; it does not implement a private vehicle physics engine.

## Platform-owned data
Hull/turret geometry and reference datum; mass/CG/inertia and fuel/ammo placement; track/sprocket/road-wheel/idler configuration; suspension; engine/transmission/final drive; armour layer map; turret ring/gun/loader/stabilizer; sights/rangefinder/thermal/radar if fitted; crew stations/protected volumes; ammunition stowage; electrical/hydraulic/cooling topology; damage routing; smoke/APS/communications and source provenance.

## Hit-by-hit armour and internal effects
Each impact is evaluated at a located plate/zone with incoming direction, local surface normal, impact angle, projectile/warhead type, velocity/energy and the variant's layered material/geometry data. Report the struck area (for example hull/turret face, roof or track), penetration/ricochet/defeat result and downstream effects only when the shared physics model supports them.

Layered arrays can include rolled or cast armour, spaced plates, composite arrays, explosive reactive armour, non-explosive reactive elements and spall liners. ERA response is a physical layer interaction with limited coverage/consumable state; tandem-charge interaction differs from single-charge interaction. Kinetic and shaped-charge effects are not interchangeable. Internal layout maps penetrations to crew spaces, engine, transmission, tracks, gun, optics, fuel and ammunition. Ammunition stowage/protection (including carousel or separated bustle/blow-off arrangements) must be variant-specific and sourced, not assigned by broad nationality stereotypes.

A mobility kill, firepower kill, sensor/communications loss, crew casualty, fire, ammunition cook-off and total loss are distinct outcomes. A hit overview diagram is a presentation of the authoritative impact/effect record; it does not calculate armour itself.

## Shared services
Ground mobility computes traction/drivetrain/suspension; rigidbody integrates motion; collision handles contact; ballistics computes rounds; armour evaluates impact/penetration; fire-control supplies estimates; sensors produce reports; systems/resources and damage own state transitions. Platform config connects these systems.

## Behavior constraints
Turret movement and gun elevation have rate/limit/stabilization constraints. Recoil feeds reaction forces. Reload consumes time/ammunition and crew/loader capability. Sights have actual FOV/range/thermal/LOS limitations. AI cannot use hidden target coordinates.

## Validation
Mobility/gradeability/turn/braking, turret slew/stabilization, gun recoil, reload/ammo, sight error/obscurants, impacts from multiple aspects/ammunition types, layered armour/ERA/liners, component routing, crew consequences, fire/cook-off, resource faults, damage isolation and representative load.
