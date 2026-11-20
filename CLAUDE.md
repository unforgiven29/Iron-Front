# Iron-Front — Claude Code entry point

This file is the short entry point for coding agents. It is not the complete architecture manual. **Do not read the entire documentation tree by default.** Use the task router, then read only the canonical owner guides for the task.

## Required first reads
1. docs/claude/README.md — scoped reading map.
2. docs/claude/implementation-workflow.md — required development workflow.
3. docs/ARCHITECTURE_OVERVIEW.md — ownership/dependency authority.
4. docs/implementation-roadmap/README.md — active stage and exit criteria.

Then read the README at the canonical owner of the system being changed, plus direct producer/consumer guides only when their contracts are involved. Read a platform README only when implementing that exact platform. Do not load every aircraft, weapon, radar or campaign guide for unrelated work.

## Non-negotiable boundaries
- One canonical owner for each authoritative state and algorithm.
- Shared engines are platform-neutral. Aircraft/vehicle/weapon/faction packages provide definitions, exact fits, installation/configuration and adapters.
- Shared code never branches on aircraft, faction, weapon or display names.
- Modules communicate through versioned typed contracts, commands, events, observations, resource grants and immutable snapshots.
- Rendering, audio and UI never decide physics, damage, detections, AI knowledge or campaign outcomes.
- Sensors and AI never read hidden world truth or another sensor's private tracks.
- Simulation time, event ordering and seeded randomness are independent of browser render timing.
- Technical values require exact applicability, units, source, uncertainty and review state. Unknown is not zero and must not be replaced by invented precision.
- A README, schema, folder, mock, visual or manifest is not a working implementation.

## Before adding or moving code
Find the canonical owner first. State the capability, owner, inputs, outputs, consumers, update domain, state ownership, failure behavior and tests. Search for existing code before creating a second implementation. Change ownership only with an ADR and migration plan.

## Repository workflow
Use exact setup instructions in CONTRIBUTING.md. Normally run npm ci, npm run check and, when relevant, npm run test:e2e. Write contract and negative tests before or alongside implementation. Implement one vertical slice. Do not weaken tests to make CI green. Update the owning system guide and roadmap evidence. Never claim tests that were not run.

## Current implementation boundary
The repository is at the start of executable foundation work. The shell, fixed-step clock, seeded PRNG, coordinate helpers and renderer port are initial primitives; they are not a complete module loader, scheduler, physics model, aircraft, radar engine, weapon engine, combined-arms simulation or campaign. Finish Stage 0.5, then Stage 1. Do not skip ahead to systems whose foundations are unfinished.
