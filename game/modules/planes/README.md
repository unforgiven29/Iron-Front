# Aircraft Module System

Every aircraft in Iron-Front is a plug-in configuration and set of aircraft-specific adapters loaded by one shared runtime. Aircraft modules must not contain private copies of the global rigid-body, atmosphere, aerodynamic, propulsion, radar, IRST, damage or rendering engines.

## Required package layout

Each aircraft/variant should expose the relevant subset of:
- manifest: stable aircraft ID, family, exact variant, revision and source baseline.
- data: geometry, dimensions, masses, CG/inertia, configuration and provenance.
- aerodynamics: surface layout and aircraft-specific aero coefficient data.
- flight-controls: control laws, mixing, trim, actuators, limits and failure/reversion.
- propulsion: engine fit, installation, controls and engine-specific data.
- systems: fuel, electrical, hydraulic, cooling, gear, brakes and aircraft-specific systems.
- sensors: fitted radar, RWR/ESM, IRST, EO/FLIR, IFF and navigation equipment references.
- avionics: mode management, sensor cueing, datalink and display data.
- stores: hardpoints, compatibility, attachment transforms and configuration effects.
- damage: damage zones, routing, structural effects and failure mappings.
- cockpit: controls, instruments, display layouts and startup procedures.
- models: external/cockpit assets, coordinate conventions, animations, LOD and source.
- validation: supported envelope, reference scenarios, results and limitations.

Not every aircraft has every system. Absence must be explicit; do not grant features by default. Equipment fit is variant-specific.

## Shared runtime contract

The aircraft package supplies immutable, schema-validated configuration and registered adapter identifiers. The shared runtime owns entity lifecycle, simulation scheduling, resource allocation, solver execution, sensor processing, damage event routing and render snapshot publication.

Use composition over inheritance. Prefer small capability interfaces such as IFlightControlSystem, IEngineInstallation, ISensorFit and IMassPropertiesProvider rather than a deep aircraft class hierarchy or giant base class with hundreds of optional fields.

## Adding an aircraft

1. Select exact variant and data baseline.
2. Create manifest and schema-valid configuration.
3. Define geometry, mass properties, aero surfaces and control path.
4. Select engine and equipment fits that actually belong to this variant.
5. Connect resource/system dependencies.
6. Add stores, damage, cockpit and asset mappings.
7. Pass shared contract tests and aircraft-specific validation scenarios.
8. Add a second-variant or second-aircraft regression to prove no shared behavior regressed.

The F-16 is the first integrated reference module. The MiG-29A package is an intended later proof that the shared runtime supports materially different designs without copying F-16 code.

## Rules

- No aircraft module owns a duplicate shared solver.
- No universal flight characteristics, engine, sensor fit or cockpit.
- No capability inferred from aircraft family name alone.
- No exact performance data without provenance and variant applicability.
- Every adapter declares dependencies and failure behavior.
- Runtime state is not stored in static configuration or asset metadata.
- A model is not complete until its validation matrix and cross-system tests pass.


## Aircraft-specific research libraries

- [F-16C Block 50 documentation](F-16/docs/README.md)
- [MiG-29 product 9.13 documentation](MiG-29A/docs/README.md)

Read the variant baseline and source caveats before implementing any aircraft-specific system. These research packs do not imply that runtime systems are implemented.
