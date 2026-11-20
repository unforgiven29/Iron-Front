# Iron-Front architecture overview

**Purpose:** Top-level architecture map for developers and Claude. Read before creating files, changing ownership or implementing a subsystem.

**Status:** Architecture specification and scaffolding. This document does not claim the planned runtime exists.

## 1. Architectural shape

Iron-Front is a data-driven modular simulation. Shared engines implement reusable behavior. Content modules describe particular aircraft, vehicles, weapons, sensors, factions, scenarios and world content. Platform modules compose shared capabilities through versioned manifests, validated configuration and explicit interfaces.

Dependency direction:
1. Core provides time, lifecycle, module discovery, commands/events, resource allocation, persistence, diagnostics and spatial services.
2. Shared physics provides reusable physical/numerical models.
3. Sensor, weapon and domain engines consume core/physics contracts and publish observations or effects.
4. Platform/content modules select and configure those capabilities and provide platform-specific adapters.
5. AI/campaign/mission modules consume published world and simulation interfaces; they do not bypass sensors or query hidden truth.
6. Cockpit/UI/audio/rendering consume immutable snapshots and issue typed commands. Presentation never owns authoritative state.

Do not reverse this direction to make a feature work.

## 2. Canonical ownership

| Concern | Owner | Must not be duplicated in |
|---|---|---|
| Clock, tick phases, lifecycle, registry | game/core | Aircraft, weapons, campaign or UI |
| Resource coordination | game/core/resources + game/systems adapters | Individual engines/sensors |
| Rigid-body state/integration | physics/rigidbody | Aircraft packages |
| Atmosphere/local airflow | physics/enviroment | Aircraft or renderer |
| Aerodynamics solver | physics/aerodynamics | Individual aircraft |
| Engine-family solvers | physics/propulsion | Aircraft modules |
| RF propagation/scattering | physics/radar | Radar, RWR or campaign |
| Radar equipment/processing | sensors/Radar | Aircraft packages |
| RWR processing | sensors/RWR | Aircraft RWR installations |
| Ballistics | physics/ballistics | Individual weapons |
| Ground mobility | physics/ground-mobility | Individual tanks/vehicles |
| Armour interaction | physics/armour | Individual vehicle/weapon implementations |
| Generic collision/optics/thermal | physics/collision, physics/optics, physics/thermal | Platform modules |
| Weapon definitions/compatibility | game/modules/weapons + platform adapters | Generic physics engines |
| Vehicle/infantry/naval definitions | game/modules/* | Shared physics |
| World truth | game/world | Renderer, sensors or campaign |
| Rendering/cockpit/audio/UI | game/graphics-engine | Simulation authority |
| Campaign rules | game/modules/campaign | Global core/runtime |

The owner is the only place that defines authoritative behavior for that concern. Other modules integrate through public contracts.

## 3. Module composition

Every loadable module has a stable ID, semantic version, kind, declared capabilities, dependencies, configuration schema references and lifecycle expectations. See docs/module-system/ and its JSON schema/template.

Depend on capability IDs and compatible API versions, not folder paths or concrete product names. Dependency resolution must detect missing providers, incompatible versions, cycles and duplicate providers before simulation begins. Optional dependencies declare explicit degraded behavior. Never silently substitute an unrelated system.

Use composition over inheritance. An aircraft composes its selected flight controls, propulsion, resources, sensors, weapons, damage, cockpit and asset modules. A replacement that satisfies the same interface should be selectable through configuration, not a hardcoded name branch.

## 4. Separate definitions, state and observations

- Definitions: immutable descriptions of modules/equipment.
- Configuration: selected variant, installation and scenario inputs; validate before use.
- Runtime state: mutable state owned by one subsystem.
- Observations: imperfect measurements with source, time, frame, quality and uncertainty.
- Commands: requests, not guaranteed outcomes.
- Events: facts published after an owner commits a state transition.
- Snapshots: immutable read models for consumers and presentation.
- Diagnostics: traces, faults, resource state and performance measurements.

Never share mutable internal objects. Rendering or AI must not write directly into physics state.

## 5. Simulation update contract

The simulation clock—not browser rendering—owns authoritative time. Use a fixed or explicitly bounded step, deterministic ordering and seeded random streams. Rendering runs independently and interpolates immutable snapshots.

Proposed high-level tick phases:
1. Collect/validate player, external and AI commands.
2. Resolve lifecycle and resource allocation.
3. Update environment/world fields and spatial indexes.
4. Update propulsion and subsystem controllers from resource grants.
5. Update actuators and controls.
6. Sample local airflow and compute forces/moments.
7. Integrate rigid-body motion and resolve contacts.
8. Update wake, damage and state-changing events.
9. Process sensors from physically available emissions/observations.
10. Update AI/campaign using published reports.
11. Publish immutable snapshots, telemetry, audio cues and render data.

Exact order and multi-rate scheduling must be documented and tested. Do not run a system once per render frame unless that is its explicit contract.

## 6. Resource and failure propagation

Electrical power, hydraulic pressure/flow, fuel, cooling, oxygen, data links and crew availability use explicit resource/service contracts. Providers expose capacity and quality; consumers declare demand, priority and limits; allocators publish grants, shortfalls and reasons.

Avoid universal booleans such as powered, alive, locked or operational when behavior depends on finite capacity, quality, transients or partial failure. Failures propagate through real dependencies and create observable downstream effects.

## 7. Ground truth and observations

World/entity state is ground truth. Sensors, AI and cockpit systems receive only observations permitted by their contracts. Radar, RWR, IRST, EO/FLIR, IFF, MAWS and datalink reports preserve source, acquisition time, age, frame, uncertainty and confidence.

Sensors cannot read hidden campaign positions, exact target states, private radar tracks or future outcomes. Fusion can correlate observations but cannot invent observability.

## 8. Assets and presentation

Physical geometry and visual assets are linked by explicit coordinate conventions, scale, pivots, attachment points and animation bindings. Visual meshes are not automatically authoritative mass, collision, radar-signature or aerodynamic data.

Cockpit controls send commands; instruments/displays/audio consume subsystem snapshots. A clickable switch is not a working system until its command changes a real subsystem through normal interfaces and feedback reflects the resulting state.

## 9. Quality gates

Every new module/change includes a manifest and schema-valid configuration, ownership/interface documentation, data provenance, unit/contract tests, integration tests, failure/degraded/boundary tests, deterministic replay where applicable, performance/memory measurements and documented fidelity limits.

## 10. Browser and hosting

Target HTML5/JavaScript/TypeScript and static GitHub Pages. Core simulation stays independent of DOM and renderer. Workers may perform bounded heavy tasks but must use versioned messages and deterministic result ordering. Static hosting cannot provide persistent authoritative multiplayer, cloud saves or always-on campaign services; those require external adapters/services.

## 11. Change control

If a feature appears to require duplicating an engine, reading private state, adding a platform-name conditional or bypassing a contract, stop and update the relevant interface/ADR first. Prefer a small contract extension over a parallel subsystem. Record material decisions under docs/architecture-decisions/.
