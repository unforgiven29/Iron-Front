# Iron-Front architecture overview

**Authority:** repository-wide ownership, dependency direction and boundaries. Detailed behavior belongs in the README beside its canonical owner. This is an index and boundary map, not one combined implementation manual.

**Status:** initial app shell and a few core primitives exist. Most simulation systems remain unimplemented.

## Dependency direction
1. game/core coordinates time, modules, entities, messages, resources, configuration, persistence, diagnostics and spatial services.
2. physics owns reusable numerical/physical models, including fixed-wing and rotorcraft flight mechanics.
3. game/systems owns reusable platform network/system behavior, including electrical, hydraulic, pneumatic, fuel, cooling, communications, navigation, crew and damage interfaces.
4. sensors owns sensor equipment/processing; physics provides shared propagation/environment models.
5. game/modules contains fixed-wing and rotorcraft aircraft, uncrewed/civil aircraft, weapons, ground units, infantry, naval units, AI, logistics and campaign content/configuration.
6. game/world owns authoritative spatial content and procedural/geospatial placement.
7. game/graphics-engine consumes snapshots and sends commands; it never decides simulation outcomes.

## Canonical ownership

| Concern | Owner | Must not be owned by |
|---|---|---|
| Clock/order/lifecycle/entities/messages | game/core | platform modules, campaign, renderer |
| Resource arbitration | game/core/resources | individual network solvers |
| Electrical generation/distribution/protection | game/systems/electrical | cockpit or physics integrator |
| Hydraulic pumps/circuits/pressure/flow | game/systems/hydraulics | aircraft-local solver or cockpit |
| Pneumatic gas storage/distribution/consumers | game/systems/pneumatics | hydraulic solver or cockpit |
| Fuel storage/feed/transfer | game/systems/fuel | engine-family solver or aircraft-local solver |
| Cooling network and delivered thermal capacity | game/systems/cooling | equipment model or renderer |
| Crew availability/workload/injury interfaces | game/systems/crew | campaign history or renderer |
| Generic component damage/repair state | game/systems/damage | render mesh or individual platform duplicate |
| Six-DoF rigid body | physics/rigidbody | aircraft package or renderer |
| Fixed-wing FM assembly and force/moment composition | physics/flight-model | aircraft package duplicate solver or renderer |
| Local aerodynamic flow and coefficient equations | physics/aerodynamics | aircraft package or FM assembly duplicate |
| Rotor blade/rotor-disk aerodynamics and hub loads | physics/rotorcraft | rotorcraft product module or renderer |
| Weapon guidance laws/navigation command generation | physics/guidance | weapon package or seeker processor duplicate |
| Weapon seeker state/association | sensors/weapon-seeker | weapon product or physics/guidance |
| RF environment/scattering/clutter | physics/radar | radar/RWR receiver |
| Radar/RWR/ESM/IRST/EO/IFF/MAWS/NCTR equipment and processing | sensors/<system> | aircraft package or campaign truth |
| Ground mobility/contact and armour interaction | physics/ground-mobility and physics/armour | vehicle movement script or platform-specific duplicate |
| Weapon composition/lifecycle | game/modules/weapons | physics algorithm owner |
| Platform configuration, installed fit and cockpit mapping | game/modules/<platform> | shared solver |
| Civil aircraft identity/route intent | game/modules/civil-aviation | world renderer or combat AI |
| UAS/FPV/loitering platform and mission configuration | game/modules/uncrewed-systems | generic weapon or sensor subsystem |
| World truth/structures/vegetation/infrastructure | game/world | renderer/sensor/campaign |
| Tactical AI decisions/doctrine | game/modules/ai | physics or hidden state |
| Strategic institutions, diplomacy, public consequences and war state | game/modules/campaign | global core/runtime/physics |
| Legal cases, investigations and accountability | game/modules/campaign/justice | society news projection or tactical truth |
| Persistent campaign personnel/fate/history | game/modules/campaign/personnel | live crew/infantry state |
| Rendering/audio/UI/assets | game/graphics-engine | authoritative systems |

## State and information boundaries
Definitions/configuration are immutable during a scenario except explicit reconfiguration boundaries. Runtime state is changed only by its owner. Other systems receive typed commands, committed events, resource grants, observations and immutable snapshots. Preserve observation source, acquisition time, frame, age, uncertainty and quality through fusion/datalink/AI/presentation. Diagnostics are developer-only and not a hidden information API.

## Platform installation and network composition
Aircraft/vehicle/ship packages define their exact installed power-system graph: sources and mechanical drives, AC/DC buses, converters, batteries, electrical protection, hydraulic circuits/pumps/reservoirs/accumulators, pneumatic bottles/regulators, connected consumers, controls/indications, damage zones and backup/emergency paths. Shared network solvers execute these graphs but never assume every platform has the same equipment or redundancy.

Backup capability is an explicit alternate physical path with activation prerequisites, delay, finite capacity/endurance, load/consumer restrictions, degraded behavior and common failure points. Cross-domain dependencies (for example an emergency unit with both electrical and hydraulic outputs, a pneumatic reservoir pressurizing a hydraulic reservoir, or electrical anti-skid controlling pneumatic brake valves) are declared as typed connections. Do not duplicate a shared source or allow an unrelated circuit to receive its output.

## Composition
Modules have stable IDs, semantic versions, capabilities/API versions, dependencies, configuration schemas and lifecycle. Resolve by capability/version, not folder or display name. Required missing/incompatible/cyclic dependencies fail before startup. Optional dependencies require explicit degraded behavior. A folder is not automatically a module.

## Time and numerical conventions
Authoritative time uses integer ticks and a documented step. Initial rigid-body/control target is 120 Hz, subject to validation. Other systems declare their own update domains. Rendering interpolates immutable snapshots. Use SI, local right-handed ENU world, right-handed FRD aircraft body and normalized [x,y,z,w] body-to-world quaternions as defined in docs/simulation-conventions/README.md.

## Detailed owner guides
Core: game/core/README.md. Physics: physics/README.md, physics/flight-model/README.md and physics/rotorcraft/README.md. Platform systems: game/systems/README.md. Aircraft: game/modules/planes/README.md and exact platform dossiers. Rotorcraft/UAS/civil aviation: corresponding game/modules guides. Sensors: sensors/README.md. Content modules: game/modules/README.md. Campaign: game/modules/campaign/README.md and its focused children. World: game/world/README.md. Presentation: game/graphics-engine/README.md. Legacy capability migration: docs/legacy-game-feature-crosswalk.md. Validation: docs/testing-and-validation/README.md.

## Hosting
The browser client is statically built from game/ and can run local single-player with explicit save export/import. GitHub Pages is not an authoritative multiplayer backend. Persistent co-op needs a separate backend adapter; do not make backend access mandatory to local simulation.
