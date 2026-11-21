# Platform-by-platform technical evidence program

**Purpose:** Build separate, auditable engineering evidence packages for every aircraft, vehicle, sensor and weapon variant. Start with the first two full-fidelity aircraft: F-16C Block 50 and MiG-29 product 9.13.

This is a research/data program, not an implementation claim. The two aircraft packages are deliberately separate. Shared equations, numerical tools and contracts do not make their flight models, flight-control laws, aerodynamic surfaces, engine installations or handling characteristics interchangeable.

## First full-fidelity aircraft

| Priority | Platform package | Identity to preserve | Starting point |
|---|---|---|---|
| 1 | F-16C Block 50 | Single-seat Block 50, GE F110-GE-129; exact operator/OFP/equipment fit still to be frozen | [F-16 evidence package](aircraft/F-16C-Block-50.md) and [existing source register](../../game/modules/planes/F-16/docs/references/README.md) |
| 2 | MiG-29 product 9.13 | Single-seat product 9.13; do not merge 9.12, 9.13S, 9.13B, 9.13SE or later modernizations | [MiG-29 evidence package](aircraft/MiG-29-product-9-13.md) and [existing source register](../../game/modules/planes/MiG-29A/docs/references/README.md) |

## Initial weapon/product evidence

The first weapon library is [here](weapons/README.md). It contains source-linked public profiles for AIM-9M, AIM-120C-5, AGM-88 HARM, AGM-65D, R-27R, R-27T, R-73A, M61A1 and GSh-30-1. Treat each profile's provenance and variant caveats as binding. Do not interpret this starter set as a complete loadout or station-clearance database.

"Full fidelity" means a complete causal model over an explicitly validated envelope, with sourced/traceable data and truthful limitations. It does not mean every aerodynamic coefficient, circuit value or classified performance parameter is publicly known. Do not fill data gaps with invented precision.

## Evidence package contents

Each platform must build and maintain the following records. Use the [source record template](../reference-library/source-record-template.md).

1. **Identity and applicability:** product/series/block, production standard, operator, retrofit, engine, avionics/radar/RWR/weapon software, effective date and excluded variants.
2. **Geometry and reference frames:** datum, body axes, planform, stations, hinge/pivot axes, areas, reference dimensions, control-surface segmentation and geometry provenance.
3. **Mass properties:** empty/basic/operating states, pilot/crew, fuel tanks and transfer, ammunition/stores, CG envelope, inertia tensor and how each configuration changes them.
4. **Aerodynamic model:** selected model class, coefficient/derivative sources, local-flow representation, compressibility, separation/stall, high-AoA, sideslip, asymmetry, ground effect, wake/flow interaction and validity envelope.
5. **Flight controls:** cockpit/pilot inputs, mechanical/electrical computation, control laws, mixing, trim, stability augmentation, limiters, modes, command/target/actual/indicated positions and failure reversion.
6. **Movable aerodynamic devices:** primary controls, flaps, leading-edge devices, spoilers if fitted, speedbrakes/airbrakes, trim tabs, drag devices, gear doors and stores. Each gets its own physical and aerodynamic record.
7. **Actuation and resources:** actuator type/count/locations, hydraulic/electrical/pneumatic supply, rate/force/stroke/pressure limits, feedback, interlocks, backup supply, asymmetry and failure paths.
8. **Propulsion installation:** exact engine variant, transforms, thrust axes, inlet/nozzle/bleed/accessory effects, spool/transient data, fuel feed, cooling, asymmetric failures and engine-out moments.
9. **Aircraft systems:** electrical, hydraulic, pneumatic, fuel, cooling/ECS, landing gear/brakes, pressurization/oxygen/anti-G, emergency power, fire protection, crew escape and maintenance/BIT.
10. **Avionics and sensors:** exact radar/RWR/ESM/IRST/EO/IFF/navigation/communications fit, apertures, mounting, field of regard, power/cooling, software modes, controls/indications and data quality.
11. **Stores and weapons integration:** station geometry, pylon/rack, mass/CG/inertia/drag, electrical/data/umbilical interfaces, release constraints, separation impulse and asymmetric carriage.
12. **Damage and structural response:** zones, load paths, local damage, actuator/line/cable/equipment routing, structural limits, fire, leaks, control-surface jam/separation and repair.
13. **Cockpit and procedures:** exact cockpit variant, control positions, detents, display/indication source, warning logic, cold/dark start, ground operations, emergency checklists and shutdown.
14. **Validation:** source-linked trim/performance/control cases, flight-test/simulator data, held-out conditions, deterministic tests, failure cases, error budget and performance budget.

## Evidence status vocabulary

Use one of these states for every datum and claim:

- `primary-published`: an applicable original manual/technical order/manufacturer source.
- `measured-test`: an instrumented report for the documented test article and conditions.
- `derived`: calculated from identified inputs and a recorded method; retain uncertainty.
- `secondary-reported`: reported by a secondary source but not independently confirmed.
- `simulator-reference`: modeled in DCS/BMS/another simulator; not independent real-aircraft proof.
- `estimated`: informed estimate with rationale and uncertainty.
- `synthetic-test-only`: generated for unit/integration testing; never load as real-platform data.
- `unknown`: no defensible value.
- `disputed`: sources conflict or variant applicability is unresolved.
- `not-fitted`: absent from this precise selected fit, with evidence/reason.

Do not collapse status into a generic "confidence: high" field. Preserve the actual kind of evidence.

## Data-record minimum

Every parameter record needs: stable ID; quantity; numeric value or explicit unknown; SI units; coordinate frame/datum; sign convention; exact platform/variant/software applicability; source and exact page/table/figure; publication/revision date; provenance status; uncertainty/range; validity conditions; review state; and any transformations from source units.

## Platform-specific sources versus common engineering sources

General texts, JSBSim, DATCOM, Project Chrono, MIT radar courseware and NASA research help Claude choose equations, architecture, data fields and validation methods. They do not automatically establish the exact values for an F-16C Block 50 or MiG-29 product 9.13.

For an exact aircraft fact, prioritize exact technical orders/manuals/test reports and independent confirmation. When exact public data do not exist, keep the gap visible and validate only a clearly labeled approximation.

## Implementation handoff

Before coding a platform subsystem, Claude should report:
- exact platform identity and selected source baseline;
- existing data/docs/code inspected;
- new facts to encode and their source record IDs;
- unresolved/disputed/unknown values;
- shared algorithm owner and platform-specific adapter/data owner;
- failure cases and required acceptance tests;
- what is intentionally out of scope.

Do not begin a second aircraft by copying the first aircraft's platform folder wholesale. Create the second package from its own evidence matrix.
