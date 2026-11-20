# Ballistics and projectile trajectory physics

**Owner:** physics/ballistics. **Status:** architecture only; no general ballistic solver is implemented.

Calculate projectile motion from release state and physical forces. Weapon packages supply exact mass, geometry, drag/coefficient data, motor profile and configuration. Guidance supplies commands; weapon runtime owns post-release state.

Declare model class explicitly: point-mass, 3-DoF or 6-DoF. A point-mass model cannot claim spin, yaw-of-repose, gyroscopic stability or full projectile attitude. Include gravity, air-relative velocity, drag, wind, density/Mach effects, lift/side-force only when supported, powered phase/staging, spin/dispersion only when modeled.

Launcher supplies actual release position/velocity/orientation and separation impulse. Store release alters carrier mass/CG/drag. No hidden target correction belongs in ballistic solver. Test vacuum/analytic gravity, wind drift, drag, Mach trends, gun dispersion, bomb release, rocket thrust phase, swept impacts and timestep sensitivity.
