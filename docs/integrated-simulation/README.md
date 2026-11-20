# Integrated Simulation Architecture — Iron-Front

**Implementation target:** JavaScript + TypeScript + HTML5 on modern browsers, deployable as static GitHub Pages assets.

**Status:** Integration specification. The executable shell/core primitives are initial scaffolding; full simulation subsystems remain unimplemented.

## Central rule

Iron-Front is one coupled simulation. Each subsystem owns its state and exposes explicit inputs/outputs. A change must propagate through real dependencies with timing, resource limits, uncertainty and failure behavior.

Examples:
- Fuel burn changes tank mass, CG/inertia, endurance and engine feed state.
- Hydraulic damage reduces actuator authority, changing actual surface deflection, aerodynamic moments and handling.
- Electrical generation/load determines which avionics, radar, cooling and cockpit equipment can operate.
- Engine power changes thrust, fuel flow, heat, exhaust signature, IRST observability, vibration and accessory power.
- Aircraft attitude/local atmosphere change radar/IRST line of sight and antenna orientation.
- Weather affects air density, turbulence, icing, visibility, RF/IR propagation and aircraft performance through distinct models.
- Stores alter mass, inertia, drag, signatures and weapon availability.
- Damage changes geometry, leakage, sensor calibration, resource paths and flight behavior.
- Radar emissions may be intercepted by RWR after propagation; IRST independently processes thermal contrast.
- Datalink transports timestamped reports; it does not create perfect onboard detections.
- Rendering reflects subsystem state but never causes simulation outcomes.

A dependency is real only when upstream change can be traced through interfaces and covered by tests.

## Technology and browser constraints

- TypeScript is used for new contracts/core/high-risk physical logic; existing JS remains interoperable.
- Browser-native HTML/CSS/DOM owns shell and accessible controls.
- Vite builds the static app from game/ into dist/; no server-only dependency in browser code.
- Renderer remains behind game/src/rendering/RendererPort.ts. Three.js/Babylon selection is deferred until the controlled comparison prototype is measured.
- GitHub Pages supports client-local simulation and explicit save export/import, not a persistent authoritative multiplayer backend.
- Use ES modules and explicit import boundaries. Avoid global mutable singletons/circular imports.

## Canonical ownership map

| Domain | Canonical owner | Must not own |
|---|---|---|
| Clock/order/events/entities | game/core | aircraft rules |
| Rigid-body integration | physics/rigidbody | render transforms |
| Atmosphere/weather | physics/environment | renderer or sensor-only copies |
| Aero/local flow | physics/aerodynamics | aircraft variant data |
| Wake/vortices | physics/wake | scripted aircraft upset |
| Engine families | physics/propulsion | aircraft tank inventory |
| Resource allocation | core resource service plus domain adapters | direct cross-system mutation |
| Radar physics/equipment | physics/radar + sensors/Radar | perfect world contacts |
| RWR/ESM | sensors/RWR | radar tracks or campaign truth |
| Shared RF propagation | physics/radar | RWR classification/display |
| IRST | sensors/IRST | true range/identity |
| Aircraft installation | game/modules/planes/<id>/ | duplicated shared solvers |
| Weapons | game/modules/weapons plus platform adapters | duplicate ballistics/guidance engines |
| Ground/naval/infantry definitions | game/modules/* | shared physics |
| World truth | game/world | renderer or sensors |
| Rendering/assets | game/graphics-engine | physics/detection/damage/campaign truth |
| Campaign/AI/logistics | owning modules | bypassing observation contracts |

## Tick and causal order

The simulation clock—not render time—owns authoritative updates. Use a fixed/bounded step, deterministic stages and seeded random streams. Initial rigid-body/control target is 120 Hz; other modules declare their own event-driven or multi-rate schedule.

Proposed phases:
1. Apply validated commands at tick boundary.
2. Resolve lifecycle and resource allocations.
3. Update environment and spatial indexes.
4. Update engine controls/propulsion and subsystem controllers.
5. Update actuators, stores and controls.
6. Sample local air and compute forces/moments.
7. Integrate rigid body and contacts.
8. Update wake, damage and state-changing events.
9. Process sensors from physically available emissions/observations.
10. Update AI/campaign from published reports.
11. Publish immutable snapshots, telemetry and presentation data.

Document whether events affect the current or next tick. Rendering interpolates immutable snapshots and never writes back.

## Quality rules

No hidden-state sensor shortcuts, no platform-name branches in shared engines, no generic powered/locked booleans when resource/evidence details matter, no fabricated technical data, no claims of fidelity without validation. See docs/integration-contracts/, docs/data-standards/ and docs/testing-and-validation/.
