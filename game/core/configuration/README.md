# Core configuration and schema validation

**Owner:** game/core/configuration. **Status:** repository JSON validation tooling exists; runtime configuration discovery/resolution remains future work.

## Responsibility
Find configuration references, select versioned schemas, validate data and produce immutable resolved configuration before runtime construction. Report the origin of every resolved value.

## Layers
Define precedence across global, domain/family, exact variant, installed equipment, scenario override and user presentation preferences. Physical configuration must not change during a running scenario except through a validated reconfiguration boundary.

## Validation
Schema plus semantic checks: ranges/order, cross-field constraints, compatible module/equipment IDs, references, units/frames, provenance, asset hashes and resource topology. Errors include path, field, expected condition and owner. Do not silently coerce malformed physical values or ignore unknown critical fields.

## Tests
Malformed data, unknown IDs, incompatible versions, precedence collisions, absent required/optional config, invalid references, cross-field checks, deterministic resolution and migration.
