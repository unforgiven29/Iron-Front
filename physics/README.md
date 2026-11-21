# Shared physics and numerical services

Physics owns reusable physical equations, numerical integration and physical queries. Platform/content packages provide exact geometry, mass, material, coefficients, equipment fit and installation data. Physics does not own mission rules, AI decisions, sensor modes, campaign outcomes or rendering.

## Domains
- flight-model: aircraft-specific composition of surface elements, coefficient datasets, control/actuator state, propulsion installation and force/moment contributions. It does not own the rigid-body integrator or duplicate aerodynamic/engine solvers.
- rigidbody: 6-DoF state, force/moment accumulation, inertia and integration.
- aerodynamics: local surface flow, coefficient evaluation and aerodynamic loads.
- environment: atmosphere, winds, turbulence and weather fields.
- propulsion: reusable engine/motor family behavior.
- collision: broad/narrow physical contacts and collision queries.
- ballistics: projectile trajectory and aerodynamic effects.
- armour: impact, penetration, ricochet, spall and behind-armour effects.
- ground-mobility: track/wheel traction, drivetrains, suspension and terrain.
- thermal: reusable heat-transfer and thermal-state calculations.
- optics: optical path transmission/attenuation.
- radar: RF geometry, propagation, scattering and clutter.

## Model contract
Each model documents owner, inputs/outputs, SI units, frames, operating envelope, fidelity tier, uncertainty, numerical stability and provenance. Shared logic may not branch on aircraft/weapon name. Configuration selects data/capabilities; it does not create per-platform algorithm copies.

## Coupling
The flight-model assembly composes the aircraft-specific surface/configuration graph and submits force/moment contributions to rigidbody. Aerodynamics owns local-flow/coefficient equations; propulsion owns engine-family behavior; aircraft packages provide installation/data. Flight-model assembly does not integrate motion.

Rigid body integrates forces supplied by aero, propulsion, gravity and contact. Environment supplies ambient fields. Systems supply resources. Collision returns physical contacts. World supplies geometry/material input. Sensors consume propagation/optics but own receiver/detection logic.

## Validation
Dimensional analysis, limiting cases, stability/conservation where relevant, analytical references, failure/boundary cases, timestep sensitivity, deterministic replay and representative browser performance. Do not call approximations CFD, full-wave EM or finite-element armor without validated solvers.
