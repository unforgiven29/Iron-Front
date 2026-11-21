# Aircraft systems, installations and platform data

**Read with:** `game/systems/README.md`, `game/modules/planes/README.md` and the exact aircraft's `systems/`, `avionics/`, `cockpit/`, `weapons/` and flight-model dossier.

## The installation is aircraft-specific

The shared systems packages implement reusable network behavior. Each aircraft defines its exact installed hardware and topology. For each variant, research:

- generation and distribution: AC/DC domains, buses, converters, batteries, source transfer, protection, load shedding and standby power;
- hydraulic architecture: independent circuits, pumps, reservoirs, accumulators, fluid, pressure/flow, isolation, actuator mapping and emergency sources;
- pneumatic/stored gas: compressors/bottles, regulators, charging, emergency consumers and limits;
- fuel: tank geometry, feed/transfer/pressurization, pumps, valves, engine feed and mass-property effects;
- cooling/ECS: heat sources, heat exchangers, air/coolant loops, equipment cooling and thermal derating;
- engine installation: accessories, bleed, starter, fuel control and interfaces to the aircraft systems;
- flight controls: command logic, mechanical/hydraulic/electrical actuation, feedback, trim, limiters and failure modes;
- cockpit: exact controls, labels, detents, indicators, warning paths, display/software baseline and cold/dark-to-shutdown procedures.

A cockpit switch is an input to the installed system. It is not the authoritative system state. A gauge is an indication from a sensor/power path and may fail independently. A backup source must have a real path, finite capacity/endurance and documented restrictions.

## General aircraft reference

### 1. FAA Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C)

- [FAA handbook index and chapter PDFs](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak)

Relevant chapters include aircraft construction, principles and aerodynamics of flight, flight controls, aircraft systems, flight instruments, manuals, weight and balance, aircraft performance, weather and navigation.

**Use for:** baseline engineering vocabulary and general aircraft-system concepts. It is a good cross-check for the broad meaning of systems and flight concepts.

**Limitations:** general aviation instruction. It is not an F-16/MiG-29 technical order and must not supply fighter-specific system topology or performance values.

### 2. FAA aviation handbooks and addenda

- [FAA Aviation Handbooks & Manuals](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation)

**Use for:** general flight operations, human factors, weight/balance and aviation-system background. Check the edition/addenda listed by the FAA on the day of research.

## Aircraft-specific source registers

### F-16C Block 50

- [Iron-Front F-16 source register](../../game/modules/planes/F-16/docs/references/README.md)
- [Iron-Front F-16 flight-model package](../../game/modules/planes/F-16/README.md)
- [Iron-Front F-16 systems index](../../game/modules/planes/F-16/systems/README.md)

The existing register distinguishes BMS simulation manuals, DCS modeled configuration references, USAF fact sheets and broad cockpit references. Keep those categories distinct. Freeze the exact Block 50 / F110-GE-129 configuration and operator/software date before importing system ratings or sensor capability.

### MiG-29 product 9.13

- [Iron-Front MiG-29 source register](../../game/modules/planes/MiG-29A/docs/references/README.md)
- [Iron-Front MiG-29 package](../../game/modules/planes/MiG-29A/README.md)
- [Official DCS MiG-29 manual page](https://www.digitalcombatsimulator.com/en/downloads/documentation/dcs-mig-29_flight_manual_en/)

The repository's register explicitly warns that the DCS modeled aircraft is not a primary manual for every plain product 9.13 configuration. Retain source-specific variant limitations and disputed Russian/translated terminology.

## How to build an aircraft equipment register

Each subsystem record should have:
- equipment designation and exact variant/software/production baseline;
- host airframe/product and operator/upgrade applicability;
- hardware architecture, manufacturer, part number or block if public;
- physical connection: bus/circuit, hydraulic line, pneumatic consumer, data link, mechanical drive or mounting station;
- normal/standby/emergency operating path;
- operating limits, timing, warm-up, cooling and resource demands;
- controls, indications, warnings and built-in-test behavior;
- normal, degraded, failed and recovery modes;
- source reference and confidence state.

Never solve an unknown by borrowing the equivalent system from another aircraft. If no exact public data is available, document the missing information, create a clearly synthetic test configuration if needed and keep it separate from the real-aircraft package.
