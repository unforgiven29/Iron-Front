# Iron-Front architecture overview

Read this before creating files, changing ownership or implementing subsystems. This is the project architecture authority; subsystem READMEs refine it but must not contradict it.

**Status:** Architecture specification and initial executable shell. Most simulation systems remain unimplemented.

## Dependency direction

1. game/core owns time, lifecycle, module discovery, command/event dispatch, resource coordination, persistence, diagnostics and spatial services.
2. physics owns shared physical/numerical services.
3. sensors and domain engines consume public contracts and publish observations/effects.
4. Platform/content modules select and configure capabilities and provide installation-specific adapters.
5. AI/campaign/mission modules consume published world/sensor reports and events; they do not query hidden truth.
6. Cockpit/UI/audio/rendering consume immutable snapshots and issue typed commands; presentation never owns authoritative state.

## Canonical ownership

| Concern | Owner | Must not be duplicated in |
|---|---|---|
| Clock, tick phases, lifecycle, registry | game/core | Aircraft, weapons, campaign or UI |
| Resource coordination | game/core/resources plus game/systems adapters | Individual engines/sensors |
| Rigid-body state/integration | physics/rigidbody | Aircraft packages |
| Atmosphere/weather | physics/environment | Aircraft or renderer |
| Aerodynamics/local airflow | physics/aerodynamics | Individual aircraft |
| Engine-family solvers | physics/propulsion | Aircraft modules |
| RF propagation/scattering | physics/radar | Radar, RWR or campaign |
| Radar equipment/processing | sensors/Radar | Aircraft packages |
| RWR processing | sensors/RWR | Aircraft RWR installations |
| Ballistics | physics/ballistics | Individual weapons |
| Ground mobility | physics/ground-mobility | Individual ground vehicles |
| Armour interaction | physics/armour | Individual platforms |
| World truth | game/world | Renderer, sensors or campaign |
| Rendering/cockpit/audio/UI | game/graphics-engine | Simulation authority |
| Campaign rules | game/modules/campaign | Global core/runtime |

The canonical owner is the only authoritative implementation. Others consume its public interfaces.

## Composition and configuration

Every loadable module has stable ID, semantic version, kind, capabilities, dependencies, configuration schemas and lifecycle. Resolve dependencies by capability/API version, not folder path or display-name conditionals. Missing required providers and cycles fail before startup. Optional absence has explicit degraded behavior; no silent substitution.

Use composition, not deep inheritance. Aircraft/vehicle/weapon packages supply immutable variant/install/configuration data and platform adapters. Shared engines remain platform-neutral. Replace providers by configuration only when the replacement satisfies the same interface and tests.

## State and information boundaries

Separate immutable definitions/configuration, mutable runtime state, observations, commands, committed events, immutable snapshots and diagnostics. One owner changes each authoritative state. Sensors and AI see only reports permitted by interfaces; preserve source, time, frame, age, quality and uncertainty.

## Time and coordinate conventions

Read docs/simulation-conventions/README.md. Initial physics/control timestep target is 120 Hz; rendering is independent. World uses right-handed local ENU; aircraft body uses right-handed FRD; quaternions are [x,y,z,w] body-to-world. SI units are canonical.

## Implementation order

Follow docs/implementation-roadmap/README.md. The first aircraft vertical slice is F-16C Block 50; MiG-29 product 9.13 is a later second-platform proof. Do not start campaign expansion before core, physics and aircraft contracts work.

## Browser deployment

The app is built from game/ by Vite into dist/ and deploys to GitHub Pages. Static hosting cannot provide persistent authoritative multiplayer. A future backend is an adapter, not a dependency of local simulation.
