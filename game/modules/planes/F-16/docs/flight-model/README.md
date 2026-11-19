# F-16C Block 50 — Flight Model

Model as a six-degree-of-freedom rigid body with aircraft-specific nonlinear aerodynamic data and a digital fly-by-wire flight-control system. Do not use a generic fighter handling multiplier.

Causal path: pilot stick/pedal → FLCS command shaping and limiters → hydraulic/electrical resource availability → actuator motion → actual surface deflection → local surface airflow → aerodynamic force/moment → 6-DoF integration.

Collect: wing/LEX/tail/fuselage geometry; surface hinge axes and travel; mass/CG/inertia; fuel/store locations; Mach/AoA/sideslip/control-dependent lift, drag and moments; control laws and actuator limits; ground effect; high-AoA/stall/departure data; gear/flap/store/damage effects.

Keep commanded and actual surface positions separate. Include local rotational velocity (`omega × r`) and atmosphere/wake at each surface. Fuel burn, transfer, store release and damage change mass properties. Record the validity envelope and provenance for every dataset. Unknown FLCS gains and aerodynamic coefficients stay unknown or are clearly labeled estimates.

Validation: mass/CG/inertia; trim; control response; actuator limits; aero trends; acceleration/climb/turn/energy; fuel and stores; failures; deterministic replay and timestep convergence.

Sources: [Falcon BMS F-16C/D Flight Manual 4.38](https://cdn.falcon-bms.com/docs/4.38/TO%201F-16CMAM-1%20BMS.pdf) (multiple blocks; isolate Block 50); [USAF F-16 fact sheet](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104505/f-16-fighting-falcon/); [F-16.net Block 50/52 overview](https://www.f-16.net/f-16_versions_article9.html) (secondary).
