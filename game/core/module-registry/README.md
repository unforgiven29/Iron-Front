# Module registry and dependency resolution

Intended owner for discovery and registration of versioned modules. This is a core service, not a location for aircraft/sensor-specific behavior.

Responsibilities: discover manifests; validate schema, stable IDs and versions; index capabilities/dependencies; resolve providers/version ranges; detect missing/duplicate/incompatible/cyclic dependencies; order initialization/teardown deterministically; construct through registered factories/dependency injection; track lifecycle states; expose dependency graph and useful diagnostics.

Resolve by capability ID/API version, not display name, folder string or aircraft type. If multiple providers satisfy a capability, require explicit selection or a deterministic configured policy. Never silently substitute a failed radar/engine/equipment fit.

Optional dependencies declare degraded behavior. Required dependency failure blocks the dependent module with a clear reason. Registry metadata does not expose or mutate private runtime state.

**Status:** Architecture only; no loader/registry implementation is claimed.
