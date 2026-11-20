# Rigid-body dynamics and 6-DoF integration

**Owner:** physics/rigidbody. **Status:** architecture only; no full solver exists.

Own authoritative position, velocity, attitude and angular state, mass properties and integration. Do not generate aero/engine force, own flight controls, infer collision from render meshes or use render delta.

State includes world-frame position/velocity, body-to-world quaternion, body angular velocity, mass, CG and inertia tensor about a declared datum. Domain systems submit forces/moments with application point/frame; solver transforms/sums deterministically, includes gravity and integrates. Fuel/stores/damage mass-property contributions are supplied at a defined phase.

Choose and document integration method/order, quaternion update/normalization, gyroscopic treatment, contact coupling, fixed step and stability limits. Publish authoritative tick snapshots; rendering interpolates outside solver.

Validate analytic free-particle/constant-acceleration/ballistic cases, torque-free rotation, gravity axis, inertia positive definiteness, energy/momentum drift, changing mass/CG, coordinate mapping, timestep convergence and replay.
