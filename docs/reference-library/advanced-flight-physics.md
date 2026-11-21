# Advanced flight physics — focused research references

**Purpose:** Provide Claude with research routes for the advanced dynamic flight-model recommendations: aeroelasticity, unsteady aerodynamics/dynamic stall, transonic compressibility, vortices/flow interaction, engine-inlet/airframe coupling and aircraft ground handling.

These references explain physical mechanisms, modeling methods or test approaches. Most are generic, research-configuration or civil-aircraft sources. **None is an F-16C Block 50 or MiG-29 product 9.13 aerodynamic dataset unless the exact source explicitly says so.** Follow the exact-aircraft applicability rules in the platform evidence program.

## 1. Aeroelasticity, structural flexibility and fatigue

### Introduction to Aircraft Aeroelasticity and Loads — Wright and Cooper

- [Wiley publisher page and contents](https://www.wiley.com/en-us/introduction-to-aircraft-aeroelasticity-and-loads-2nd-edition-p-9781118700440)

**Useful for:** static/dynamic aeroelasticity; bending/torsion; structural/aerodynamic model coupling; flutter; modal response; flight-maneuver/gust loads; ground-maneuver loads; ground vibration testing; flight-flutter and flight-load validation.

**Limitations:** commercial textbook. Use it to understand model formulation and validation requirements, not as aircraft-specific stiffness, damping, mass or flutter-boundary data.

### ERAU — Unsteady Aerodynamics, Aeroelasticity and Flutter

- [Open textbook chapter](https://eaglepubs.erau.edu/introductiontoaerospaceflightvehicles/chapter/unsteady-aerodynamics-flutter/)

**Useful for:** structural modes, aerodynamic/structural coupling, modal frequency and damping, time-domain/frequency-domain analysis, and the concept that flutter is a coupled instability when net structural-aerodynamic damping becomes negative.

**Limitations:** educational treatment; aircraft-specific structural modes and flutter boundaries still require applicable platform test data.

### FAA AC 25.571-1B — Damage-Tolerance and Fatigue Evaluation

- [FAA PDF](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_25.571-1B.pdf)

**Useful for:** fatigue spectra, crack initiation/growth concepts, inspections, damage-tolerance evidence, and the need to include flight gust/maneuver loads plus taxi, landing, turning, braking and towing loads in a lifetime loading spectrum.

**Limitations:** civil transport certification guidance, not a fighter structural-life manual. Borrow the evidence and load-accounting discipline, not fighter-specific thresholds.

### 14 CFR 25.341 — Gust and turbulence loads

- [2025 U.S. Code of Federal Regulations text](https://www.govinfo.gov/content/pkg/CFR-2025-title14-vol1/xhtml/CFR-2025-title14-vol1-sec25-341.html)

**Useful for:** dynamic analysis of gust loads, unsteady aerodynamics and significant structural degrees of freedom.

**Limitations:** civil transport-aircraft certification requirements. Not an F-16/MiG-29 structural limit source.

## 2. Unsteady aerodynamics and dynamic stall

### NASA — Important Effects of Dynamic Stall

- [NASA report PDF](https://ntrs.nasa.gov/api/citations/19880013872/downloads/19880013872.pdf?attachment=true)

**Useful for:** stall delay relative to static stall, force/moment overshoot, hysteresis and the dependence of dynamic-stall response on section geometry, Mach, Reynolds number and motion amplitude/frequency.

**Limitations:** general mechanism/reference, not a fighter-specific dynamic-stall model calibration.

### Hansen, Gaunaa and Aagaard Madsen — Beddoes–Leishman-type state-space and indicial models

- [Risø-R-1354(EN) report PDF](https://backend.orbit.dtu.dk/ws/files/7711084/ris_r_1354.pdf)
- [Bibliographic record and abstract](https://orbit.dtu.dk/en/publications/a-beddoes-leishman-type-dynamic-stall-model-in-state-space-and-in/)

**Useful for:** a detailed example of stateful unsteady aerodynamic modeling, attached-flow response, delayed separation, trailing-edge shed vorticity, dynamic-stall vortex contributions, state-space implementation and comparison with alternative formulations.

**Limitations:** developed in wind-energy/airfoil context. It is a methods reference; its parameters cannot be applied to fighter wings without airfoil/Mach/Reynolds/kinematic validation.

### NASA — Numerical Simulation of Unsteady Aerodynamic Models

- [NASA NTRS record 20020047009](https://ntrs.nasa.gov/search.jsp?R=20020047009)

**Useful for:** numerical accuracy/efficiency and robustness of Wagner/Küssner indicial methods and Leishman–Beddoes dynamic-stall model implementations.

**Limitations:** model/numerical study, not platform data.

### Contemporary review — Beddoes–Leishman model calibration

- [2024 review PDF](https://iris.cnr.it/retrieve/ae45871e-5b73-41d8-8e7e-8d29d9d0d31a/RSER2024_compressed.pdf)

**Useful for:** understanding model blocks, calibration pitfalls and how attached flow, separation and vortex contributions are combined.

**Limitations:** review and model-family discussion; choose parameters only with appropriate underlying data.

## 3. Vortices, LEX/LERX, forebody flow and tail interaction

### NASA — LDV surveys over a fighter model at moderate/high AoA

- [NASA report PDF](https://ntrs.nasa.gov/api/citations/20040161542/downloads/20040161542.pdf)

**Useful for:** measured three-component velocity fields over a twin-tailed fighter research configuration at 15° and 25° AoA; demonstrates that LEX vortices can convect past or burst near the vertical tails as AoA changes.

**Limitations:** the study is a research model, not the MiG-29 product 9.13 or F-16C Block 50. It supports the need to model local vortex/tail flow, not the exact vortex strength or location for these aircraft.

### NASA — Wind-tunnel study of LEX modifications and tail buffet on F/A-18

- [NASA NTRS report 19910062564](https://ntrs.nasa.gov/citations/19910062564)

**Useful for:** linking LEX geometry to vortex strength/position/breakdown, high-AoA aerodynamic behavior and vertical-tail buffet. It also demonstrates that aerodynamic and structural consequences should be considered together.

**Limitations:** F/A-18 research model only. Do not transfer its LEX geometry or coefficients to F-16/MiG-29.

### NASA — High-AoA F-16 configuration research

- [NASA NTRS report PDF](https://ntrs.nasa.gov/api/citations/19950007840/downloads/19950007840.pdf)

**Useful for:** a study of modified F-16 configurations, forebody/LEX vortices and directional stability concerns at high AoA.

**Limitations:** the paper discusses modified high-AoA research configurations including shortened LEX, larger speedbrake and forebody modifications. It is not the standard production F-16C Block 50. Use it to identify mechanisms and warnings, never to assign its improved behavior to the stock aircraft.

## 4. Compressibility, transonic shocks and buffet

### AIAA — Studies of Transonic Aircraft Flows and Prediction of Initial Buffet Using LES (2025)

- [AIAA paper DOI](https://doi.org/10.2514/1.C038129)

**Useful for:** shock-induced separation, transonic boundary-layer behavior, grid/topology sensitivity and buffet-onset prediction in a modern research CFD study.

**Limitations:** NASA Common Research Model and NACA airfoil examples, not a fighter-specific database. LES/CFD requirements are not a browser implementation recommendation. Use it to understand physical effects and validation sensitivity.

### NASA — Fighter maneuver and buffet characteristics

- [NASA technical note PDF](https://ntrs.nasa.gov/api/citations/19730017272/downloads/19730017272.pdf?attachment=true)

**Useful for:** the interaction among high-subsonic/transonic maneuverability, lift limits, buffet onset, pitch-up, wing rock and nose-slice behavior; also discusses the role of flaps/slats and planform.

**Limitations:** research configurations and historical study. Do not use its numeric curves as modern aircraft performance data.

### NASA TP-2125 — Experimental study of leading-edge devices

- [NASA PDF](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19830013891.pdf)

**Useful for:** wind-tunnel effects of leading-edge flaps and vortex generators on subsonic/transonic high-lift drag and flow behavior.

**Limitations:** a supercritical-wing maneuvering-fighter research configuration, not either selected aircraft.

## 5. Engine inlet, installed propulsion and airframe interaction

### NASA Glenn — Inlet performance model

- [NASA inlet performance and spillage drag](https://www.grc.nasa.gov/www/k-12/airplane/tunmodinlt.html)
- [NASA inlet performance and distortion](https://www.grc.nasa.gov/www/k-12/airplane/inleth.html)

**Useful for:** pressure recovery, inlet mass-flow matching, spillage drag, angle-of-attack/yaw effects, boundary-layer interaction and inlet distortion at the engine face.

**Limitations:** educational generic inlet material. It explains mechanisms, not the F-16 inlet or MiG-29 intake schedule/limits.

### NASA — Summary of investigations of engine response to distorted inlet conditions

- [NASA report PDF](https://ntrs.nasa.gov/api/citations/19860016864/downloads/19860016864.pdf)

**Useful for:** why nonuniform inlet flow affects engine stability, available power and compressor surge margin; includes aircraft/rotorcraft sources of inlet distortion and ingestion.

**Limitations:** broad research summary; platform-specific distortion tolerance and engine response must come from exact engine/inlet evidence.

### NASA — Flow control for engine-face distortion

- [NASA NTRS report 20050192094](https://ntrs.nasa.gov/citations/20050192094)

**Useful for:** sources of inlet distortion including maneuvering separation, shock/boundary-layer interaction, forebody boundary layers, wakes and inlet-duct curvature.

**Limitations:** research summary, not a specific engine or aircraft performance map.

## 6. Aircraft landing gear, tires and ground handling

### NASA — Application of tire dynamics to aircraft landing-gear design analysis

- [NASA NTRS record 19830013123](https://ntrs.nasa.gov/citations/19830013123)
- [NASA PDF](https://ntrs.nasa.gov/api/citations/19830013120/downloads/19830013120.pdf)

**Useful for:** tire parameters required to analyze shimmy, braking, anti-skid, gear walk, chatter, rough-terrain loads and landing-gear dynamics.

**Limitations:** 1983 research, not the exact tire/gear data for either selected fighter.

### NASA TM-X-3561 — Landing-gear dynamic characteristics

- [NASA report PDF](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19780003109.pdf)

**Useful for:** static/dynamic test methods for gear spring rates, axial friction, brake torque and tire force/deflection, including drop tests and strut effects.

**Limitations:** light-aircraft test configuration. Apply the experimental method, not the measured numerical values, to fighter landing gear.

## 7. Source integration rules

- These references are added to select model architecture, identify state variables, design test cases and understand physical couplings.
- They are not a substitute for exact F-16C Block 50 or MiG-29 product 9.13 manuals, flight-test reports, geometry, coefficient data or system schematics.
- Preserve aircraft identity, configuration, units, frame, source page, test conditions, uncertainty and applicability for every platform value.
- Research papers often describe a model or research aircraft, not a production aircraft. Mark that distinction explicitly.
- Do not claim flutter prediction, dynamic-stall fidelity, shock resolution or inlet surge prediction unless the implemented model and its validation support that claim.
- Link each adopted datum to a source record and each implemented effect to a validation case.
