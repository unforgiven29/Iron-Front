# Ground vehicles, mobility, armour and infantry

**Read with:** `game/modules/ground-units/README.md`, the exact tank/IFV/APC/artillery/air-defence owner guide, `physics/ground-mobility/README.md`, `physics/rigidbody/README.md`, `physics/collision/README.md`, `physics/armour/README.md`, `physics/ballistics/README.md` and relevant infantry guides.

## Separate the domains

Do not treat a ground unit as a waypoint-following map marker. The simulation needs distinct but connected models:

- **Vehicle configuration:** exact hull, mass/CG/inertia, track/wheel layout, suspension, powertrain, gear ratios, final drive, brakes, steering, fuel and carried stores.
- **Mobility physics:** contact forces, traction/slip, rolling resistance, steering, braking, suspension travel/damping, load transfer and powertrain response.
- **Terrain/soil:** elevation, slope, roughness, obstacles, friction and—only where supported—soil deformation, sinkage, compaction, water and mud.
- **Armour/impact:** hit location, surface normal, impact condition, layered material map and explicitly supported damage/effect outputs.
- **Crew/passengers:** positions, stations, dismount state, injuries, workload and egress paths.
- **Tactical behavior:** orders, observations, communication, formations, suppression, concealment, logistics, withdrawal and recovery. AI must not see hidden enemy truth.

## Strong engineering and implementation references

### 1. Project Chrono — vehicle physics and terrain

