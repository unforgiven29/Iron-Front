# Iron-Front — Claude Code instructions

You are working on Iron-Front, a browser-based combined-arms simulation. Treat this file and the linked architecture documents as binding project rules.

## Read before coding

1. `docs/ARCHITECTURE_OVERVIEW.md`
2. `docs/implementation-roadmap/README.md`
3. `docs/module-system/README.md`
4. `docs/integration-contracts/README.md`
5. `docs/data-standards/README.md`
6. `docs/simulation-conventions/README.md`
7. `docs/testing-and-validation/README.md`
8. The README for every subsystem and platform being changed.

Do not start by generating hundreds of files or implementing multiple domains at once. Work only on the current roadmap stage and its acceptance criteria.

## Mandatory architecture rules

- One canonical owner for every authoritative behavior and state.
- Shared engines implement reusable algorithms. Aircraft/vehicle/weapon modules provide variant data, fitted capabilities, installation geometry, controls, adapters and provenance.
- Modules depend on versioned capability contracts, not folder paths, display names or concrete aircraft/faction/weapon names.
- Do not add name-based if/switch branches in shared engines. Do not create private copies of shared physics/sensor engines inside a platform module.
- Compose modules through explicit manifests, dependency injection and validated configuration. Missing required dependencies fail clearly. Optional dependencies need documented degraded behavior. Never silently substitute another equipment fit.
- Separate immutable definitions/configuration, mutable runtime state, observations, commands, events, immutable snapshots, diagnostics and presentation.
- Only the owning subsystem changes its authoritative runtime state. Cross-module communication uses typed/versioned contracts.
- Cockpit/UI/audio/rendering consume published snapshots and send commands. They must never mutate physics or sensor internals.
- Sensor/AI/campaign code must not query hidden world truth or another sensor's private tracks. Preserve source, time, frame, quality and uncertainty.
- Keep simulation time independent of browser/render time. Use deterministic tick ordering and seeded random streams where deterministic behavior is required.
- Technical values require units, exact applicability, provenance and uncertainty. Unknown means unknown. Never invent precise real-world or classified values.
- Document approximations and validity limits. Never call a placeholder or visual-only mock a working simulation.

## Before changing architecture

Before creating a folder/module or moving ownership:
1. Search the existing tree and docs for an owner.
2. State the capability, owner, consumers and public contract.
3. Explain why an existing module cannot own the change.
4. Update the architecture/ADR if ownership or dependency direction changes.
5. Add tests for the new contract and negative/failure cases.

Prefer one clear module over many tiny folders. Do not create empty folder trees just to make the architecture look complete.

## Implementation workflow

For each task:
1. State the current roadmap stage and the exact acceptance criteria being addressed.
2. Inspect existing code and preserve working behavior.
3. Write/adjust contracts and tests before implementing behavior.
4. Implement the smallest complete vertical slice.
5. Run `npm run check` and, when applicable, `npm run test:e2e`.
6. Fix failures; do not disable or weaken a test just to get green.
7. Update the relevant README, data provenance and roadmap status.
8. Summarize files changed, behavior implemented, test commands/results, limitations and next blocker.

Do not claim tests ran when they were not run. Do not mark a roadmap item complete because its folders, types or docs exist.

## Current project boundary

The repository is at the start of executable foundation work. The shell, build/test configuration and a few core primitives do not constitute a flight model, module loader, renderer, weapons simulation, sensor engine, ground-unit simulation or campaign.

The first implementation objective is the F-16C Block 50 vertical slice described in `game/tests/acceptance/F16-first-vertical-slice.md`. Implement shared foundational services first, then integrate the F-16. Use the MiG-29 product 9.13 later as a second-platform architecture test.

## Commands

- `npm install` — install exact direct dependency versions; commit the generated package-lock.json as soon as dependency resolution is available.
- `npm run dev` — local browser development server.
- `npm run check` — lint, schema validation, unit tests and production build.
- `npm run test:e2e` — browser smoke tests (requires Playwright Chromium installed).
- `npm run build` — type-check and create the static production build.

## Never do these

- Do not implement the entire game in one giant pass.
- Do not replace an existing shared owner with a second version.
- Do not make up technical data.
- Do not use arbitrary multipliers to disguise missing physics.
- Do not use booleans as substitutes for power, pressure, capacity, health, uncertainty or sensor evidence where physical state matters.
- Do not let rendering decide physics, detection, damage, AI knowledge or campaign outcomes.
- Do not silently change coordinate, unit, timestep, save or module API conventions.
- Do not add multiplayer claims that static GitHub Pages cannot support.
- Do not bulk-create placeholders as a substitute for implementation.

When requirements conflict or a source is ambiguous, stop the affected change, explain the conflict and propose the smallest architecture-safe resolution.
