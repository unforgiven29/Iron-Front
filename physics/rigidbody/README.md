# Rigid-body dynamics and 6-DoF integration

**Owner:** physics/rigidbody. **Status:** 6-DoF state, force/moment contract and fixed-step integrator implemented in `game/src/physics/rigidbody/RigidBody.ts` (tests: `game/tests/unit/RigidBody.test.ts`). Not yet implemented: contact/constraint coupling, CG-offset datum transforms when the CG moves, Earth rotation and curvature, and wiring into the scheduler by a real vehicle.

## Implemented contract
- **Frames:** world local ENU in metres. Body FRD with its origin at the CG. Attitude is a unit quaternion `[x,y,z,w]` mapping body to world. Angular velocity is in body FRD, rad/s.
- **Mass properties:** mass > 0. The inertia tensor about the CG in body axes must be symmetric and positive definite, and its principal moments must satisfy the triangle inequality. Anything else is rejected. Mass properties may change only between steps.
- **Loads:** each `ForceContribution` gives a source id, a frame (`world.enu`/`body.frd`), a force in N and an optional application point from the CG. Each `MomentContribution` gives a source id, a frame and a moment in N·m. Contributions are summed in source-id order. Duplicates and non-finite values are rejected. Off-CG forces add `r × F`. Gravity is supplied per step by the environment owner as a world-ENU acceleration. The rigid body has no built-in gravity constant.
- **Integration:** classical RK4 over one fixed step, with loads held constant across the step. Euler's equations include the gyroscopic term `ω × Iω`. The quaternion is renormalized every step, and a non-finite result throws instead of being propagated.
- **Verified:**
  - Free-particle and analytic ballistic motion are exact.
  - F = ma works in both frames, and `r × F` and couples are correct.
  - Load sums don't depend on input order.
  - Torque-free principal-axis spin stays constant.
  - In 20 s of intermediate-axis tumbling (the axis visibly flips), rotational energy and world angular momentum drift by less than 1e-6 relative.
  - Halving the step cuts the error by about 16×, as expected for 4th-order accuracy.
  - Invalid mass properties and states are rejected.

Own authoritative position, velocity, attitude and angular state, mass properties and integration. Do not generate aero/engine force, own flight controls, infer collision from render meshes or use render delta.

State includes world-frame position/velocity, body-to-world quaternion, body angular velocity, mass, CG and inertia tensor about a declared datum. Domain systems submit forces/moments with application point/frame; solver transforms/sums deterministically, includes gravity and integrates. Fuel/stores/damage mass-property contributions are supplied at a defined phase.

Choose and document integration method/order, quaternion update/normalization, gyroscopic treatment, contact coupling, fixed step and stability limits. Publish authoritative tick snapshots; rendering interpolates outside solver.

Validate analytic free-particle/constant-acceleration/ballistic cases, torque-free rotation, gravity axis, inertia positive definiteness, energy/momentum drift, changing mass/CG, coordinate mapping, timestep convergence and replay.