- [Project Chrono project and license overview](https://projectchrono.org/)
- [Chrono::Vehicle module](https://api.projectchrono.org/9.0.0/group__vehicle.html)
- [Vehicle modeling overview](https://api.projectchrono.org/9.0.0/vehicle_overview.html)
- [Tracked vehicle and subsystem documentation](https://api.projectchrono.org/9.0.0/group__vehicle.html)
- [Terrain models](https://api.projectchrono.org/9.0.0/vehicle_terrain.html)
- [Soil Contact Model reference](https://api.projectchrono.org/development/classchrono_1_1vehicle_1_1_s_c_m_terrain.html)

**Use for:** real examples of composable vehicle subsystems, powertrains, tracked/wheeled models, suspension templates, contact, terrain queries and deformable soil. The open-source project is a particularly valuable architecture reference for modular vehicle simulation. Its project site describes a BSD-3 license.

**Limitations:** Chrono is a C++ multiphysics engine, not a drop-in JavaScript library. Its detailed contact/SCM/FEA/DEM approaches may be too expensive for an all-browser battlefield. Study model boundaries and validation; port only an appropriate reduced-order model and review license/attribution before reusing code. Do not claim that a generic Chrono vehicle template is an Abrams or BMP model.

### 2. Theory of Ground Vehicles, 5th edition — J. Y. Wong

- [Wiley book page](https://onlinelibrary.wiley.com/doi/book/10.1002/9781119719984)

**Use for:** ground-vehicle mobility, off-road vehicle mechanics, traction, tire/track-ground interaction, powertrain effects and terramechanics fundamentals.

**Limitations:** commercial textbook. It provides theory and methods, not exact vehicle-specific engine, transmission, armour or suspension parameters. Do not copy copyrighted tables or figures.

### 3. Army ATP 3-20.15 — Tank Platoon (10 July 2025)

- [Official Army RDL PDF](https://rdl.train.army.mil/catalog-ws/view/100.ATSC/C30089BD-C3F4-4C3A-93B1-F6CB0D557EC1-1753379941749/ATP3_20x15.pdf)
- [Army article on the 2025 update](https://www.army.mil/article/289372/forging_the_thunderbolts_foundation_doctrinal_updates_to_tank_and_scout_platoon_manuals)

**Use for:** tank platoon organization, command relationships, planning, preparation, collective behavior, tactical tasks, sustainment and how individual tanks operate as a unit.

**Limitations:** doctrine is not a technical data manual. It does not establish exact armour arrays, engine power curves, sight performance or fire-control accuracy. It is intended to inform AI/unit behavior and mission organization.

### 4. Army ATP 3-21.71 — Mechanized Infantry Platoon and Squad (15 October 2024)

- [Official Army RDL PDF](https://rdl.train.army.mil/catalog-ws/view/100.ATSC/EF9DA569-8865-4E94-B15A-94913B080DCD-1729619785668/ATP3_21x71.pdf)

**Use for:** Bradley-equipped mechanized infantry organization, mounted/dismounted relationships, squad/platoon roles, mutual support, mission tasks and tactical behavior.

**Limitations:** doctrine and employment guidance, not a vehicle systems manual or universal doctrine for all countries.

### 5. Army ATP 3-21.8 — Infantry Rifle Platoon and Squad

- [Army article describing the publication and purpose](https://www.army.mil/article/167323/atp_3_218_infantry_platoon_and_squad_now_available_for_download)

**Use for:** squad organization, roles, command relationships and infantry behavior context. Use the latest edition/change listed by the Army Publishing Directorate when researching implementation; do not assume the article's original 2016 edition is current.

## Armour and impact test references

### 6. MIL-STD-662 — V50 Ballistic Test for Armor

- [DLA ASSIST Quick Search document record](https://quicksearch.dla.mil/qsDocDetails.aspx?ident_number=35877)

The record identifies the active revision as Revision G, dated 23 July 2025. It describes a test method for determining V50 ballistic limit under defined test conditions.

**Use for:** understanding how armour test evidence is structured and why results require projectile, plate, obliquity, conditioning, fixture and statistical context.

**Limitations:** a V50 test method is not a universal armour model, and V50 is not a direct in-game probability-of-penetration curve for every hit condition. Do not infer a specific tank's armour from a generic standard.

### 7. Ballistic Tests of Armor Materials — U.S. Army Test and Evaluation Command (1977)

- [NTIS report ADA045676](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/ADA045676.xhtml)

**Use for:** historical test-method and terminology context for armor evaluation, impact obliquity, penetration, spall and behind-plate effects.

**Limitations:** old report; use as methodology/background only. It cannot establish current composite, reactive or classified vehicle armor performance.

### Distribution warning

The DLA index for MIL-HDBK-1226, *Design of Projectiles for Terminal Ballistic Effects*, is publicly discoverable, but its record lists the base document with Distribution Statement D. Do not assume the PDF is public or download/reproduce it unless you are authorized. The metadata page is [here](https://quicksearch.dla.mil/qsDocDetails.aspx?ident_number=202771).

## Exact vehicle data: how to research it

For each tank, IFV, APC, SPAAG, SAM vehicle, artillery platform or truck, locate the exact variant's publicly releasable operator/maintenance manual, official technical fact sheet, manufacturer data or instrumented test report. Record its model designation, production series, export/operator configuration, retrofit standard and manual revision.

A manual for an M1A1 is not automatically an M1A2 SEP manual. A BMP-2 is not a BMP-2M. A Bradley A2 is not necessarily an A3. Do not transfer sensor, armour, engine, transmission or fire-control properties between variants because the family name is similar.

If platform-level technical information is unavailable, implement the platform with explicit unknown/provisional fields and synthetic test fixtures. Never substitute the best-documented vehicle's data for another vehicle.

## Recommended implementation evidence

Map the sources to tests:
- straight-line acceleration, speed envelope and braking on defined terrain;
- gradeability and side-slope behavior under known mass and traction;
- turning response and track/wheel slip;
- suspension travel and hull pitch/roll over obstacles;
- terrain transition continuity and soil deformation budget;
- turret traverse/elevation and stabilization as separate subsystem behavior;
- crew station/passenger capacity, embark/disembark and egress;
- hit-location records and separately reported mobility, firepower, sensor, crew and catastrophic outcomes;
- damage isolation, repair, resupply and degraded operation.

The sources inform these tests; they do not make them pass automatically.
