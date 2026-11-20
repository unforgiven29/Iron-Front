# Game core — runtime coordination services

**Status:** architecture and initial primitives only. A complete module registry, scheduler, dispatch system, entity store, resource allocator, persistence service, diagnostics and spatial engine are not implemented.

## Mission
Core coordinates simulation lifecycle and time. It is shared infrastructure, not a monolithic manager containing aircraft, radar, weapon, ground or campaign rules. Each service has one narrow responsibility and a versioned public contract.

## Service map
- module-registry: manifest validation, capability resolution, dependency graph, factory/lifecycle orchestration.
- simulation: authoritative clock, phases, deterministic order and multi-rate scheduling.
- events: commands, committed events, observations, snapshots, queues and journal.
- entities: stable IDs, composition and creation/destruction lifecycle.
- resources: typed offer/demand arbitration and allocation diagnostics.
- configuration: schema lookup, layer resolution, immutable validated configuration.
- persistence: coordinated save/load, migrations and replay.
- diagnostics: structured faults, traces, profiling and developer inspection.
- spatial: transforms, indexes and generic queries; world owns terrain/structure truth.
- networking: optional transport/authority adapters; local mode must not require a server.

## Initialization lifecycle
Read scenario header → validate module manifests/configuration → resolve dependencies → construct instances → initialize in dependency order → acquire/validate resources → ready/degraded/failed → schedule. A failure unwinds acquired resources in reverse order. An instance cannot tick before ready or publish after disposal.

## Invariants
No authoritative state mutation from UI/render callbacks; no wall-clock dependency in deterministic updates; stable event order; no hidden world-truth route into sensors/AI; no direct cross-module mutable references; required failure blocks dependants; optional absence follows declared degradation; independent failures remain isolated.

## First implementation order
Registry/resolver with two test modules; deterministic dispatcher and scheduler; entity lifecycle; resource arbitration; configuration/runtime diagnostics; persistence/replay and spatial acceleration as contracts stabilize. Do not put the F-16 flight model inside core.

Read each service README before implementing it.
