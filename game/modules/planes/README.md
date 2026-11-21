# Aircraft platform modules

**Owner:** game/modules/planes for fixed-wing aircraft-specific definition, configuration, installation and adapters. Shared physics, sensor and system engines remain outside platform folders. Rotorcraft, UAS and civil aircraft have their own package owners.

## Package responsibility

A package describes an exact aircraft configuration: variant/block/operator/software baseline; geometry and mass distribution; aerodynamic surfaces/data; flight-control laws/actuators; engine installation; fuel, electrical, hydraulic, pneumatic and cooling topology; auxiliary/environmental control; landing gear/brakes; sensors/avionics; hardpoints/stores; damage routes; crew/escape; cockpit control/display map; assets and provenance.

Each aircraft has its own installed systems architecture. A shared electrical or hydraulic solver does not mean aircraft share the same generators, batteries, buses, pump count, reservoirs, pressure ratings, accumulator arrangements, crossfeed, emergency sources or consumers. The platform package selects and wires exact equipment; shared solvers execute that hardware configuration.

## Mission and aircraft catalogue breadth

The legacy game includes a broad multi-era hangar rather than only two fighters. Preserve that breadth through independently versioned packages: fighters/interceptors, multirole/strike aircraft, attack aircraft, bombers, reconnaissance, trainers, transports and other supported categories. Aircraft availability is tied to scenario faction/equipment and exact product variants, not a hardcoded universal hangar list.

Supported task profiles should include CAP, intercept, BVR/WVR combat, escort, strike, CAS, SEAD, reconnaissance, anti-ship, ferry, refuelling, carrier operations, emergency recovery and training where the exact aircraft fit permits them. A role label does not grant an aircraft equipment it does not carry.

## Flight-model independence — mandatory

Every aircraft has its **own flight model**. The shared layer is the physics toolkit and integration framework, not the aircraft's aerodynamic behavior. Each platform package owns its chosen aircraft-specific model, geometry, coefficient data/equations, mass properties, control laws, trim/stability augmentation, actuator/surface mapping, propulsion installation, configuration effects and validated operating envelope.

Different aircraft may use different aerodynamic model structures when their design and available data require it. Do not force all aircraft into an identical panel layout, coefficient lookup scheme or handling model merely to maximize code reuse. Share mathematical primitives and interfaces where valid; preserve aircraft-specific behavior and uncertainty. In particular, the F-16C Block 50 and MiG-29 product 9.13 must have independent flight-model data and validation. A common rigid-body integrator does not mean a common flight model.

## First two full-fidelity aircraft — technical research packages

The first aircraft are the F-16C Block 50 and MiG-29 product 9.13. Use [the platform-by-platform technical evidence program](../../../docs/platform-reference-program/README.md) and its separate [F-16C Block 50 dossier](../../../docs/platform-reference-program/aircraft/F-16C-Block-50.md) and [MiG-29 product 9.13 dossier](../../../docs/platform-reference-program/aircraft/MiG-29-product-9-13.md). The aircraft do not share one flight model; each dossier tracks its own geometry, coefficients, control response, movable devices, engine installation, systems, sensors, stores and validation.

## Required aircraft flight-model dossier

Every aircraft package must also maintain a focused flight-model directory. It records aircraft-specific aerodynamic geometry/panelization, coefficient datasets and valid envelope, control-surface mapping, actual actuator interfaces, high-lift devices, engine installation transforms, damage/structural coupling and validation cases. Reusable framework, mathematical primitives and force/moment contracts remain in physics/flight-model and physics/aerodynamics; the aircraft-specific model and its data remain in that aircraft's package. Do not create private copies of shared solvers or store authoritative values as hard-coded constants inside an FM coordinator.

The F-16C Block 50 first package is under game/modules/planes/F-16/flight-model/; the MiG-29 product 9.13 architecture proof is under game/modules/planes/MiG-29A/flight-model/.

## Required aircraft systems dossier

Every aircraft package must maintain a focused systems directory with an index and separate guides where the installation is materially different. At minimum cover:

