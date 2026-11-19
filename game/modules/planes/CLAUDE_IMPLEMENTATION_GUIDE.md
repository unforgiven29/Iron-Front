# Claude Implementation Guide — Modular Aircraft Fleet

Implement aircraft as data-driven modules over shared simulation services. Read the integrated simulation guide first.

## Required architecture

Use composition and registered capability adapters, not one giant inheritance tree. Shared services own generic physics and infrastructure; each aircraft supplies its actual geometry, data, equipment fit and aircraft-specific control/system behavior.

Define typed interfaces for aircraft manifest/variant resolver, geometry and attachment frames, mass properties and dynamic mass contributors, aerodynamic surface layout/data provider, flight-control law and actuator controller, engine installation/control mapping, fuel/electrical/hydraulic/cooling topology, sensor equipment fit and avionics mode controller, stores/hardpoint compatibility, damage zones and failure routing, cockpit command/instrument mapping, visual asset/animation metadata, and validation profile/source provenance.

Use schema validation for static definitions. Runtime state is created by factories and owned by the corresponding subsystem. Do not embed arbitrary executable code in JSON definitions; use known adapter IDs resolved through a registry.

## No fake universal abstraction

Common interfaces describe contracts, not identical behavior. F-16 and MiG-29 must not share identical aerodynamic coefficients, control laws, engine response, electrical/hydraulic topology, sensor hardware or cockpit layout merely because they implement the same interface.

If two aircraft have genuinely different mechanisms, represent that difference through distinct adapters/configuration and tests. Do not create an optional-property mega-interface full of flags that every subsystem checks.

## Adding new aircraft

1. Confirm exact variant and operator baseline.
2. Create manifest, versioned schema and source/provenance index.
3. Supply geometry, mass properties and hardpoint locations.
4. Supply aerodynamic surface data and validity envelope.
5. Implement aircraft-specific flight-control laws and actuator behavior.
6. Select engine fit and installation.
7. Define resource network and aircraft system dependencies.
8. Select fitted sensors and avionics modes; absent equipment remains absent.
9. Define stores, damage zones, cockpit and model metadata.
10. Run common contract tests and aircraft-specific validation scenarios.
11. Compare behavior to reference data and report uncertainty.
12. Verify that adding this aircraft did not change another aircraft's behavior.

## Modularity acceptance test

The same shared simulation runtime must instantiate two aircraft with materially different aerodynamic datasets/control surfaces, flight-control laws, engine families or fits, resource networks, radar/sensor equipment, cockpit layouts and system failures.

No forked copy of the global solver is allowed. The second aircraft should be integrated by its own package and adapters. If it requires aircraft-type conditionals scattered throughout shared physics code, refactor that behavior into a capability adapter or explicit configuration.

## Runtime selection

Resolve aircraft family → exact variant → configuration version at load time. Validate all references and capabilities before spawn. If required data is missing, fail with a clear diagnostic or select an explicitly declared fallback configuration; never silently inherit another block's systems.

Keep aircraft module APIs stable and versioned. Add migration adapters for old saves/configurations when schemas change.
