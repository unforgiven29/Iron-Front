# Integrated Simulation Architecture — Iron-Front

**Implementation target:** JavaScript + TypeScript + HTML5, running in modern browsers and deployable as a static GitHub Pages application.

**Status:** This document defines how the subsystems must connect. It is an implementation specification, not a claim that the runtime is already integrated. Audit the current code before building; preserve working behavior and do not create duplicate engines.

## 1. The central design rule

Iron-Front is one coupled simulation, not a collection of independent feature demos. Every subsystem owns its own state and exposes explicit inputs/outputs. A change must propagate through real dependencies, with timing, resource limits, uncertainty and failure behavior.

Examples:
- Fuel burn changes tank mass, aircraft CG/inertia, available endurance and engine feed state.
- Hydraulic damage reduces actuator authority, which changes actual control-surface deflection, aerodynamic moments and handling.
- Electrical generation/load changes determine which avionics, radar, cooling and cockpit equipment can operate.
- Engine power changes thrust, fuel flow, heat, exhaust signature, IRST observability, vibration and available accessory power.
- Aircraft attitude and local atmosphere change radar/IRST line of sight and antenna/sensor orientation.
- Weather changes air density, turbulence, icing, visibility, RF/IR propagation and aircraft performance through the appropriate distinct models.
- Stores alter mass, inertia, drag, signatures and weapon availability.
- Damage changes geometry, leakage, sensor calibration, electrical/hydraulic paths and flight behavior.
- Radar emissions can be detected by RWR/ESM; IRST remains passive and independently processes thermal contrast.
- Datalink transports timestamped reports; it does not create perfect onboard detections.
- Rendering reflects subsystem state but never causes simulation outcomes.

A dependency is only real when a change in the upstream state can be traced through explicit interfaces and covered by a test.

## 2. Technology and browser constraints

- Use TypeScript for new simulation contracts, core stateful systems and high-risk physical logic wherever the existing build permits.
- Existing JavaScript must remain interoperable. Migrate incrementally; do not rewrite the whole application just to adopt TypeScript.
- Use browser-native HTML5/CSS/DOM for shell, menus and accessible controls. Keep the renderer behind an adapter and use the existing graphics library if one exists.
- GitHub Pages serves static assets. The client may run local/single-player simulation and local saves. Persistent authoritative multiplayer requires an external service/backend; do not pretend static hosting is a server.
- Do not add a server-only dependency to code that must execute in the browser.
- Establish the actual build/test/deploy path from the repository. Do not assume Vite, Webpack, Three.js, Babylon.js or a physics library before auditing.
- Use ES modules and explicit import boundaries. Avoid global mutable singletons and circular imports.
- Validate all browser APIs and GPU capabilities; provide graceful fallback for unsupported graphics features.

## 3. Canonical ownership map

| Domain | Canonical owner | Must not own |
|---|---|---|
| Clock/order/events/entities | `game/core/` | aircraft-specific rules |
| Rigid-body state/integration | `physics/rigidbody/` | render transforms |
| Atmosphere/weather field | existing `physics/enviroment/` owner | radar/IRST-specific attenuation |
| Aero and local flow | `physics/aerodynamics/` | aircraft variant configuration |
| Wake/vortices | `physics/wake/` | scripted aircraft upset |
| Engine family physics | `physics/propulsion/` | aircraft tank inventory |
| Shared resource network | core resource service + owning system adapters | direct cross-system field mutation |
| Radar physics/equipment | `physics/radar/` + `sensors/Radar/` | perfect world contacts |
| RWR/ESM equipment and processing | `sensors/RWR/` | radar target tracks or campaign truth |
| Shared RF emission/path environment | existing `physics/radar/` propagation owner, extended for direct interception paths | RWR classification or threat display |
| IRST equipment/processing | `sensors/IRST/` | target true range/identity |
| EO/FLIR, IFF | their sensor modules | generic perfect detection |
| Aircraft definition/installation | `game/modules/planes/<aircraft-id>/` | duplicated copies of shared solvers |
| Cockpit commands/displays | aircraft cockpit + owning subsystem contracts | direct mutation of hidden internals |
| Rendering/assets | `game/graphics-engine/` | physics, damage, detection or campaign truth |
| Campaign/AI/logistics | owning game systems | bypassing sensor/fog-of-war contracts |

If an existing implementation owns one of these capabilities already, retain it and document the canonical location. Move/rename only through a deliberate migration, not by creating a second owner.

## 4. Shared simulation tick and causal order

