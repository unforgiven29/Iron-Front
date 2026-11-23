# Core configuration and schema validation

**Owner:** game/core/configuration. **Status:** layered resolution implemented in `game/src/core/configuration/ConfigurationResolver.ts` (tests: `game/tests/unit/ConfigurationResolver.test.ts`). Not yet implemented: discovering configuration files from manifests, presentation-preference layer, a reconfiguration boundary during a running scenario, and data migrations.

## Implemented contract
- Precedence is global < family < variant < installation < scenario, whatever order the layers are supplied in. A duplicate or unknown layer is rejected, never guessed.
- Objects merge key by key. Arrays and scalars replace wholesale. Every resolved leaf records the `layer:source` it came from.
- Validation is the JSON Schema plus semantic checks. Errors give the path, the message and the layer that supplied the bad value. Values are never coerced.
- The resolved configuration is deep-frozen.

## Responsibility
Find configuration references, select versioned schemas, validate data and produce immutable resolved configuration before runtime construction. Report the origin of every resolved value.

## Layers
Define precedence across global, domain/family, exact variant, installed equipment, scenario override and user presentation preferences. Physical configuration must not change during a running scenario except through a validated reconfiguration boundary.

## Validation
Schema plus semantic checks: ranges/order, cross-field constraints, compatible module/equipment IDs, references, units/frames, provenance, asset hashes and resource topology. Errors include path, field, expected condition and owner. Do not silently coerce malformed physical values or ignore unknown critical fields.

## Tests
Malformed data, unknown IDs, incompatible versions, precedence collisions, absent required/optional config, invalid references, cross-field checks, deterministic resolution and migration.
