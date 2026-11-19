# MiG-29 Product 9.13 — Flight Model

Build an aircraft-specific 6-DoF model; do not reuse F-16 aerodynamic coefficients or FLCS. The MiG-29 has a distinctive integral wing/body layout, leading-edge extensions, twin tails, twin engines and a different control/stability-augmentation architecture.

Causal path: pilot controls → mechanical/hydraulic control path and stability augmentation → actuator position → local airflow → aerodynamic loads → rigid-body integration. Model left/right RD-33 engines independently so asymmetric thrust, damage and flameout have consequences.

Collect geometry, surface stations, mass/CG/inertia, spine tank and fuel locations, Mach/AoA/sideslip/control-dependent aero coefficients, control-system behavior, high-AoA/departure envelope, engine installation, gear/flaps/airbrakes and store effects. Do not assume exact control-law schedules or post-stall behavior without data.

Validation: mass properties; trim/stability/control; aero trends; engine transient/asymmetric thrust; fuel and spine-tank CG shift; hydraulic/electrical faults; stores and gear; deterministic replay.

Sources: [Eagle Dynamics MiG-29 Flight Manual](https://www.digitalcombatsimulator.com/upload/iblock/463/DCS%20MIG-29%20Flight%20Manual%20EN.pdf) (its 9-13 representation is MiG-29S); [AirWingMedia variant overview](https://airwingmedia.com/downloads/mikoyan-mig-29-fulcrum-pdf-ebook-flight-manuals/); [NPS archive report](https://calhoun.nps.edu/server/api/core/bitstreams/eeeed8aa-eee4-4ca5-abee-b74c2891194b/content) (check variant applicability).