Use one authoritative simulation clock and fixed/controlled physics timestep. Rendering runs separately and interpolates snapshots. Define deterministic stages such as:

1. Apply validated player/AI commands at tick boundary.
2. Resolve resource network availability (fuel feed, electrical power, hydraulic pressure, cooling).
3. Update environment fields and spatial indexes for this tick.
4. Update engine controls and propulsion component states.
5. Update aircraft systems, actuators, gear, stores and configuration.
6. Sample atmosphere/local induced flow at each aero surface.
7. Calculate aero, propulsion, ground/contact and other forces/moments.
8. Integrate 6-DoF rigid-body state.
9. Update wake/vortex emission and query encounter state using a documented previous/current policy.
10. Update damage/failures and emit domain events; define whether newly caused failures affect current or next tick.
11. Update sensor emissions and receiving systems: publish time-bounded transmitter events; evaluate propagation and antenna orientation; create measurements, detections and tracks.
12. Update AI using only observations available to that entity, not hidden world truth.
13. Publish immutable snapshots and events for cockpit, UI, audio and graphics.

This order is a baseline, not permission to create circular dependencies. Define explicit read/write phases and event timing. If an engine or sensor needs a resource value, it reads a resource allocation result; it does not reach into another subsystem's mutable internals.

## 5. Typed contracts and state boundaries

Create versioned TypeScript interfaces (or equivalent documented JS contracts during migration) for:
- Entity identity and lifecycle.
- World/body/local coordinate frames and transforms.
- Simulation time, tick index and deterministic random streams.
- Immutable aircraft/engine/sensor configuration.
- Mutable runtime state owned by each subsystem.
- Commands, domain events and event payload schemas.
- Resource requests, allocations, flow and failure reasons.
- Force/moment contributions and application points.
- Sensor measurements, detections, classifications and tracks.
- Cockpit instrument samples with timestamps, quality and validity.
- Render snapshots and diagnostic telemetry.

Use branded or otherwise distinguishable types for meters, seconds, radians, kilograms, pascals, newtons, newton-metres, watts, kelvin and other SI units where practical. Make coordinate frame conversions explicit. Never pass a render-space vector into physics without a named conversion.

Configuration is immutable and validated at load. Runtime state is mutable only by its owning subsystem. Cross-system communication uses commands/events/read-only snapshots/resource interfaces, not arbitrary object references.

## 6. Dynamic coupling and dependency graph

Build a declarative dependency/resource graph. Examples of providers and consumers:
- Engine generates shaft/accessory power; generator converts mechanical power to electrical supply.
- Electrical buses supply engine controls, radar, cooling, displays, pumps and actuators where the aircraft architecture requires them.
- Hydraulic pumps/reservoirs/lines supply control surfaces, landing gear, brakes and other hydraulic consumers.
- Fuel tanks, pumps, selectors and feed lines supply engine demand; fuel burn/transfer updates aircraft mass properties.
- Engine produces thrust, heat, vibration, exhaust and thermal signature.
- Atmosphere provides local density, temperature, pressure, wind and weather; aero, engine, radar and IRST consume different derived quantities.
- Damage can sever lines, jam mechanisms, degrade sensors, leak fuel, reduce structural strength or alter aerodynamic geometry.
- Stores and pylons affect mass, inertia, drag, radar/IR signature and weapon interfaces.
- Sensor reports feed avionics, AI and datalink with age/uncertainty/source preserved.
- Radar transmitters publish actual emissions; RWR/ESM intercepts only the received RF energy after antenna, propagation and receiver limitations. Radar detection/track state is not an RWR input.
- Cockpit displays consume actual subsystem outputs and reflect power, cooling, failure and stale data.

Do not model all resources as one boolean `powered`. Use capacity, demand, priority, voltage/pressure/flow/temperature limits, allocation, transient response and failure states appropriate to the domain. The system must explain why a consumer is unavailable.

## 7. Aircraft modules: plug-in configuration, shared solver

Every aircraft is a modular package loaded by a common aircraft runtime. An aircraft module contains its own:
- Identity, variant, block/lot and data baseline.
- Geometry, reference dimensions, hardpoints and attachment transforms.
- Mass, empty mass, fuel distribution, CG and inertia model.
- Aero surface layout and coefficient datasets.
- Flight-control architecture, control laws, actuator maps and trim.
- Engine fit, inlet/nozzle installation and engine control interface.
- Electrical, hydraulic, fuel, environmental and other aircraft systems.
- Sensors and exact equipment/software baseline.
- Weapons/stores compatibility and configuration effects.
- Damage/failure zones and repair/maintenance mapping.
- Cockpit layout, controls, instruments and display mapping.
- Visual model, animations, sounds and asset metadata.
- Source provenance, uncertainty, supported envelope and validation tests.

