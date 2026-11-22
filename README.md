# Iron-Front

Browser-based combined-arms combat and campaign simulation using HTML5, JavaScript and TypeScript.

## Project status

The repository contains the executable app shell, initial core primitives, extensive architecture/data guides and many planned subsystem folders. **A guide or folder is not proof that the runtime system exists.** Check the implementation-readiness gate and the current project-state page before treating a capability as implemented.

## How Claude should navigate this repository

- Start with `CLAUDE.md`.
- Read [docs/claude/PROJECT_STATE.md](docs/claude/PROJECT_STATE.md) for the verified implementation boundary and current starting stage.
- Read [docs/claude/README.md](docs/claude/README.md) for task-specific documentation paths.
- Read [docs/claude/implementation-workflow.md](docs/claude/implementation-workflow.md) for the required coding/test/reporting process.
- Do not load every README. Read the owner guide and only direct dependencies/consumers for the task.

## Engineering reference library

Claude's annotated technical research index is [docs/reference-library/README.md](docs/reference-library/README.md). It routes flight dynamics, ground vehicle physics, sensors/EW, weapons/ballistics, aircraft systems, validation and tactical/campaign research to curated references with applicability and source-quality caveats.

## Architecture authority

- [docs/ARCHITECTURE_OVERVIEW.md](docs/ARCHITECTURE_OVERVIEW.md) — canonical ownership and dependency direction.
- [docs/implementation-roadmap/README.md](docs/implementation-roadmap/README.md) — stage order and acceptance criteria.
- [docs/module-system/README.md](docs/module-system/README.md) — manifests, composition and capability dependencies.
- [docs/integration-contracts/README.md](docs/integration-contracts/README.md) — commands, events, observations, snapshots and resource interfaces.
- [docs/data-standards/README.md](docs/data-standards/README.md) — schemas, units, provenance, uncertainty and configuration.
- [docs/simulation-conventions/README.md](docs/simulation-conventions/README.md) — time, coordinate frames, precision and determinism.
- [docs/testing-and-validation/README.md](docs/testing-and-validation/README.md) — test layers, causal validation and performance evidence.
- [docs/legacy-game-feature-crosswalk.md](docs/legacy-game-feature-crosswalk.md) — migration index for capabilities from the user's HTML-Flight-Combat game.
- [docs/legacy-game-feature-inventory.md](docs/legacy-game-feature-inventory.md) — detailed code-informed inventory of the old game's aircraft, sensors, weapons, rotorcraft, ground war, campaign, world, society, multiplayer and developer tools, including source paths and evidence-quality warnings.

## System entry points

- Runtime/core: `game/core/README.md`
- Physics: `physics/README.md`
- Platform systems: `game/systems/README.md`
- Sensors: `sensors/README.md`
- Fixed-wing aircraft: `game/modules/planes/README.md`
- Rotorcraft: `game/modules/rotorcraft/README.md` and `physics/rotorcraft/README.md`
- Uncrewed aircraft/drones: `game/modules/uncrewed-systems/README.md`
- Civil aviation: `game/modules/civil-aviation/README.md`
- Weapons: `game/modules/weapons/README.md`
- Ground/naval/infantry/AI/campaign/logistics: corresponding `game/modules/*/README.md`
- World: `game/world/README.md`
- Graphics/presentation: `game/graphics-engine/README.md`
- Assets: `docs/assets-and-pipeline/README.md`

## Developer setup

Claude entry point: `CLAUDE.md`. The [Claude project-state page](docs/claude/PROJECT_STATE.md) identifies the actual implementation boundary; the [Claude task router](docs/claude/README.md) selects focused system guides; the [implementation workflow](docs/claude/implementation-workflow.md) defines the coding/test/report process. Setup and commands: `CONTRIBUTING.md`. Node.js 22.13+ and npm are required. Clean install uses `npm ci`. Main validation is `npm run check`; browser smoke tests use `npm run test:e2e`.

Static GitHub Pages supports local client-side simulation and explicit save export/import. Persistent authoritative cooperative campaigns require an external backend. Documentation/folders are not implementation evidence.