1. **Electrical:** engine/APU/standby/emergency generation; accessory drives; AC/DC domains; transformers, rectifiers and inverters; bus and branch topology; batteries/chargers; dedicated flight-control power; contactors, relays, circuit breakers and protection; external power; load classes/shedding; source transfer; indications and backup endurance.
2. **Hydraulic:** every independent/boost/utility circuit; pump type/drive/curve; reservoirs/quantity/pressurization; fluid; pressure/return/suction plumbing; filters, valves and isolation; accumulators/precharge; actuator chambers/consumer mapping; pressure and flow limits; thermal path; emergency pump/crossfeed and residual authority.
3. **Pneumatic/stored gas:** bottle/compressor/charging architecture; gas type/volume/pressure; regulator/check/isolation valves; main and emergency circuits; brakes, landing gear, canopy, chute, fuel shutoff and reservoir pressurization where fitted; charging/servicing restrictions.
4. **Auxiliary/environmental:** APU, emergency power unit, ram-air turbine or other alternate machinery; engine accessory drive and interlocks; cabin/ECS/pressurization; pilot oxygen/anti-G equipment; avionics/radar cooling and thermal interfaces.
5. **Fuel and cooling:** tank/feed/transfer configuration, engine/APU/emergency unit feed, fuel thermal exchange, coolant/air loops and equipment cooling interfaces.

A system may be omitted only with an explicit not-fitted/not-applicable record and evidence/reason. Do not silently substitute another aircraft's system, values or backup.

## Cockpit and human interfaces

A cockpit package defines aircraft-specific geometry, controls, displays, warnings, labels, sightlines, click/hold/axis interaction and startup/shutdown procedure mapping. A shared instrument/widget library may draw a gauge, but the meaning, range, failure behavior and wiring belong to the installed aircraft system. Cold/dark startup, ground power, engine start, avionics alignment, checks and shutdown are explicit procedures. Do not infer an accurate cockpit from a generic 3D shell.

## Platform installation versus shared behavior

- Platform systems docs/data describe installed hardware, topology, ratings, equipment locations, bus/circuit/load/consumer mapping, switch/indicator mapping, failure isolation and exact applicability.
- game/systems owns reusable electrical, hydraulic, pneumatic, fuel, cooling and other network behavior.
- physics owns reusable physical models/numerical integration and engine family behavior.
- Equipment such as flight controls, landing gear, brakes, engines, sensors and avionics owns local response to actual delivered resources.
- game/core/resources arbitrates capacity but does not decide physical network state.

Do not write aircraft-name conditionals into shared solvers. Use stable equipment/circuit IDs, typed connection interfaces and data-driven installation graphs.

## Variant and provenance discipline

Every configuration resolves to an exact product, block, engine, operator, software/production standard and date where known. Every rating, pressure, bus assignment, battery property, pump curve, valve threshold, accumulator precharge, load demand and backup procedure must carry units, source title/revision/page, exact applicability, confidence/review status and provenance class (source-reported, derived, estimated, synthetic or gameplay-tuned). One source may establish circuit architecture but not the rating or exact fit of every installed component.

Unknown topology stays unknown. Estimated values must be labeled and must not be presented as documented specifications.

## Required integration sequence

Freeze baseline → validate geometry/mass/datum → add aero surfaces/data → control law/actuator path → engine/installation → fuel/electrical/hydraulic/pneumatic/cooling topology → gear/brakes → exact sensor/avionics fit → stores/damage/crew → cockpit commands and snapshot indications → assets/animations → startup, failure, degraded, emergency and recovery scenarios.

## Acceptance

No aircraft handling multiplier. Fuel/stores alter mass properties; electrical/hydraulic/pneumatic/cooling loss follows connected topology; emergency sources have real prerequisites and finite capacity; cockpit controls command real equipment; a failed display does not rewrite physical truth; every dataset has exact applicability and source uncertainty. Unknowns stay unknown.

The F-16C Block 50 is the first vertical slice; its system dossier is under game/modules/planes/F-16/systems/. MiG-29 product 9.13 proves materially different composition under the same shared contracts; its dossier is under game/modules/planes/MiG-29A/systems/.