The shared runtime provides generic lifecycle, solver interfaces, update scheduling, resource graph, sensor pipeline, damage event routing and snapshot publication. It must not assume all aircraft share the same aerodynamic curves, flight-control laws, engines, sensor capabilities or cockpit.

A new aircraft should be addable mainly by creating a new data/configuration and aircraft-specific system adapters, not by copying and editing the F-16 physics engine. Aircraft-specific code is justified when a real design/system difference requires it.

## 8. F-16 as first integrated reference aircraft

Use the F-16 module as the first complete integration target, not as the template that forces every aircraft to behave like an F-16. First inspect the existing F-16 files and decide the exact model/variant/block, engine fit, radar, RWR, navigation and cockpit baseline. Do not silently combine capabilities from different blocks or export customers.

The F-16 must prove the complete path:
- Pilot input → aircraft-specific flight-control logic → actuator/hydraulic availability → actual surface positions → local aero loads → 6-DoF response.
- Throttle → engine control → spool/transient state → thrust and fuel flow → mass-property update and engine heat/signature.
- Generator/power/hydraulics/cooling → equipment availability and actuator behavior.
- Radar/IRST/RWR equipment → physical sensor chain → uncertain reports → avionics/cockpit presentation.
- Stores/fuel/damage/weather → mass, drag, inertia, control, propulsion and sensor changes.
- Damage/failure → warnings and cockpit indications → changed system capability and aircraft handling.
- Render model and cockpit controls → command/output adapters only; never direct physics mutation.

Do not label the F-16 complete until the integration and validation matrix in [F-16 guide](../../game/modules/planes/F-16/CLAUDE_IMPLEMENTATION_GUIDE.md) passes.

## 9. Observability and validation

Every coupled feature needs a traceable event/diagnostic chain: input, owner, state transition, downstream consumers and resulting measurements. Add a developer dependency inspector that can answer: "why is this system unavailable?", "what changed this value?", and "which systems consumed this event?"

Required integration scenarios include:
- Fuel burn and transfer change CG/inertia and flight response.
- Hydraulic pressure loss reduces control authority and affects gear/brakes.
- Electrical bus failure disables only equipment on that bus and triggers backup paths if fitted.
- Engine throttle/afterburner transients change thrust, fuel, heat, exhaust and IRST signature.
- Engine/inlet damage changes thrust, vibration, temperature and asymmetric moments.
- Icing changes local aero behavior and may affect probes/sensors.
- Stores change drag/mass/CG and radar/IR signature assumptions.
- Radar emission can create an RWR observation after propagation and processing, without requiring radar to track the RWR aircraft.
- Silent/receive-only radar creates no emission-based RWR detection.
- RWR bearing-only tracks do not invent range; emitter identity, hostile status, tracking evidence and launch warning remain separate assessments.
- IRST can miss a target due to aspect/background/atmosphere and can provide angular-only tracks.
- Weather simultaneously affects aircraft performance and the distinct radar/IR/visibility models.
- Damage to an antenna/optical window/cooling circuit degrades the corresponding sensor.
- Stale or lost datalink updates age tracks rather than teleporting perfect truth.

Test unit behavior, contracts, integration, deterministic replay, save/load migration, timestep sensitivity, browser performance and failure cases. Build scenario tests around system interactions, not only isolated math functions.

## 10. Implementation stages and definition of done

1. Repository audit and system ownership map.
2. Establish TS/JS build boundaries, contracts, units, frames and test runner.
3. Core simulation clock, event/resource contracts and diagnostic trace.
4. Shared aircraft module loader/schema/validation.
5. F-16 vertical slice: controls, aero, rigid body and propulsion.
6. F-16 resource systems, damage, stores and dynamic mass properties.
7. F-16 radar/IRST/RWR integration and cockpit output.
8. Graphics snapshot adapter and detailed F-16 external/cockpit presentation.
9. Integrated scenario tests and data/flight-envelope validation.
10. Extract reusable interfaces, then implement a second aircraft with deliberately different systems to prove the abstraction.
11. Expand aircraft fleet incrementally; each one has its own validation report.

A subsystem is integrated only when its inputs/outputs are connected, ownership is clear, failure/resource interactions work, tests prove propagation and the UI reflects real state. A diagram or folder is not implementation.
