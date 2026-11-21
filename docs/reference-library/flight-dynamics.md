# Flight dynamics and aircraft-specific flight models

**Read with:** `physics/rigidbody/README.md`, `physics/aerodynamics/README.md`, `physics/flight-model/README.md`, `physics/propulsion/README.md`, `docs/flight-model/README.md` and the exact aircraft's flight-model dossier.

## Core architecture question

The F-16 and MiG-29 must have separate aircraft-specific flight models. Share numerical tools, frame transforms, integration methods, atmosphere queries and typed force/moment interfaces—not a universal coefficient set, control response, panelization or handling curve. Different aircraft may need different model representations. Reuse a mathematical component only when its assumptions and validity apply.

The physical chain to research is:
`mass properties + aircraft configuration + actual actuators + engine installation + atmosphere/local flow → surface/component forces and moments → rigid-body equations → updated aircraft state`.

Do not use pilot input to directly set pitch, bank, speed or altitude. Do not make the renderer authoritative.

## Open flight-dynamics implementation reference

### JSBSim — data-driven nonlinear 6-DoF FDM

- [JSBSim project](https://jsbsim.sourceforge.net/)
- [Current JSBSim reference manual](https://jsbsim-team.github.io/jsbsim-reference-manual/)
- [Programmer/formulation and aircraft-model documentation](https://jsbsim-team.github.io/jsbsim-reference-manual/preface/)
- [Source repository](https://github.com/JSBSim-Team/jsbsim)

**Use for:** studying a mature data-driven FDM structure, aircraft-specific XML configuration, nonlinear 6-DoF equations, flight controls, propulsion, landing gear, logging and how different aircraft can be configured without hardcoding every platform into the common runtime. Read the programmer and formulation portions, not just the aircraft examples.

**Critical limitations:** JSBSim is a C++ library/application, not a browser-native TypeScript dependency. The project states that its included military/commercial aircraft data are approximations derived from public information for education/entertainment, not proprietary engineering datasets. Its license is LGPL; review and comply with it before incorporating any code. Use it to study architecture, test fixtures and equation organization—not as proof of F-16C Block 50 or MiG-29 product 9.13 performance, and not as a universal flight model.

### UIUC Airfoil Coordinates Database

- [University of Illinois Airfoil Data Site](https://m-selig.web.engr.illinois.edu/ads/coord_database.html)

**Use for:** public 2D airfoil coordinate datasets when building generic aero geometry tools, visualizing sections or validating coordinate ingestion/interpolation.

**Limitations:** an airfoil coordinate set is not a complete aircraft aerodynamic dataset. It does not supply the fighter's 3D interference, control-law behavior, high-AoA separation, transonic effects, installed geometry or validated flight envelope. Check individual dataset provenance and terms.

## Recommended engineering references

### 1. USAF Stability and Control Digital DATCOM — methods and derivative estimation

- [NTIS record: Digital DATCOM, Volume I User's Manual, ADA086557 (1979)](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/ADA086557.xhtml)
- [NTIS record: earlier Digital DATCOM manual, ADA045171 (1976)](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/ADA045171.xhtml)
- [Digital DATCOM bibliography and report breakdown](https://www.pdas.com/datcomrefs.html)

**Use for:** the scope and assumptions of semi-empirical methods for static stability, high-lift/control and dynamic derivatives; required geometry inputs; Mach/configuration ranges; trim calculations; how data tables and derivatives can be organized.

**Limitations:** DATCOM is not a source of F-16 or MiG-29 measured coefficients. Its methods have applicability limits and may not represent highly nonlinear high-AoA, separated, transonic or strongly coupled regimes accurately. It is a method/reference, not permission to treat generated estimates as flight-test truth. Preserve method name, assumptions and validity range for every derived result.

### 2. NASA TP-1538 — fighter high-AoA and departure study

- [NASA NTRS record: Simulator Study of Stall/Post-Stall Characteristics of a Fighter Airplane With Relaxed Longitudinal Static Stability (1979)](https://ntrs.nasa.gov/citations/19800005879)
- [NASA TP-1538 PDF](https://ntrs.nasa.gov/api/citations/19800005879/downloads/19800005879.pdf)

**Use for:** understanding high-AoA departure, inertia-coupling concerns, deep-stall behavior and the interaction between aerodynamic characteristics and flight-control modifications in a fighter configuration based on F-16 wind-tunnel data.

**Limitations:** the study is not a complete F-16C Block 50 coefficient database, not a universal F-16 FLCS description and not data for the MiG-29. Read the experimental/simulator configuration and stated assumptions before using any detail.

### 3. NASA/TP-2004-212046 — F-16XL digital flight-control flight test

- [NASA report: Flight Test Results for the F-16XL With a Digital Flight Control System (2004)](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20040040334.pdf)

**Use for:** flight-test methodology, handling-quality evaluation, control-system behavior and examples of comparing simulation/design assumptions with test results.

**Limitations:** F-16XL has a modified fuselage and large-area delta wing. It is not a production F-16C Block 50. Never copy its aerodynamic or performance data into the Block 50 package without a defensible applicability argument.

### 4. U.S. Standard Atmosphere, 1976

- [NASA NTRS: U.S. Standard Atmosphere, 1976](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19770009539.pdf)

**Use for:** a documented baseline for pressure, temperature, density, speed of sound and altitude relationships. Keep the standard atmosphere separate from mission weather, local wind, humidity and turbulence.

**Limitations:** it is a reference atmosphere, not a weather generator or local terrain-flow model.

### 5. Aircraft Control and Simulation — Stevens, Lewis and Johnson

- *Aircraft Control and Simulation: Dynamics, Controls Design, and Autonomous Systems*, 3rd edition, Wiley.

**Use for:** 6-DoF aircraft equations, aerodynamic/propulsion/control-system integration, simulation architecture and control-system analysis. It is a strong theoretical companion to the JSBSim manual and NASA flight-test reports.

**Limitations:** commercial textbook; do not copy figures or prose. It is not a source of exact aircraft-specific coefficients.

### 6. Flight Dynamics — Robert F. Stengel, 2nd edition

- [Princeton University Press book page](https://press.princeton.edu/books/hardcover/9780691220253/flight-dynamics)

**Use for:** a broad theoretical reference for flight mechanics, stability, control-system analysis and modern computational methods. Use it to check derivations and terminology.

**Limitations:** commercial textbook; do not copy its figures/text into the repository. It is not aircraft-specific data.

### 7. FAA AC 23-8C — flight-test methodology

- [FAA AC 23-8C: Flight Test Guide for Certification of Part 23 Airplanes](https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentid/1019676)

**Use for:** test planning, repeatable conditions, weight/CG effects, controllability/stability test structure, pilot observations and evidence recording.

**Limitations:** civil Part 23 certification guidance, not a fighter acceptance standard. Borrow the disciplined test-method approach, not its certification limits as military-aircraft limits.

## Falcon BMS as a simulation architecture case study

- [BMS: Development of the Physics Engine (FM Part 2)](https://falcon-bms.com/blog/the-development-of-the-physics-engine)
- [BMS: The Aero Module (FM Part 3)](https://www.falcon-bms.com/blog/the-aero-module)
- [BMS: FLCS developer notes (FM Part 4 PDF)](https://api.falcon-bms.com/uploads/FM_Developers_Notes_Part_4_a388eac0ae.pdf)
- [BMS: Pushing the Limits / FLCS refinement (FM Part 5)](https://falcon-bms.com/blog/pushing-the-limits)
- [BMS Flight Model article index](https://www.falcon-bms.com/blog/category/flight-model)

**Use for:** examples of separating mechanical/mass properties, aerodynamics, input/output, engine, ground interaction and equations of motion; local surface load concepts; aircraft-specific FLCS modeling; and the long validation effort required to tune a fighter simulation.

**Limitations:** BMS is a simulator. Its articles describe BMS implementation choices, approximations and, in places, F-16-specific behavior. They are valuable architecture case studies, not a general engineering authority or permission to transplant BMS data.

## Exact aircraft data routes

### F-16C Block 50

- [Iron-Front F-16 source register](../../game/modules/planes/F-16/docs/references/README.md)
- [Iron-Front F-16 flight-model dossier](../../game/modules/planes/F-16/flight-model/README.md)

Use the exact Block 50 / F110-GE-129 baseline. The BMS flight manual and avionics manual listed in the source register are simulator manuals, not original U.S. Air Force technical orders. NASA F-16-derived reports may describe test or research configurations, not a production Block 50.

### MiG-29 product 9.13

- [Iron-Front MiG-29 source register](../../game/modules/planes/MiG-29A/docs/references/README.md)
- [Iron-Front MiG-29 flight-model dossier](../../game/modules/planes/MiG-29A/flight-model/README.md)
- [Eagle Dynamics MiG-29 Flight Manual page](https://www.digitalcombatsimulator.com/en/downloads/documentation/dcs-mig-29_flight_manual_en/)

The available DCS manual describes a simulator fit and the repository's source register notes the variant caveat. Do not treat it as proof of every plain product 9.13 value. Preserve 9.12, 9.13, 9.13S and later variants as separate identities.

## What Claude must capture per aircraft model

At minimum, a flight-model evidence package should include:

- Exact aircraft identity, production block/series, engine, operator, retrofit/software baseline and date.
- Reference datum, body axes, sign conventions, geometry stations, reference area/chord/span and force application points.
- Empty/operating mass, fuel states, stores, CG range and inertia evidence; fuel/store changes must update mass properties.
- Chosen aerodynamic representation and why it is appropriate for that aircraft.
- Coefficient/derivative data with independent axes, control/configuration states, interpolation and extrapolation policy.
- Low-speed, high-lift, transonic, supersonic and high-AoA validity envelope as actually supported by sources.
- Flight-control laws/modes, trim, stability augmentation, actuator authority/rates/limits and failure/degraded cases.
- Engine installation transforms and transient performance source; the aircraft-specific engine fit must not be inferred from another block.
- Ground handling, ground effect, gear/strut/tire behavior and runway conditions.
- Validation conditions, source logs, tolerances, residual errors, held-out cases and unsupported regimes.

Read `game/tests/acceptance/Flight-model-verification.md`. A good reference does not replace the acceptance tests.
