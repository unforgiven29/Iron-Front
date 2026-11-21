# F-16C Block 50 — aircraft integration package

**Intended baseline:** F-16C Block 50, GE F110-GE-129. Radar/RWR/software/operator revisions must be resolved from source records before becoming authoritative. **Status:** research/architecture handoff; not a functional aircraft.

## Variant discipline

F-16 is a family, not one configuration. Do not blend Block 50/52 engine, radar, RWR, flight-control, software or weapons capabilities. Do not silently import F100-PW-229, APG-68(V)9, APG-83, IVEWS or later fits into this selected baseline.

## Package owns

Exact geometry/datum, mass/CG/inertia and fuel/store locations; aero surface layout/coefficient data; FLCS schedule, mixing, trim, actuator limits/feedback and failures; F110 installation/inlet/nozzle/accessories/control mapping; installed fuel/electrical/hydraulic/pneumatic/cooling topology; landing gear/brakes; actual sensor/avionics fit and installation; hardpoints/store transforms; damage zones/routing; crew/escape equipment; cockpit control/display mappings; model/asset metadata.

## Platform technical evidence package

Use the [F-16C Block 50 technical evidence package](../../../../docs/platform-reference-program/aircraft/F-16C-Block-50.md) as the cross-domain research checklist. It covers airframe/flight model, movable surfaces, FLCS, actuation/resources, aircraft systems, avionics/EW, stores and validation. Extend the [F-16 source register](docs/references/README.md) with page-level records rather than duplicating references elsewhere.

## Flight-model dossier

Read [the F-16 flight-model index](flight-model/README.md) for the aircraft-specific geometry, coefficient-data, control/actuator and validation structure. The shared physics/flight-model and physics/aerodynamics layers provide reusable numerical infrastructure and interfaces, not a universal aircraft flight model. This package owns the F-16C Block 50's distinct aerodynamic model, geometry, coefficient data, FLCS/control response, mass properties and validity/validation envelope, with exact Block 50/GE installation data and provenance. Do not export F-16 handling or coefficients as shared defaults for other aircraft.

## Aircraft systems dossier

Read [the F-16 systems index](systems/README.md) for the installation map, then the focused [electrical](systems/electrical.md), [hydraulic](systems/hydraulics.md) and [pneumatic/emergency gear](systems/pneumatics.md) guides. These are platform installation descriptions, not separate solvers. The shared electrical/hydraulic/pneumatic owner guides define reusable behavior.

The selected Block 50/GE fit must be verified independently from manuals covering multiple blocks or engine options. In particular, do not copy every rating, pump part number, electrical load or EPU value into the selected configuration until its exact applicability is confirmed.

## Implementation order

1. Freeze exact baseline and provenance.
2. Geometry, datum and changing mass properties.
3. Shared rigidbody + atmosphere + aero with trimmed stable flight.
4. FLCS and actuators with actual hydraulic/resource constraints.
5. Engine installation, fuel feed and accessory loads.
6. Electrical/hydraulic/pneumatic/cooling network installation and startup/failure paths.
7. Gear/brakes and connected system failure behavior.
8. Stores, release, mass/drag effects and damage.
9. Confirmed sensor/avionics fits through shared engines.
10. Clickable cockpit commands and authoritative snapshot indications.
11. Startup, taxi, takeoff, trim, maneuver, failure, emergency operation, landing and debrief scenarios.

## Acceptance

The detailed aircraft acceptance suite is [F-16C Block 50 first vertical slice](../../../tests/acceptance/F16-first-vertical-slice.md), including electrical source transfer/load shedding, dedicated FLCS power, A/B hydraulic circuit failure, accumulators, coupled EPU output and pneumatic emergency gear extension.

No aircraft handling multiplier. Fuel/stores alter mass properties; hydraulic/electrical/cooling loss follows connected topology; sensors obey signal/observation contracts; cockpit controls real systems; each dataset has exact applicability and source uncertainty. Unknowns stay unknown.
