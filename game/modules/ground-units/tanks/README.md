# Tank platform modules

A tank module describes one exact vehicle variant and its installed configuration; it does not implement a private vehicle physics engine.

## Platform-owned data
Hull/turret geometry and reference datum; mass/CG/inertia and fuel/ammo placement; track/sprocket/road-wheel/idler configuration; suspension; engine/transmission/final drive; armor layer map; turret ring/gun/loader/stabilizer; sights/rangefinder/thermal/radar if fitted; crew stations/protected volumes; ammunition stowage; electrical/hydraulic/cooling topology; damage routing; smoke/APS/communications and source provenance.

## Shared services
Ground mobility computes traction/drivetrain/suspension; rigidbody integrates motion; collision handles contact; ballistics computes rounds; armour evaluates impact/penetration; fire-control supplies estimates; sensors produce reports; systems/resources and damage own state transitions. Platform config connects these systems.

## Behavior constraints
Turret movement and gun elevation have rate/limit/stabilization constraints. Recoil feeds reaction forces. Reload consumes time/ammunition and crew/loader capability. Sights have actual FOV/range/thermal/LOS limitations. AI cannot use hidden target coordinates.

## Validation
Mobility/gradeability/turn/braking, turret slew/stabilization, gun recoil, reload/ammo, sight error/obscurants, armor impacts at multiple aspects, crew consequences, resource faults, damage isolation and representative load.
