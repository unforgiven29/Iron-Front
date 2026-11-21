# MiG-29 product 9.13 — aerodynamic coefficient data

**Owner:** MiG-29 aircraft data package. Generic coefficient schema/interpolation is physics/flight-model/coefficient-data; equations are physics/aerodynamics. **Status:** no authoritative product 9.13 coefficient dataset is populated.

## Required data families

Research data for whole-aircraft lift/drag/side force, roll/pitch/yaw stability derivatives, control effectiveness for all-moving horizontal tails/ailerons/rudders, Mach effects, AoA and sideslip behavior, high-AoA/LERX-vortex interactions, flap/slat increments, store/gear configuration and ground effect if supported. Identify whether values are measured, wind-tunnel/flight-test derived, source-estimated or synthetic.

Do not create a generic MiG-29 table. Product 9.12, enlarged-spine 9.13, 9.13S, export variants and later upgrades may differ in geometry, mass, engine and control schedules.

## Required table metadata

Each coefficient table declares meaning/sign, units, axis definitions, reference area/span/chord, coordinate convention, discrete configuration identity, interpolation/extrapolation policy, valid envelope, uncertainty, source document/revision/page/test setup and exact applicability. Dimensional vs normalized stability derivatives must be distinguished.

## Research and validation order

Freeze product 9.13 geometry and mass/CG baseline first. Then identify traceable coefficient/reference material and its actual variant. Where exact public data is unavailable, limit the validated envelope and maintain explicit uncertainty. Synthetic data is for unit tests only.

Tests cover knot retrieval, interpolation, dimensional consistency, derivatives/signs, domain behavior, configuration separation, provenance validation and independent reference comparisons.
