# Browser platform and deployment constraints

Target platform: JavaScript/TypeScript, HTML5 and static GitHub Pages hosting.

## Static hosting boundary

GitHub Pages serves static files; it does not run a persistent authoritative simulation server, database, account service, matchmaking service or always-on campaign process. Client-local single-player simulation and explicit save export/import fit this model. Persistent co-op campaigns, shared state, cloud saves and server-authoritative multiplayer require a separately hosted backend. Keep those behind replaceable adapters.

## Simulation/render separation

Core simulation must not depend on the DOM, renderer or render frame rate. Use a simulation clock and explicit scheduler. Rendering consumes immutable snapshots and may interpolate. Core must run in headless tests/replay.

## Workers and concurrency

Workers may host bounded CPU-heavy work when profiling supports it. Define message schemas, ownership, tick stamps, cancellation, errors and deterministic result ordering. Never share mutable simulation state across workers. Measure copy and queue costs.

## Graphics compatibility

Choose rendering APIs only after a compatibility/performance prototype. Provide browser/GPU fallbacks and presentation quality tiers that do not silently change core physics or sensor results.

## Performance and persistence

Prioritize authoritative nearby entities. Use spatial indexes, event-driven and multi-rate updates, LOD, conservative culling, bounded approximations and pooling. Fidelity reductions must be explicit and visible in diagnostics. Browser storage can be cleared/quota-limited; use versioned saves and explicit export/import, not local storage as a durable multiplayer database.

## Acceptance

Every major technology choice records browser support, GPU requirements, CPU/memory cost, fallbacks, GitHub Pages implications and representative test coverage.
