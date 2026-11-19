# Claude Implementation Guide — Integrate the Entire Iron-Front Simulation

**Target stack: JavaScript + TypeScript + HTML5, browser runtime, static GitHub Pages deployment.**

This is the primary cross-system implementation brief. Read it together with the subsystem guides. It takes precedence where a subsystem guide is silent about integration. It does not authorize a ground-up rewrite without auditing the current application.

## Mission

Turn the repository's separate planned domains into one coherent, modular, dynamic simulation. Aircraft, engines, atmosphere, aerodynamics, flight controls, hydraulics, electrics, fuel, damage, stores, radar, IRST, RWR, cockpit, AI and graphics must interact through explicit physical and software dependencies.

Do not implement a large set of disconnected stubs, fake data paths or booleans. Build one complete, testable vertical slice, then expand.

## Phase 0 — Audit the actual repository

Before coding:
- Inspect every current source file, HTML entry point, JavaScript module, package/build config, asset and test.
- Identify actual runtime entry point and GitHub Pages base path.
- Inventory current aircraft modules, existing F-16/MiG-29 code, simulation loop, physics, rendering, sensors, UI and saves.
- Identify any duplicate or competing owners.
- Report what is genuinely implemented, partially implemented, placeholder or broken.
- Do not assume prior architecture folders contain code.
- Do not invent a framework or replace the current renderer/build tooling without a written justification.
- Preserve existing gameplay with a migration plan and regression baseline.

Deliver an audit document/table with current file paths, owner, status, dependencies, reuse/replacement decision and tests.

## Phase 1 — JavaScript/TypeScript architecture

Use TypeScript for new high-risk simulation code and shared contracts where build tooling supports it. Keep existing JavaScript working through ES-module boundaries and gradual migration. HTML5 owns the browser shell and accessible UI. Avoid global mutable state and circular imports.

If the repository has no TypeScript build setup, propose the smallest static-site-compatible setup (for example, a minimal compiler/bundler only if needed), explain how GitHub Pages receives the compiled static output, and add it without breaking current deployment. Do not assume a Node server is available at runtime. Never place Node-only APIs in browser simulation modules.

Define strict contracts for units, frames, tick time, configuration, runtime state, commands/events, resource requests/allocations, sensor reports and render snapshots. Validate aircraft definitions at load; fail loudly with useful diagnostics for invalid required data.

## Phase 2 — Integration architecture before feature expansion

Create a canonical ownership/dependency map and enforce it in code:
- Each subsystem owns its runtime state.
- Other systems consume typed read-only outputs or submit commands/resource requests.
- Commands are validated and applied at deterministic tick boundaries.
- Events describe completed state changes.
- No direct mutation of another subsystem's private fields.
- No duplicate atmosphere, rigid-body, fuel, damage, sensor-track or resource manager.
- Dependency graph validation must detect missing providers and cycles.

Implement the simulation clock, ordered update phases and resource/event services before broad coupling. Use a fixed/controlled physics step independent of render delta. Rendering interpolates snapshots only.

## Phase 3 — Dynamic resource and failure propagation

Implement a real dependency/resource network, not `isPowered: boolean` shortcuts. Model appropriate capacity, demand, priority, pressure/voltage/flow, losses, transient response and failure state for the aircraft being simulated.

At minimum, the first aircraft must demonstrate:
- Fuel tank → selector/pump/feed → engine fuel demand; burn changes tank mass and aircraft CG/inertia.
- Engine shaft/accessory output → generator → electrical bus → avionics, displays, radar and pumps according to actual fit.
- Hydraulic source/reservoir/lines → actuators, flight controls, gear and brakes according to actual architecture.
- Cooling/thermal state → engine and sensor equipment availability.
- Damage → line leak, bus fault, jam, sensor degradation or structural/aerodynamic change.
- Stores → mass, inertia, drag, hardpoint and sensor-signature configuration.

Do not assume every F-16 variant has identical redundancy, buses, hydraulic architecture, engine, radar or avionics. Use a chosen documented variant's architecture and label unknowns.

## Phase 4 — F-16 first complete aircraft module

Expand `game/modules/planes/F-16/` into a complete variant-aware package. Read [F-16 implementation guide](../../game/modules/planes/F-16/CLAUDE_IMPLEMENTATION_GUIDE.md).

Do not make a generic F-16 data blob. Separate:
- Family-level common identity and shared geometry conventions.
- Exact block/variant configuration.
- Engine fit and control baseline.
- Flight-control laws and actuator characteristics.
- Aerodynamic datasets and supported envelope.
- Fuel distribution and mass properties.
- Electrical/hydraulic systems and resource routing.
- Radar/RWR/IRST/EO/navigation equipment fits.
- Cockpit controls, instruments and avionics pages.
- Weapons/stores and their configuration effects.
- Damage zones, failure modes and maintenance.
- Visual assets, animation and audio.

