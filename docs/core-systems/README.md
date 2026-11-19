# Core Systems Architecture

**Architecture documentation and empty placeholders only. No core runtime systems are implemented by this change.**

Core systems coordinate simulation time, events, entity identity, state ownership, resources, persistence, diagnostics and subsystem communication. They are shared services, not a giant manager containing every gameplay rule.

## Responsibilities
- Simulation clock, fixed-step scheduling and update domains.
- Entity/component identity and lifecycle.
- Typed commands, domain events and deterministic dispatch.
- Shared resource accounting and dependency graphs.
- Configuration/schema validation.
- State snapshots, deterministic replay, save/load and migrations.
- Logging, telemetry, diagnostics and performance budgets.
- Spatial queries, broadphase and collision interfaces.
- Networking boundaries and authority rules.

## Rules
1. Authoritative simulation state is separate from rendering and UI state.
2. Each subsystem owns its state and exposes explicit contracts.
3. Prefer typed commands/events over cross-system mutation.
4. Distinguish simulation, wall-clock and render time.
5. State-changing operations have deterministic ordering.
6. Inject seeded random streams for replayable tests.
7. Save versioned state, not arbitrary runtime object graphs.
8. GitHub Pages is static hosting; persistent shared campaigns/authoritative multiplayer need an external backend.
9. No system bypasses sensors/fog of war by reading hidden world truth.
10. Document ownership before creating new folders; avoid duplicate systems and circular dependencies.

## Update domains
High frequency: rigid body, controls, collision. Medium: sensors, AI decisions, tactical movement, guidance. Low: logistics, economy, maintenance and strategic AI. Event-driven: damage, launches, impacts, failures, mission events and save checkpoints. Rates are configurable and must be profiled.
