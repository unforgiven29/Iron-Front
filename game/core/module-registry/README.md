# Module registry and capability dependency resolver

**Owner:** game/core/module-registry. **Status:** design only; no runtime loader/registry is implemented.

## Responsibility
Discover manifests, validate identity/schema/version, index capabilities, resolve compatible providers, build the dependency graph and coordinate lifecycle. The registry manages composition metadata, not domain behavior.

## Resolution rules
- Match capability ID and API version range; do not resolve by display name, aircraft name or folder path.
- Honor an explicit providerModuleId.
- Reject missing required providers, duplicates/conflicts, incompatible versions, self-dependencies and cycles before construction.
- Multiple valid providers require explicit selection or a deterministic configured policy; never rely on filesystem enumeration order.
- Optional absence produces the declared degraded behavior. Required absence blocks the dependent.
- Never silently substitute another engine, radar or equipment fit.
- Emit a graph and reason for every selected/rejected provider.

## Lifecycle and factory safety
States should distinguish discovered, validated, resolved, constructed, initializing, ready, degraded, failed and disposed. Factories are registered in an explicit catalog; do not dynamic-import arbitrary manifest paths. Initialization failure unwinds resources. No tick before ready and no publication after disposal.

## Tests
Manifest schema errors, semantic-version boundaries, missing/incompatible/duplicate provider, dependency cycle, optional degradation, deterministic resolution, factory failure, partial initialization cleanup and two consumers using one capability.

## First slice
Compose two test modules through one API, then prove missing dependency and cycle rejection with actionable diagnostics.
