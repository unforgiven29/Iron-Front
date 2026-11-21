# Data, configuration and technical provenance standards

Global data standard for Iron-Front. Domain documents may add fields but must preserve these rules.

## Schema-first

Every configuration, module definition, equipment profile, asset manifest and technical dataset has a versioned schema. Validate before creating runtime state. Reject malformed/incompatible data with a useful path-specific error; never silently coerce values unless the schema says so.

Reusable schemas live under docs/data-standards/schemas/ or docs/module-system/schemas/. Domain-specific schemas belong to their owner and reference these conventions.

## Units

Use SI internally unless a documented technical reason requires otherwise. Every physical quantity declares its unit. Do not mix knots/m/s, feet/metres, pounds/kilograms, degrees/radians, Celsius/Kelvin without explicit conversions. Store canonical units; cockpit/operator units are presentation settings converted at the boundary.

## Coordinate frames

Every point, vector, orientation, attachment transform, antenna and spatial measurement identifies a frame. Define world origin, axes, handedness, length unit, entity/body frames, local component transforms, geodetic/map representation and angle/quaternion conventions. Use named frames and explicit transforms; never pass unlabelled XYZ triples.

## Time

Simulation time is distinct from wall-clock time. Use integer ticks and documented tick duration for deterministic scheduling. Observations carry acquisition/publication tick and age where meaningful. Never compare clock domains without a conversion contract.

## Technical parameter records

Every value records stable ID/name, value and unit (or explicit unknown), exact platform/variant/equipment/software applicability, source/document/revision/date/page/table/URL, derivation assumptions, confidence, uncertainty/range/distribution, evidence status and review state. See schemas/technical-parameter.schema.json.

Evidence status distinguishes primary-published, measured-test, derived, secondary-reported, simulator-reference, estimated, synthetic-test-only, gameplay-tuned, unknown, disputed and not-fitted. The older publicly-sourced/measured/synthetic labels remain accepted for existing records. A simulator-reference or secondary-reported value is not promoted to a real-platform parameter merely because it is useful for a prototype. Unknown and not-fitted records require an explicit null value; disputed records require explanatory notes and remain unapproved for authoritative configuration until resolved.

Never replace unknown values with fabricated precision. Estimated and gameplay-tuned values remain distinguishable from sourced specifications.

## Configuration layers

Keep global defaults, family defaults, exact variant/equipment definition, installation, scenario override and user preference separate. Define precedence and report the resolved source. Configuration describes capabilities/parameters, not algorithms. Replacing a radar is a data/manifest selection if the interface is compatible—not an aircraft-name branch.

## Definitions versus state

Definitions/configuration are immutable after validation for a running scenario. Each runtime subsystem owns mutable state. Consumers receive immutable snapshots. Never write transient simulation state back into source configuration.

## Uncertainty and quality

Measurements/estimates retain uncertainty and quality. Distinguish valid, stale, invalid, unavailable, estimated and unknown. Use domain-appropriate covariance, error bounds, confidence or distributions. Do not discard uncertainty during fusion, datalink, AI or cockpit display.

## IDs, enums and persistence

Use stable machine IDs separate from labels. Enumerations are versioned and can preserve unknown values. Saves declare schema/module versions and use explicit migrations. Preserve unknown optional fields when safe; reject incompatible critical state instead of silently changing equipment.

## Assets and references

Assets declare scale, units, axes, pivots, attachment points, LOD, license, source and hash. A reference link does not grant redistribution rights.

## Validation

Require schema, units/range, cross-field, variant applicability, provenance, migration and deterministic round-trip validation. A JSON file alone is not proof of technical correctness.
