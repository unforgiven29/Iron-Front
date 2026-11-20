# Module system and composition rules

This is the authority for how independently replaceable modules are identified, discovered, configured, connected and retired. Subsystem documents may refine it but must not contradict it.

**Status:** Architecture specification only; no runtime loader/registry is claimed to exist.

## What counts as a module

A module owns a coherent definition or behavior with a reason to be selected, configured, replaced, versioned or tested. Examples include an aircraft variant, installed radar, missile definition, ground vehicle, sensor engine, terrain provider or campaign ruleset. Do not make every tiny function a module.

## Required manifest

Every loadable module provides a manifest conforming to schemas/module-manifest.schema.json. It declares:
- stable namespaced ID, kind, display name and semantic version;
- manifest schema and compatible host API range;
- capabilities provided, each with interface/API version;
- required and optional capability dependencies with version ranges;
- explicit degraded behavior for optional dependencies;
- configuration files and schema IDs/versions;
- child module composition references;
- asset references/hashes and license metadata where applicable;
- lifecycle, update domain, determinism and save-state support;
- provenance/source metadata.

The example manifest is illustrative, not an aircraft specification.

## Identity and compatibility

IDs remain stable across display-name changes. Version modules independently from interface/API versions. Use semantic versioning: major for incompatible contracts/meaning, minor for backward-compatible additions, patch for compatible corrections. Reject incompatible modules before startup. Do not infer capabilities from family names.

## Dependency resolution

Resolve dependencies by capability ID and API version, not filesystem path or concrete product name. The registry must detect missing required providers, duplicates/conflicts, incompatible versions and dependency cycles; select explicit providers; report optional absence and degraded mode; validate configuration; build deterministic lifecycle/update order; and expose an inspectable dependency graph.

No silent substitution. A missing requested radar must not be replaced with another radar.

## Lifecycle

Intended lifecycle: discover → parse manifest → validate identity/schema/version → resolve dependencies → load immutable definitions/configuration → construct runtime state → initialize → ready/degraded/failed → update → serialize/restore if supported → dispose.

Failed initialization releases acquired resources. A module cannot update before dependencies are ready or publish after disposal. Make lifecycle operations idempotent where practical.

## Configuration and runtime state

Keep global defaults, family defaults, exact variant/equipment configuration, installation, scenario overrides and user preferences separate. Define precedence and report the resolved source of each setting. Configuration is immutable during a running scenario except through an explicit reconfiguration boundary. Runtime state belongs to the module and is never written back into source configuration.

## Replacement and extension

Consumers depend on contracts, not implementation classes. Use adapters for legacy/platform interfaces. Avoid giant base classes, global mutable registries, name-based dispatch, duplicate shared solvers and hidden imports of another module's private internals.

A module is replaceable only when an alternative can satisfy the same capability contract and pass the same consumer tests.

## Boundaries

Shared engines own reusable algorithms and generic authoritative behavior. Platform modules own exact equipment/variant definitions, installation geometry, wiring, controls, cockpit mapping, source data and supported capabilities. Campaign/mission modules compose rules and entities but do not own physics, sensor engines or rendering.

## Required evidence

Each module needs manifest/schema validation, dependency-resolution tests, contract tests, initialization/failure tests, save/load tests where applicable, deterministic tests where applicable and integration tests with a consumer. Replacement claims require the same consumer tests against materially different providers/profiles.

**Rule for Claude:** Before creating a module/folder, identify its owner, capability, dependencies, configuration, contracts and tests. Extend an existing owner instead of duplicating it.
