# Module registry and capability dependency resolver

**Owner:** game/core/module-registry. **Status:** Stage 1 step 1 implemented: manifest validation, capability/version resolution, dependency graph, and synchronous composition from an explicit factory catalog. Not implemented yet: manifest discovery/loading from disk or network, async initialization, runtime lifecycle states beyond construct/dispose, and configuration loading.

## Implementation
- `game/src/core/modules/SemanticVersion.ts`: version parsing, precedence and ranges (`x.y.z`, `^`, `~`, `>=`/`>`/`<=`/`<`, space-separated AND, `*`). An unparseable range is an error, never "any". Prereleases match only ranges that name the same release's prerelease.
- `game/src/core/modules/ModuleResolver.ts`: `resolveModules({ manifests, hostApiVersion, providerSelections })`. A pure function: input order never changes the result. It returns modules in provider-first order, the selected/rejected provider with a reason for every binding, and coded diagnostics (`MANIFEST_INVALID`, `DUPLICATE_MODULE`, `HOST_API_INCOMPATIBLE`, `INVALID_VERSION_RANGE`, `SELF_DEPENDENCY`, `MISSING_PROVIDER`, `INCOMPATIBLE_PROVIDER`, `AMBIGUOUS_PROVIDER`, `INVALID_SELECTION`, `PROVIDER_UNAVAILABLE`, `DEPENDENCY_CYCLE`, warning `OPTIONAL_DEPENDENCY_DEGRADED`). Rejection propagates to dependants: required dependants are rejected, optional dependants run degraded.
- `game/src/core/modules/ModuleComposer.ts`: `composeModules(resolution, catalog)`. It constructs in dependency order. Each module sees only the capabilities its manifest binds (`require`/`optional`), and supplied capabilities must match `provides`. A factory failure disposes already-built modules in reverse order.
- Tests: `game/tests/unit/SemanticVersion.test.ts`, `game/tests/unit/ModuleResolver.test.ts`, `game/tests/integration/ModuleComposition.test.ts`.

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
