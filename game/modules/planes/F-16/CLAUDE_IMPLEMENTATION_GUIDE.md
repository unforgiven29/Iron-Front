# Claude Implementation Guide — F-16 First Integrated Aircraft

Read this guide with [integrated simulation architecture](../../../docs/integrated-simulation/README.md), [integration implementation brief](../../../docs/integrated-simulation/CLAUDE_IMPLEMENTATION_GUIDE.md), flight-model, propulsion, radar, IRST, sensors and graphics guides.

## Goal

Make the F-16 the first complete aircraft module using the shared Iron-Front simulation runtime. Its flight model, propulsion, sensors, systems, cockpit and graphics must be aircraft-specific configurations/adapters over shared engines—not duplicated engines hidden inside the F-16 folder.

## Step 1 — inspect and select the actual variant

Audit the existing F-16 code/assets and identify what already works. Determine exact reference block/variant and engine fit before implementing system-specific behavior. If no exact block is selected in current data, create a clearly named provisional configuration and list every unresolved assumption; do not merge equipment from different variants. Record source provenance and unknown values.

## Step 2 — build the aircraft definition

Create a schema-validated immutable aircraft definition with stable ID/version and explicit references to:
- Variant metadata and source baseline.
- Geometry, reference stations, attachment points and coordinate conventions.
- Empty mass, component masses, tank/store locations, CG and inertia.
- Aero surface layout and aerodynamic datasets.
- Flight-control laws and actuator definitions.
- Engine family/configuration/installation.
- Fuel, electrical, hydraulic, cooling and environmental system topology.
- Sensor equipment fits and avionics modes.
- Stores/hardpoints and compatibility.
- Damage zones and failure paths.
- Cockpit control/instrument/display mapping.
- External/cockpit model and animation metadata.

Do not store mutable flight state in the definition. Do not put executable arbitrary scripts in data files; use validated adapter IDs registered in code.

## Step 3 — connect the full causal path

### Flight controls and aerodynamics
Pilot input → F-16 control law/mixing → actuator request → hydraulic/electrical resource allocation → actual surface deflection → local air sample per surface → aerodynamic loads → rigid-body integration.

### Propulsion
Throttle → F-16 engine control mapping → shared engine-family dynamics → thrust/torque/fuel/heat/vibration outputs → rigid-body, fuel, electrical/accessory and thermal-signature consumers.

### Mass properties
Tank/store/component state → mass/CG/inertia calculation → rigid-body and aerodynamic reference updates. Fuel burn, transfer, stores release and damage must update this path.

### Systems
Electrical/hydraulic/fuel/cooling providers → explicit allocations → consumers and failure reasons. A failure must affect only downstream systems connected to the failed component/circuit, plus documented secondary effects.

### Sensors and avionics
Variant selects only fitted equipment. Shared radar/IRST/RWR/EO sensor engines produce uncertain reports. F-16 avionics schedules modes, cueing and display presentation. Sensor reports must preserve source, timestamp, uncertainty and age.

### Cockpit and graphics
Controls issue typed commands; displays consume instrument/sensor outputs. Render transforms, animations and effects read snapshots. Neither cockpit nor renderer directly writes simulation truth.

## Step 4 — use a staged implementation

1. Audit and data/variant selection.
2. Aircraft definition schema, loader and validation.
3. Geometry, mass properties and 6-DoF connection.
4. Flight controls, actuators and surface aerodynamics.
5. Engine fit and fuel/resource integration.
6. Electrical, hydraulic, cooling and essential systems.
7. Stores, damage and failure propagation.
8. Radar/RWR/IRST/EO equipment integration and avionics.
9. Cockpit interactions/instruments and startup state machine.
10. External/cockpit rendering and animations.
11. Full integration scenarios, validation matrix and profiling.

Do not add dozens of cockpit switches before the physical data path works.

## Step 5 — test cross-system consequences

Add reproducible scenarios for fuel burn/CG shift; asymmetric stores; hydraulic leak and control degradation; electrical bus failure; generator/engine accessory loss; engine surge/damage; afterburner/fuel/thermal signature; inlet distortion; icing; radar emission to RWR; IRST aspect/background misses; antenna/window/cooling damage; datalink track aging; gear/brake failure; and save/load/replay.

For RWR specifically, test actual transmitter emissions through propagation, antenna and receiver; no radar track dependency; silent/receive-only cases; bearing uncertainty and no invented range; unknown emitters; channel/dynamic-range limits; power/cooling/antenna damage; and stale remote ESM reports.

Each test must assert both the initiating change and at least one downstream effect. Add negative tests proving unrelated systems are not incorrectly affected.

## Rules

- Do not copy shared solvers into this folder.
- Do not invent F-16 variant data or assume IRST is installed.
- Do not conflate commanded and actual control surface positions.
- Do not use visual model geometry as the only physical geometry source.
- Do not expose hidden target truth to F-16 sensors or avionics.
- Do not fake startup, engine response, sensor modes or failures with booleans.
- Do not mark the F-16 complete until tests, sources and limitations are documented.


## Required aircraft reference pack

Before implementing F-16-specific behavior, read [`docs/README.md`](docs/README.md) and its variant baseline. The current selected baseline is F-16C Block 50 / F110-GE-129 / APG-68(V)5 / ALR-56M. Do not mix APG-68(V)9, APG-83, Block 52 engine data or later modernization fits into this configuration. Treat linked BMS/DCS publications as simulation references and preserve source/variant caveats.
