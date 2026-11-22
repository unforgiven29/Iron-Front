# Ballistics and projectile trajectory physics

**Owner:** physics/ballistics. **Status:** an initial deterministic 3-DoF missile point-mass integrator is in `game/src/physics/ballistics/MissileDynamics.ts`, including staged thrust/mass flow, Mach drag, wind/gravity and bounded normal-acceleration response. This is not a general projectile library or a 6-DoF missile/body solver.

**Research:** [Weapons, ballistics and effects reference guide](../../docs/reference-library/weapons-ballistics-and-effects.md) provides guidance, small-arms and test-standard references with explicit cautions about model class, variant applicability and simulator-only data.

Calculate projectile motion from release state and physical forces. Weapon packages supply exact mass, geometry, drag/coefficient data, motor profile and configuration. Guidance supplies bounded commands from physics/guidance; weapon runtime owns post-release lifecycle and component composition. Guidance must not edit trajectory state directly.

Declare model class explicitly: point-mass, 3-DoF or 6-DoF. Point-mass treats the weapon as a translational body with simplified attitude/control; 3-DoF resolves translational trajectory and uses a simplified steering/drag response; 6-DoF resolves attitude/angular dynamics and the full configured rigid-body mass/inertia/force/moment system. State which degrees of freedom, control-surface dynamics, actuator limits and coupling are omitted. A point-mass model cannot claim spin, yaw-of-repose, gyroscopic stability or full projectile attitude. Include gravity, air-relative velocity, drag, wind, density/Mach effects, lift/side-force only when supported, powered phase/staging, spin/dispersion only when modeled.

Launcher supplies actual release position/velocity/orientation and separation impulse. Store release alters carrier mass/CG/drag. No hidden target correction belongs in ballistic solver. Test vacuum/analytic gravity, wind drift, drag, Mach trends, gun dispersion, bomb release, rocket thrust phase, swept impacts and timestep sensitivity.
