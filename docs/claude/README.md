# Claude Code documentation router

This file is the reading map, not a duplicate of every subsystem design. Detailed instructions live beside the system that owns the behavior.

**Before routing a task:** read [PROJECT_STATE.md](PROJECT_STATE.md). It tells you what is executable, what is specification-only and which roadmap stage is currently allowed. Do not interpret a detailed owner guide as proof that its subsystem exists.

## Authority order

1. `CLAUDE.md`: agent operating rules and project boundary.
2. `docs/claude/PROJECT_STATE.md`: current implementation evidence and starting stage.
3. `docs/ARCHITECTURE_OVERVIEW.md`: canonical ownership and dependency direction.
4. `docs/implementation-roadmap/README.md`: stage order and exit criteria.
5. `docs/module-system/README.md`, `docs/integration-contracts/README.md`, `docs/data-standards/README.md` and `docs/simulation-conventions/README.md`: shared contracts/data rules.
6. Canonical owner README for the task.
7. Direct producer/consumer README, platform/content guide, technical reference or ADR only if directly involved.

A subsystem guide may refine but may not contradict global ownership/conventions. On conflict, stop and identify the conflict before coding.

## Task router

| Task | Read first | Read only when directly involved |
|---|---|---|
| Registry, scheduler, entities, messages, resources, persistence | game/core/README.md and exact game/core service README | module-system, integration-contracts |
| Fixed-wing aircraft forces / 6-DoF | physics/README.md, rigidbody, aerodynamics, environment | exact aircraft, propulsion, collision |
| Rotor blade aerodynamics / helicopter dynamics | physics/rotorcraft/README.md and game/modules/rotorcraft/README.md | exact rotorcraft installation, propulsion, rigidbody, hydraulics, crew |
| Aircraft FM assembly / panels / coefficient data / trim | physics/flight-model/README.md and relevant child guide | exact aircraft flight-model dossier, rigidbody, aerodynamics, propulsion, actuator/resources as involved |
| Aircraft control surfaces / high-lift devices | physics/flight-model/control-surfaces/README.md and high-lift-devices/README.md | exact aircraft controls-and-actuators and systems dossiers |
| Flight-model verification / flight-log comparison | physics/flight-model/verification/README.md and tests/README.md | exact aircraft validation plan and acceptance suite |
| Engine or motor | physics/propulsion/README.md | platform engine fit, fuel, cooling |
| Electrical generation/distribution | game/systems/electrical/README.md | exact aircraft systems/electrical.md, propulsion/accessory drive, cooling, exact consumers/load list |
| Hydraulic pressure/flow/actuators | game/systems/hydraulics/README.md | exact aircraft systems/hydraulics.md, pneumatics if coupled, flight controls/gear/brakes, cooling |
| Pneumatic/stored-gas systems | game/systems/pneumatics/README.md | exact aircraft systems/pneumatics.md, hydraulic reservoir/gear/brake interfaces |
| Auxiliary/ECS/thermal integration | game/systems/cooling/README.md and physics/thermal/README.md | exact aircraft systems/auxiliary-environmental.md, electrical and pneumatic installations |
| Fuel/feed/transfer | game/systems/fuel/README.md | exact platform fuel topology, propulsion, mass properties |
| Radar | sensors/Radar/README.md, docs/radar/README.md, physics/radar/README.md | only relevant numbered radar chapters and exact equipment installation |
| RWR / ESM | sensors/RWR/README.md or sensors/ESM/README.md | physics/radar and exact receiver installation |
| IRST, EO/FLIR, MAWS, IFF, NCTR, fusion | exact sensors/<system>/README.md; NCTR uses sensors/NCTR/README.md | physics/optics, equipment install and integration contracts |
| Weapon product/variant composition | game/modules/weapons/README.md and the exact category guide | game/modules/weapons/components/README.md; platform launcher only when involved |
| Anti-tank missile guidance and launcher sights | game/modules/weapons/missiles/anti-tank/README.md | exact infantry/vehicle launcher, seeker/guidance/ballistics and optics owners |
| Weapon guidance architecture/law | game/modules/weapons/components/guidance/README.md and the matching physics/guidance page | exact seeker profile and permitted navigation/command producer |
| Weapon seeker architecture/track | game/modules/weapons/components/seekers/README.md and only the relevant family page | sensors/weapon-seeker/README.md and its matching family processor |
| Dynamic chaff/flare/decoy interaction | game/modules/weapons/countermeasures/README.md and only the relevant decoy profile | sensors/weapon-seeker/countermeasure-discrimination/README.md; physics/radar or optics/thermal only when directly relevant |
| Missile trajectory, motor or vehicle fidelity | missiles/README.md, physics/ballistics/README.md and physics/propulsion/README.md | physics/guidance, exact missile variant and seeker profile only as needed |
| Tanks, IFVs, artillery, air defence | game/modules/ground-units/README.md and exact platform family | mobility, rigidbody, armour, ballistics, crew, sensors as needed |
| Infantry movement/squads/first-person combat | game/modules/infantry/README.md and exact behaviour/combat/equipment guide | physics/collision, ballistics, optics, communications, medical-support |
| Infantry wounds/medics/medevac | game/modules/infantry/medical-support/README.md | game/modules/campaign/personnel/README.md, game/systems/crew and logistics |
| Rotorcraft, AH-64/Ka-50 and transport helicopters | game/modules/rotorcraft/README.md and physics/rotorcraft/README.md | exact variant, sensors, weapons, crew, systems |
| FPV/UAS/loitering munitions | game/modules/uncrewed-systems/README.md | weapons, sensors, communications, navigation, AI, logistics |
| Civil air traffic / airliners | game/modules/civil-aviation/README.md | world/infrastructure, navigation, communications, campaign/society |
| Surface ships, submarines, maritime operations | game/modules/naval-units/README.md | subsurface-and-maritime-operations, carrier-operations, water, sensors, weapons |
| AI / GCI / AWACS / tactical command hierarchy | game/modules/ai/README.md and relevant role guide | observation, communications and sensor owners |
| Campaign world-war / generated vs real Earth theatre | game/modules/campaign/world-war/README.md | game/world, campaign/scenarios, logistics, AI |
| Strategic institutions / diplomacy / national decisions | game/modules/campaign/institutions/README.md | factions, world-war, intelligence, personnel |
| Campaign intelligence / deception / media claims | game/modules/campaign/intelligence/README.md | sensors, communications, campaign/society |
| Civilian society / news / humanitarian services | game/modules/campaign/society/README.md | world/infrastructure, logistics, personnel |
| Justice / investigations / legal accountability | game/modules/campaign/justice/README.md | campaign/society, personnel and event evidence |
| Personnel records / CSAR / POW / memorials | game/modules/campaign/personnel/README.md | game/systems/crew, infantry/medical-support, campaign/society |
| Strategic bombers / ballistic or nuclear escalation | game/modules/campaign/strategic-operations/README.md | weapons, naval, air-defence, intelligence and campaign/institutions |
| Logistics / production / trade / supply convoys | game/modules/logistics/README.md | world/infrastructure, campaign/world-war and persistence |
| Terrain, world generation, streaming, interiors | game/world/README.md and exact child guide | core/spatial, collision, propagation, renderer |
| Renderer, cockpit, audio, assets | game/graphics-engine/README.md and docs/assets-and-pipeline/README.md | exact cockpit/asset owner, renderer ADR |
| Tests and benchmarks | docs/testing-and-validation/README.md and exact game/tests/<type>/README.md | subsystem's acceptance scenarios |
| Legacy game feature migration/parity audit | docs/legacy-game-feature-crosswalk.md | only the canonical owners for features being migrated |

## Expected content in every owner README

A useful guide defines: purpose; owner and non-owners; state/configuration separation; public inputs/outputs; dependencies; tick/update domain; resource use; normal/degraded/failed/recovery behavior; data/provenance; test matrix; performance concerns; first implementation slice; status and known gaps.

Do not create a runtime module just because a folder exists. Do not repeat global Claude rules in every README. A child folder can be a data category or private implementation detail rather than an independently loadable module.
