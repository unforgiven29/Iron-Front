# Engine installation and flight-model coupling

**Owner:** physics/flight-model/propulsion-integration for aircraft installation transforms and the FM force interface. physics/propulsion owns engine-family thermodynamics and spool/thrust behavior; game/systems/fuel owns fuel inventory/feed; aircraft packages define exact engine fit. **Status:** architecture only.

The A-4E-C has a separate Engine2 component and fuel system, with the flight model consuming engine output. Iron-Front should keep that separation and make the installed engine transform explicit.

## Installation definition

Each engine installation records engine capability/family and exact variant; engine reference point/station; thrust-axis orientation; inlet face and installed inlet recovery/distortion data reference; nozzle/exhaust direction and geometry reference; dry/installed mass and mass-property contribution; fuel feed path; accessory drive output/load connections; cooling/thermal/fire zones; damage mapping; and provenance.

Twin-engine aircraft define two distinct installation records. Do not multiply one engine's thrust by two without independent spool, fuel feed, damage, inlet, temperature, accessory and asymmetry state.

## Force coupling

The engine model returns thrust vector and any supported non-axial installation effect with reference point/frame, tick, actual operating state and validity. The installation adapter transforms this into the aircraft body/world frame and supplies application-point moment through the shared force contract.

Do not let the flight-model assembly infer engine thrust from throttle position. Throttle is a command; the engine model returns actual thrust after spool inertia, ambient conditions, fuel delivery, limits, damage and installation effects.

## Coupled effects

Depending on evidence and fidelity, couple inlet distortion/recovery, bleed/accessory extraction, nozzle/afterburner state, thrust asymmetry, exhaust heating, propwash/jet interaction with surfaces, and engine-out effects. Detailed engine internal fluid/thermodynamic equations remain outside this folder.

## Tests

Single and twin engine installation transforms; left/right engine independent spool/fuel/damage; thrust direction and moment arm; accessory load feedback; altitude/Mach changes; engine start/shutdown/relight; fuel starvation; inlet damage; asymmetric thrust and replay. Check that engine force appears exactly once in the rigid-body contribution set.


## Installed inlet, exhaust and airframe coupling

The engine-family model returns the engine's response to its supplied operating conditions. The installation adapter supplies the conditions delivered by the actual aircraft inlet, nozzle/exhaust, accessory paths and physical location. Do not assume an engine's uninstalled test-cell thrust equals installed aircraft net thrust under every maneuver.

### Inlet installation state

For each engine, define its own:
- inlet capture geometry, location/orientation, lip and duct reference frames;
- boundary-layer/forebody interaction and any splitter/bleed/bypass features actually fitted;
- pressure-recovery and mass-flow maps or explicitly estimated profiles;
- circumferential/radial distortion descriptors if available;
- spillage and installation drag representation;
- allowable operating envelope and engine compatibility source;
- damage/obstruction/debris/ice state and affected flow path.

Inputs include local free-stream Mach, AoA, sideslip, angular rates, ambient state, aircraft configuration and upstream forebody/vortex/wake field. Outputs are a bounded inlet state: recovered total-pressure condition, mass-flow compatibility, distortion metrics, spill/installation drag and validity/uncertainty. The engine owner consumes these through a typed interface.

### Coupled engine response

Where the selected engine model supports it, inlet conditions may affect:
- corrected mass flow and pressure recovery;
- available thrust and spool response;
- compressor operating margin/stability;
- acceleration/deceleration schedules and relight/recovery envelope;
- temperature/limit state and engine damage/failure.

Do not invent a compressor surge threshold or simulate a precise stall line from a generic distortion scalar. If no exact engine/inlet compatibility data are public, use a clearly estimated or synthetic-only response profile and limit the claimed behavior. Engine-family thermodynamics/spool dynamics remain in physics/propulsion.

### Spillage and installation forces

Capture spillage/installation drag as a distinct force contribution at a documented application point. Do not add the same inlet drag inside both engine thrust output and aircraft aerodynamic coefficient data. Define whether propulsion output is gross thrust, net installed thrust or a force after inlet/ram/spillage terms; only one owner may apply each contribution.

The inlet adapter may also publish a local flow/distortion field for equipment that physically depends on it, but it must not create hidden engine knowledge for sensors/AI.

### Exhaust/nozzle and jet interaction

For each engine installation record:
- nozzle position/axis/area and orientation;
- dry/afterburning/other supported operating states;
- nozzle-area/control schedule only where exact fit and evidence permit;
- exhaust direction, temperature and pressure as an explicitly scoped field;
- nearby surface/structure interaction regions and valid envelopes;
- thermal damage/fire zones and visual effect references.

A reduced-order jet field may influence nearby control surfaces or airframe only if supported by geometry and evidence. It must be local and stateful enough to respond to throttle/engine state, aircraft attitude and ambient conditions. A particle plume/heat shimmer is not a jet-flow model. Do not use generic thrust multipliers to create pitch authority.

### Twin-engine and asymmetric cases

The F-16 single-engine installation and MiG-29 twin RD-33 installations have different force locations, inlet geometry and asymmetry behavior. For twin-engine aircraft each engine retains separate spool, fuel feed, inlet state, accessory loads, damage, fire and nozzle/exhaust state. Engine-out/asymmetric thrust creates force and moment from the real installation locations. Do not multiply one engine result or average both engines.

### Validation

- Inlet state at reference Mach/AoA/sideslip conditions.
- Pressure-recovery/distortion trend against applicable source or declared synthetic fixture.
- Spillage drag once and at correct force point.
- Distorted-flow impact on engine response where engine model supports it.
- Rapid throttle transient, inlet upset and recovery behavior.
- Twin-engine left/right independent behavior and asymmetric thrust moment.
- Engine accessory load coupling to electrical/hydraulic systems.
- Exhaust interaction only for declared affected surfaces.
- Inlet/engine damage, fire and restart/relight paths where supported.
- Energy/force accounting, deterministic replay and browser cost.

Research routes: [advanced flight physics references](../../../docs/reference-library/advanced-flight-physics.md), especially NASA inlet performance/distortion reports.
