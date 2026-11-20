# Iron-Front

A browser-based combined-arms campaign and combat simulation built with JavaScript, TypeScript and HTML5.

## Architecture status

The repository contains an evolving code skeleton, subsystem architecture documentation and placeholder directories. A guide or folder does not mean its runtime system is implemented or validated.

## Start here: architecture authority

- Architecture overview: docs/ARCHITECTURE_OVERVIEW.md
- Module system and dependency rules: docs/module-system/README.md
- Integration contracts and update order: docs/integration-contracts/README.md
- Data, units, coordinate frames and provenance: docs/data-standards/README.md
- Testing and validation: docs/testing-and-validation/README.md
- Architecture decisions: docs/architecture-decisions/README.md
- Asset pipeline: docs/assets-and-pipeline/README.md
- Browser/deployment constraints: docs/platform-constraints/README.md

Read these before creating a new subsystem or changing ownership.

## Main subsystem guides

- Integrated simulation: docs/integrated-simulation/README.md
- Core systems: docs/core-systems/README.md
- Aircraft modules: game/modules/planes/README.md
- F-16C Block 50: game/modules/planes/F-16/README.md
- MiG-29 product 9.13: game/modules/planes/MiG-29A/README.md
- Flight model: docs/flight-model/README.md
- Propulsion: docs/propulsion/README.md
- Radar: docs/radar/README.md
- RWR/ESM: sensors/RWR/README.md
- IRST: docs/irst/README.md
- Weapons: game/modules/weapons/README.md
- Ground units: game/modules/ground-units/README.md
- Infantry: game/modules/infantry/README.md
- Naval units: game/modules/naval-units/README.md
- World: game/world/README.md
- Graphics engine: docs/graphics-engine/README.md

## Non-negotiable rules

- One shared engine per reusable capability; platform differences live in configuration and adapters.
- Modules declare capabilities and dependencies in manifests. Shared code must not branch on aircraft/faction/weapon names.
- Shared services own simulation time, physics, resource allocation, world queries and persistence contracts.
- Definitions, configuration, mutable runtime state, observations, diagnostics and presentation are separate.
- Cross-module communication uses typed contracts, commands, events, resource interfaces and immutable snapshots.
- Technical data has units, applicability, provenance and uncertainty.
- A module is not complete until contract, integration, regression and performance tests pass.

The target is HTML5/JavaScript/TypeScript and static GitHub Pages hosting. Static hosting does not provide persistent authoritative multiplayer; that requires an external backend.

**Documentation and folder structure are not proof of runtime implementation.**

## Developer setup

- Claude instructions: [CLAUDE.md](CLAUDE.md)
- Implementation roadmap: [docs/implementation-roadmap/README.md](docs/implementation-roadmap/README.md)
- Simulation conventions: [docs/simulation-conventions/README.md](docs/simulation-conventions/README.md)
- Implementation readiness gate: [docs/implementation-readiness/README.md](docs/implementation-readiness/README.md)
- Contributor setup: [CONTRIBUTING.md](CONTRIBUTING.md)

Use Node.js 22.13+ and npm. See CONTRIBUTING.md before running the application.
