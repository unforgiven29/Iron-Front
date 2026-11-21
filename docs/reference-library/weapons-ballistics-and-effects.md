# Weapons, ballistics, seekers, countermeasures and damage effects

**Read with:** `game/modules/weapons/README.md`, `game/modules/weapons/components/README.md`, the exact category/component guide, `physics/ballistics/README.md`, `physics/guidance/`, `physics/propulsion/`, `sensors/weapon-seeker/README.md`, `physics/armour/README.md` and `game/systems/damage/README.md`.

## Treat a weapon as a composed system

Keep the following concerns separate:
- platform/station/launcher compatibility and release interface;
- body geometry, mass properties and aerodynamic data;
- motor/propulsion state and consumables;
- navigation source and update quality;
- guidance law and command generation;
- seeker physical mechanism, detector/receiver and tracking state;
- control surfaces/actuators and available authority;
- power, cooling, warm-up and built-in test;
- arming/fuze state and terminal-effect profile;
- damage/effect report and target-side response.

A weapon family name does not establish its exact seeker, guidance, fuze, motor, software or operating mode. Record the exact version and source.

## Guidance and control references

### 1. AIAA — Fundamentals of Tactical and Strategic Missile Guidance

- [AIAA course page](https://aiaa.org/courses/fundamentals-of-tactical-and-strategic-missile-guidance/)

The course description identifies topics such as proportional navigation, homing loops, noise/filtering, Kalman filtering, advanced guidance laws and intercept analysis.

**Use for:** a bibliography and curriculum map for guidance-system concepts, state estimation and uncertainty-aware navigation. It identifies Paul Zarchan's *Tactical and Strategic Missile Guidance* as a major reference.

**Limitations:** course/textbook access may be paid or licensed. Do not assume the page itself contains the full technical material.

### 2. AIAA — Missile Guidance

- [AIAA Missile Guidance course](https://aiaa.org/courses/missile-guidance/)

**Use for:** system-level terminology and a map of how aerodynamics, flight control, navigation, guidance, integration and validation relate.

**Limitations:** course outline, not free source code or a complete weapon performance database.

### 3. Falcon BMS AIM-120 acquisition article — simulator case study only

- [AIM-120 in Falcon BMS: Acquisition Model](https://www.falcon-bms.com/blog/aim-120-bms-acquisition-model)

**Use for:** seeing how one simulator documents staged midcourse, handover/search and terminal states, delayed information and an uncertainty volume.

**Critical limitation:** the authors explicitly state that the cited BMS 4.37.3 model uses rough assumptions and estimates and does not claim engineering-accurate AIM-120 modeling. Use it to discuss software state organization and uncertainty, not to extract real missile performance, seeker capabilities, range values or susceptibility ratings.

## External ballistics and small-arms references

### 4. Army TC 3-22.9 — Rifle and Carbine

- [Army publication announcement and direct manual link](https://www.army.mil/article/168953/mcoe_publishes_tc_3-22_9_rifle_and_carbine)

**Use for:** user-facing weapon operation, nomenclature, aiming devices, optic/weapon integration and training context for M4/M16-series equipment.

**Limitations:** not a full external-ballistics database or a general source for every small arm. The manual's date and weapon configuration must be recorded. It should not be used to infer ammunition data for unrelated weapons.

### 5. Exterior-ballistics textbooks and official firing data

Use an established exterior-ballistics text such as McCoy's *Modern Exterior Ballistics* as a theoretical reference (commercial publication). For any specific projectile/ammunition, prioritize an exact, publicly released firing table or manufacturer/official source with stated projectile, lot/configuration, atmosphere, range and test conditions.

Do not invent a universal drag coefficient or dispersion model. Distinguish point-mass, 3-DoF and 6-DoF models and state what physical effects each omits. For the current implementation contract, read `physics/ballistics/README.md`.

## Armour and terminal-effect evidence

### 6. MIL-STD-662 — V50 Ballistic Test for Armor

- [DLA current document record](https://quicksearch.dla.mil/qsDocDetails.aspx?ident_number=35877)

**Use for:** test terminology and how ballistic-limit evidence is collected. The document record identifies Revision G dated 23 July 2025.

**Limitations:** it describes a test method, not a complete combat-damage model or a specific vehicle's armor. Test setup and statistical context matter.

### 7. Ballistic Tests of Armor Materials (1977), ADA045676

- [NTIS record](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/ADA045676.xhtml)

**Use for:** historical context on armour evaluation methods and the distinction between penetration, spall, behind-plate effects and damage assessment.

**Limitations:** old study. Do not treat it as modern composite/ERA vehicle performance data.

### 8. MIL-HDBK-1226 — terminal ballistic effects

- [DLA document record](https://quicksearch.dla.mil/qsDocDetails.aspx?ident_number=202771)

**Access warning:** the public index identifies the base document with Distribution Statement D. Do not obtain, redistribute or rely on the base document unless authorized. The visible record metadata is not permission to access the document.

## Countermeasures and seeker discrimination

There is no reliable universal "chaff effectiveness" or "flare susceptibility" parameter. Research the actual seeker mechanism and its observable scene:
- seeker band and spectral response;
- scan/imaging method and update cadence;
- receiver/detector limitations, noise and saturation;
- background and atmospheric transmission;
- target and decoy scene characteristics;
- target/decoy angular separation and relative motion;
- track history, gate behavior, association uncertainty and loss/reacquisition;
- power, cooling, stabilization, damage and software limitations.

Keep the physical decoy object/release behavior with the weapon/countermeasure owner and the discrimination logic with the relevant seeker-processing owner. Synthetic lab scenes can validate mechanisms; they do not establish real-world susceptibility.

## Required test philosophy

A release request is not a release, a cue is not a lock, an armed state does not guarantee detonation and a seeker track is not guaranteed impact. Validate transitions, time delays, failures, update loss, uncertainty and degraded behavior separately. Do not use hidden target state to make a weapon hit its assigned target.