The F-16 module must configure shared solvers through interfaces. Do not put the shared 6-DoF solver, radar propagation engine or generic engine family solver inside the F-16 folder.

## Phase 5 — Flight model and propulsion coupling

Connect:
pilot/AI input → aircraft flight-control laws → actuators/actual deflection → local airflow per surface → aerodynamic force/moment → rigid-body integration.

Connect:
throttle → engine control → dynamic spool/gas-path model → thrust/torque/fuel/heat/vibration → aircraft force/moment, mass-property, electrical/accessory and thermal-signature consumers.

Connect atmosphere to both aircraft and sensors using appropriate distinct queries. Do not use ground speed as airspeed. Do not make the engine set aircraft speed directly. Do not use render delta for physics.

## Phase 6 — Sensor and avionics coupling

- Radar uses the physical RF chain and only creates uncertain measurement reports after propagation/scattering/receiver/processing/detection.
- IRST is passive and derives observations from thermal contrast, atmosphere, background, optics and detector state. Do not use world-truth range/identity.
- RWR/ESM receives emissions through an RF observation chain; radar emission does not instantly reveal a perfect emitter identity.
- EO/FLIR uses its own optical/thermal imaging chain.
- Sensor fusion preserves source, timestamps, uncertainty and correlation.
- Datalink carries reports and age; it is not perfect omniscience.
- Aircraft-specific avionics controls sensor modes, cueing, symbology and limitations.
- Electrical power, cooling, alignment, damage and software baseline constrain sensors.

## Phase 7 — Cockpit and graphics

The cockpit is an aircraft-specific presentation/input surface. Controls issue commands through system interfaces. Instruments display sampled subsystem values, timestamp, quality, stale/failure state and electrical availability. Do not wire cockpit buttons to arbitrary booleans.

Graphics reads immutable simulation snapshots. It may interpolate, animate and visualize effects, but never changes physical state, collision, damage or sensor outcomes. Sensor debug visuals must consume production sensor outputs. Keep HTML5 UI and renderer responsive without slowing authoritative simulation.

## Phase 8 — Validation and interaction scenarios

Create automated deterministic scenarios and a developer diagnostic view. At minimum, prove:
1. Fuel burn changes mass/CG/inertia and measurable handling.
2. Hydraulic leak causes pressure decay, actuator slowdown/authority loss, changed control response and appropriate warnings.
3. Electrical bus failure disables only downstream consumers and uses backup supply only where the selected variant has it.
4. Engine transient affects thrust, fuel, thermal state and IR signature with correct delays.
5. Afterburner affects thrust/fuel/heat/exhaust signature; IRST sees only what its independent model resolves.
6. Stores alter mass, inertia, drag and configuration.
7. Surface/engine/antenna/window damage changes the corresponding physics or sensor performance.
8. Weather changes local aero performance, visibility and RF/IR propagation through separate models.
9. Radar emissions can be observed by an appropriate RWR through a causal chain.
10. IRST can fail to detect a target and normally reports angular uncertainty, not hidden exact range.
11. Lost datalink causes track aging/coasting rather than world-truth updates.
12. Replay of the same seed and commands reproduces the same state within declared numeric tolerances.

Every scenario must state initial conditions, expected causal chain, measured outputs, tolerances and known approximations.

## Phase 9 — Prove modularity with a second aircraft

After F-16 vertical slice is validated, implement a second aircraft with materially different aerodynamics, control architecture, propulsion and sensor fit (the existing MiG-29 module is a likely candidate). The second aircraft must use the shared runtime while retaining its own data and aircraft-specific systems. If adding it requires copying the F-16 solver, the architecture is wrong.

## Rules Claude must not violate

- Do not replace working code with a giant speculative rewrite.
- Do not create empty stubs and report features as implemented.
- Do not add generic `Aircraft.update()` that contains every subsystem's logic.
- Do not use one universal aero curve, engine model, radar or cockpit for all planes.
- Do not let the renderer, UI or campaign world supply perfect sensor knowledge.
- Do not model all system availability as booleans.
- Do not use unseeded randomness in state-changing physics.
- Do not silently downgrade the player's flight model or sensor behavior for performance.
- Do not invent classified values; label sourced, estimated, synthetic and unknown data.
- Do not claim DCS parity or validated realism without data-backed tests.

## Required implementation report on every stage

Claude must list exact files changed, actual runtime behavior added, system owners and data flow, equations/approximations, source provenance, tests and outputs, browser/device performance, known gaps and next stage. Separate implemented, partially implemented, stubbed and planned capabilities. A README or folder is not a working subsystem.
