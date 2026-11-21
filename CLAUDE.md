# Iron-Front — Claude Code entry point

Iron-Front is a browser-based combat flight simulation project inspired by the systems depth and disciplined subsystem separation of Falcon BMS, with combined-arms expansion planned on the same simulation foundation. The repository is currently a foundation and architecture project, not a complete flight simulator.

## Start here

1. Read `docs/claude/PROJECT_STATE.md` for the verified implementation boundary and the next permitted work.
2. Read `docs/claude/README.md` to route the task to its canonical owner. Do not load the full documentation tree.
3. Before changing code, follow `docs/claude/implementation-workflow.md`.
4. Read `docs/ARCHITECTURE_OVERVIEW.md` when a change crosses ownership boundaries. Read the roadmap when selecting or updating a stage.
5. For technical research, open `docs/reference-library/README.md` and only the domain guide relevant to the task. Do not treat simulator manuals, doctrine or generic standards as exact platform data.

## Non-negotiable architecture rules

- One canonical owner for each authoritative state and algorithm.
- Shared engines are platform-neutral. Aircraft/vehicle/weapon/faction packages provide exact definitions, installed fits, configuration and adapters.
- Shared code never branches on aircraft, faction, weapon or display names.
- Modules communicate through typed, versioned contracts: commands, committed events, observations, resource interfaces and immutable snapshots.
- Rendering, audio and UI never decide physics, damage, detections, AI knowledge or campaign outcomes.
- Sensors and AI never read hidden world truth, target transforms or another sensor's private tracks.
- Simulation time, event ordering and seeded randomness are independent of browser render timing.
- Technical data requires exact applicability, units, provenance, uncertainty and review state. Unknown is not zero; do not invent precision.
- Model connected causal systems, not generic working/not-working booleans.
- Do not create a module for every helper, a monolithic manager, or batches of empty placeholder folders.
- A README, schema, folder, mock, visual or manifest is not proof of a working implementation.

## Before adding or moving code

Find the canonical owner and search for existing implementations first. State the capability, owner, inputs, outputs, consumers, state ownership, update domain, failure/recovery behavior and tests. Change ownership only with an ADR and migration plan. Keep changes to one roadmap stage and one vertical slice.

## Current implementation gate

The executable foundation is small: application shell, fixed-step clock, coordinate helpers, seeded random generator, message/module type contracts and renderer port. The full runtime loader/scheduler, flight model, aircraft, radar, weapon and campaign systems are not implemented. Stage 0.5 foundation hardening is complete and CI-verified on `main` (see `docs/claude/PROJECT_STATE.md`). The next work is Stage 1 core runtime. Do not begin aircraft or sensor implementation until Stage 1 exit criteria pass.

## Repository workflow

Use exact setup instructions in `CONTRIBUTING.md`. Normally run `npm ci`, `npm run check` and, for browser-facing changes, `npm run test:e2e`. Write contract and negative tests before or alongside implementation. Do not weaken tests to make CI green. Update the owning system guide and implementation status with evidence. Never claim tests that were not run.

## Definition of done

Report the files changed, behavior actually implemented, tests actually run and results, known limitations/unsupported cases, documentation/status updates and the next dependency or blocker. Explicitly distinguish working code from schemas, architecture documents, test plans and placeholders.
