# Weapon body, aerodynamics and mass properties

**Owner:** weapon product profile; shared force/trajectory solvers remain physics/ballistics, physics/aerodynamics and physics/rigidbody. **Status:** architecture only.

This component defines the physical vehicle that flies after release. It is not a seeker or guidance algorithm. Geometry, mass distribution, coefficients and control-surface layout are versioned product data; shared physics computes the resulting motion.

## Immutable product data

Every weapon/variant defines:
- Body geometry, reference datum, length/diameter, external shape and wetted/reference areas where supported.
- Dry/propellant/warhead/component masses and their locations.
- Centre of mass and inertia tensor as functions of stage, propellant depletion or payload configuration where those values are known.
- Fin/canard/control-surface geometry, hinge axes, travel limits and aerodynamic reference points.
- Drag/lift/side-force/moment datasets over the valid Mach/AoA/deflection envelope.
- Nose/forebody and body lift/drag, base drag and installation effects only as supported by data.
- Thermal/material/structural limits and damage-zone mapping.
- Exact product, lot/block, variant and source provenance.

## Model fidelity selection

Declare the trajectory/vehicle model explicitly:
- **Point mass:** translational position/velocity with simplified drag/thrust/guidance response. No claim of resolved attitude, fin dynamics or body angular motion.
- **3-DoF:** translational trajectory with simplified orientation/control response or assumed alignment. State which attitude and control dynamics are omitted.
- **6-DoF:** translational and rotational rigid-body state with full mass/inertia, aerodynamic moments, angular dynamics, control surfaces and actuator limits.

A model cannot claim 6-DoF simply because the missile has a quaternion in its state. If its moments, inertia, fins or actuator dynamics are absent, label the omissions.

## Runtime state

Track mass and propellant remaining, CG/inertia, attitude/rates where modeled, air-relative flow, Mach/AoA/sideslip where modeled, surface positions, motor stage, structural health, temperature and damage. Propellant burn can shift CG/inertia; motor burnout changes mass and thrust. Warhead/booster separation or staged motor changes the physical configuration only when fitted.

## Force ownership

Thrust is supplied by physics/propulsion; airloads by physics/aerodynamics or the selected ballistics model; gravity/environment by physics/environment; guidance requests from physics/guidance; actual motion by the selected trajectory integrator. Do not add the same drag/thrust in both weapon code and the shared solver.

## Validation

Test geometry/mass/inertia consistency; CG movement with burn/staging; aerodynamic coefficient validity and boundary handling; control-surface force/moment; thrust alignment; asymmetry/damage; declared model tier; and trajectory convergence. Synthetic values are test-only, not weapon data.
