# Ballistics and missile dynamics source area

**Status: folder marker and design notes only. No ballistics implementation code was added for this task.**

Future translational and rigid-body trajectory solvers belong here.

Planned model classes:

- Point-mass trajectory approximation for explicitly low-fidelity uses.
- 3-DoF translational missile/projectile model with declared attitude/control simplifications.
- 6-DoF rigid-body dynamics with attitude, body rates, inertia, aerodynamic forces/moments, control-surface actuators and mass/CG evolution.
- Powered flight and motor staging with product-specific thrust/mass-flow histories.
- Release/separation, gravity, air-relative motion, drag, lift/side force, wind and environment interaction where supported.

The canonical requirements owner is [physics/ballistics](../../../../physics/ballistics/README.md). Guidance supplies commands; this solver determines achieved motion. Weapon profiles provide variant-specific coefficients and motor data.

A model must declare its degrees of freedom, validity envelope, step-size requirements and evidence status. A 3-DoF model must not be described as a 6-DoF simulation.
