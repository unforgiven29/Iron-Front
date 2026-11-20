# Save/load, migrations and deterministic replay

**Owner:** game/core/persistence coordinates serialization. Each module serializes its own authoritative state. **Status:** design only.

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
