# Claude Code documentation router

This file is the reading map, not a duplicate of every subsystem design. Detailed instructions live beside the system that owns the behavior.

## Authority order
1. CLAUDE.md: agent operating rules and project boundary.
2. docs/ARCHITECTURE_OVERVIEW.md: canonical ownership and dependency direction.
3. docs/implementation-roadmap/README.md: stage order and exit criteria.
4. docs/module-system/README.md, docs/integration-contracts/README.md, docs/data-standards/README.md and docs/simulation-conventions/README.md: shared contracts/data rules.
5. Canonical owner README for the task.
6. Direct producer/consumer README, platform/content guide, technical reference or ADR only if directly involved.

A subsystem guide may refine but may not contradict global ownership/conventions. On conflict, stop and identify the conflict before coding.

## Task router

| Task | Read first | Read only when directly involved |
|---|---|---|
| Registry, scheduler, entities, messages, resources, persistence | game/core/README.md and exact game/core service README | module-system, integration-contracts |
| Aircraft forces / 6-DoF | physics/README.md, rigidbody, aerodynamics, environment | exact aircraft, propulsion, collision |
| Engine or motor | physics/propulsion/README.md | platform engine fit, fuel, cooling |
| Electrical, hydraulics, fuel, cooling, damage, comms, navigation, crew | game/systems/README.md and exact system README | core/resources, installed platform topology |
| Radar | sensors/Radar/README.md, docs/radar/README.md, physics/radar/README.md | only relevant numbered radar chapters and exact equipment |
| RWR / ESM | sensors/RWR/README.md or sensors/ESM/README.md | physics/radar and exact receiver installation |
| IRST, EO/FLIR, MAWS, IFF, fusion | exact sensors/<system>/README.md | physics/optics, equipment install and integration contracts |
| Weapon, seeker, fuze, guidance | game/modules/weapons/README.md and exact component guide | physics/ballistics, armour, platform launcher |
| Tanks, IFVs, artillery, air defense, infantry, naval | exact game/modules/<domain>/README.md | mobility, rigidbody, armour, ballistics, crew, sensors as needed |
| AI / GCI / AWACS / command hierarchy | game/modules/ai/README.md and relevant role guide | observation, communications and sensor owners |
| Campaign, mission, faction, logistics, save | campaign/logistics owner guides | world, AI and core persistence |
| Terrain, world generation, streaming | game/world/README.md and exact child guide | core/spatial, collision, propagation, renderer |
| Renderer, cockpit, audio, assets | game/graphics-engine/README.md and docs/assets-and-pipeline/README.md | exact cockpit/asset owner, renderer ADR |
| Tests and benchmarks | docs/testing-and-validation/README.md and exact game/tests/<type>/README.md | subsystem's acceptance scenarios |

## Expected content in every owner README
A useful guide defines: purpose; owner and non-owners; state/configuration separation; public inputs/outputs; dependencies; tick/update domain; resource use; normal/degraded/failed/recovery behavior; data/provenance; test matrix; performance concerns; first implementation slice; status and known gaps.

Do not create a runtime module just because a folder exists. Do not repeat global Claude rules in every README. A child folder can be a data category or private implementation detail rather than an independently loadable module.
