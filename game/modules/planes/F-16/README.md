# F-16 Aircraft Module

**Status:** Aircraft-specific architecture and implementation plan. The presence of this README does not mean a functional F-16 flight model, cockpit, sensor suite or systems simulation is implemented.

The F-16 is the first end-to-end integration aircraft for Iron-Front. It is a test of the shared aircraft-module architecture, not the universal template for all aircraft.

## 1. Variant discipline

"F-16" is a family, not one immutable configuration. Before implementing detailed systems, select an exact reference variant/block and engine fit, then record the intended operator/export baseline and software configuration where relevant. Do not combine flight-control, engine, radar, RWR, cockpit or weapon capabilities from different blocks.

Keep family-common geometry and conventions separate from variant-specific configuration. Every capability must be supported by the selected fit and documented data. If the existing game currently labels only "F-16", preserve that identifier as a family selector and resolve it to a concrete variant configuration for simulation.

## 2. Module contents

- `data/`: variant metadata, units, mass/CG/inertia, geometry, aerodynamic source index and validity envelope.
- `aerodynamics/`: F-16-specific lifting-surface layout, coefficient datasets, control effectiveness, nonlinear/high-AoA behavior and configuration effects. Shared aerodynamic solver remains in `physics/aerodynamics/`.
- `flight-controls/`: aircraft-specific control laws, command shaping, control mixing, trim, actuator commands/feedback, limits, failure/reversion and scheduling. Shared actuator/resource contracts remain outside this folder.
- `propulsion/`: selected engine fit, installation, inlet/nozzle geometry, engine control mapping, limits and performance data. Generic engine-family solver remains in `physics/propulsion/`.
- `systems/`: aircraft-specific electrical, hydraulic, fuel, environmental, landing gear, brakes, canopy, oxygen and other fitted systems, each with explicit resource dependencies.
- `avionics/`: equipment configuration, mode logic, navigation, sensor cueing, datalink interfaces and display data contracts. Sensor physics remains in sensor modules.
- `cockpit/`: clickable cockpit interaction map, switch/knob/button commands, instrument mappings, display layouts, warnings and startup checklists.
- `damage/`: zones, structural limits, hydraulic/electrical/fuel line routing, sensor damage and repair mapping.
- `models/`: external/cockpit asset metadata, coordinate conventions, pivots, attachment points, animation bindings, LOD and provenance.

## 3. Aircraft geometry and mass properties

Document reference dimensions, wing and tail stations, control-surface boundaries, engine thrust axis/location, landing gear points, hardpoints, fuel tank locations and sensor/antenna/optical apertures. Keep visual model transforms separate from physical reference geometry.

Mass properties must be recomputed or updated from component/tank/store state. Fuel burn and transfer, stores jettison, damage and component loss can change total mass, CG and inertia. Use physically meaningful bounds and test asymmetric cases.

## 4. F-16 flight model integration

The F-16-specific model supplies:
- Surface layout and local aerodynamic reference geometry.
- Sourced/estimated aerodynamic coefficient tables with Mach/AoA/sideslip/configuration axes.
- Control surface travel/rate and effectiveness data.
- Fitted flight-control law and control-channel behavior for the selected variant.
- Trim and actuator behavior, including actual versus commanded surface position.
- High-AoA/stall/departure/recovery data only within documented support.
- Stores, fuel, damage, ground effect and installation effects.

Do not encode a simplistic "F-16 handling multiplier". The common PFM solver evaluates F-16 data and integrates forces/moments.

## 5. Propulsion and aircraft systems

The exact engine fit supplies engine configuration and installation. The engine model returns dynamic thrust, fuel flow, temperatures, pressures, spool state, vibration, accessory power and failure status. F-16 fuel, electrical and hydraulic systems route the corresponding resources according to the selected variant. Their losses must have consequences:
- Fuel feed interruption changes engine response and may cause flameout according to the model.
- Hydraulic pressure loss changes actuator/gear/brake capability according to affected circuits.
- Electrical bus failure changes engine controls, avionics, displays and sensor availability according to actual wiring/backup design.
- Cooling faults reduce equipment availability or increase thermal limits.
- Engine damage affects thrust, fuel use, vibration, temperature and thermal signature.

Do not assume a generic redundancy diagram. Document the exact system fit or mark unknowns.

## 6. Sensors and avionics

The module selects installed radar, RWR/ESM, IRST (only if actually fitted in the selected configuration), EO/FLIR, IFF, navigation and datalink equipment. Do not automatically equip the F-16 with an IRST because the project has an IRST subsystem.

Each equipment record identifies exact model/variant/software baseline, controls, scan limits, modes, power/cooling requirements, cockpit presentation, source provenance and limitations. Sensor physics executes in shared sensor modules. Aircraft avionics sends commands and receives reports.

For the RWR, define the actual installed receiver, antenna apertures/locations, frequency coverage, direction-finding method, processing/software/library baseline, warning logic, audio/display mapping, electrical/cooling dependencies and damage paths. Do not assume a universal F-16 RWR fit or copy capabilities from another block/operator. Follow the [RWR implementation guide](../../../../sensors/RWR/CLAUDE_IMPLEMENTATION_GUIDE.md). RWR output must be based on intercepted emissions and uncertain measurements; it must not read radar tracks or hidden target state.

## 7. Stores and configuration

Represent each station with allowed store definitions, mass, geometry, attachment transform, drag contribution, release interface and relevant electrical/data connection where supported. A loaded configuration changes mass/CG/inertia, aerodynamic drag, performance, handling and signatures. Jettison/release updates all dependent state through events.

Do not permit arbitrary weapons merely because a 3D model can be attached. Compatibility is configuration data validated for the selected aircraft variant.

## 8. Cockpit and startup

Cockpit controls map to typed aircraft-system commands. Startup is a state machine with prerequisites, sequencing, time delays, power/pressure/fuel/ignition checks and fault paths—not a single "start engine" button. Instruments consume real subsystem samples and display failure/stale/invalid states. Cockpit interaction never mutates physics fields directly.

Build the cockpit in layers: essential flight instruments and controls first; then engine/fuel/electrical/hydraulic indications; then selected avionics/radar/RWR pages; then secondary systems. Accuracy and source provenance matter more than the number of clickable switches.

## 9. Data provenance and validation

For every value record source, page/table where possible, units, variant applicability, confidence, uncertainty, and whether it is measured, publicly sourced, estimated, synthetic or unknown. Do not fabricate exact classified values.

Maintain an F-16 validation matrix for:
- Mass, CG, inertia and loading configurations.
- Trim, stability, control response and actuator limits.
- Lift/drag/moment trends and supported AoA/Mach envelope.
- Acceleration, climb, turn and energy behavior against available public references.
- Engine thrust/fuel/transient trends.
- Fuel burn/transfer and CG movement.
- Electrical/hydraulic load/failure scenarios.
- Gear, brakes, stores, damage and asymmetric cases.
- Radar/RWR/IRST behavior for the exact installed fit.
- Cockpit indications, startup sequencing and failure annunciation.
- Deterministic replay and browser performance.

The F-16 is complete only when the shared runtime consumes its variant data, the above causal dependencies are tested, and its supported envelope and limitations are documented.
