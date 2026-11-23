# Save/load, migrations and deterministic replay

**Owner:** game/core/persistence coordinates serialization. Each module serializes its own authoritative state. **Status:** save envelope, atomic load and input-journal replay implemented in `game/src/core/persistence/SaveState.ts` (tests: `game/tests/integration/SaveReplay.test.ts`). Not yet implemented: schema migrations between state versions, configuration hashes in the envelope, saving pending one-shot scheduler work (restore refuses while any is pending), and browser export/import UI.

## Implemented contract
- Modules implement `PersistableModule` (`save`, `validate`, `load`, `stateVersion`). `createSave` stores format version, scenario, seed, tick, step and JSON-round-tripped per-module state, sorted by module ID.
- `loadSave` checks format version, scenario, step, missing and unknown modules, state versions and each module's own `validate()` before changing anything. If a `load()` then throws, every touched module is restored. If that restore itself fails, it reports `rolledBack: false` and says the state is inconsistent.
- `InputJournal` records external inputs by tick (ticks must not go backwards, and inputs must be JSON-safe) and round-trips through JSON.
- `SimulationScheduler.restoreTick` sets the tick after a load.
- Verified: replaying the journal from the initial state reproduces the exact final state. Saving at tick 300, loading into a fresh runtime and continuing gives exactly the same result as an uninterrupted 600-tick run, including the seeded random-stream state.

## Save envelope
Record format version, scenario ID/seed, tick and step settings, module IDs/versions, configuration hashes, entity IDs/composition, per-module state payloads, PRNG stream states and migration metadata. Do not dump arbitrary JavaScript object graphs or renderer handles.

## Snapshot versus replay
A save restores a snapshot. Replay reconstructs a timeline from initial state plus recorded commands/external inputs. Replay requires seeds, module/data versions, numeric settings, scheduler semantics and external input record.

## Atomic load
Validate critical modules/payloads and cross references before mutating the live scenario. Restore into staging state, validate and then commit. If required data or migration fails, abort and retain the original running state.

## Migration
Use explicit schema-version transitions and tests. Unknown optional fields may be preserved when safe; unknown critical state fails visibly. Never silently change equipment fit or physics meaning.

## Hosting and tests
Browser-local export/import is appropriate for local play; GitHub Pages is not a durable multiplayer database. Test round-trip, corruption, missing modules, incompatible versions, failed migrations, deterministic replay, stable IDs and long-running save size.
