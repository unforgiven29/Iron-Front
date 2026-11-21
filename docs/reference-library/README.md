# Iron-Front engineering reference library

**Purpose:** Curated, annotated starting points for Claude Code and human developers. These references support architecture, simulation model selection, data research and validation. They are not a substitute for variant-specific evidence.

**Important status:** This library adds research routes. It does not add aircraft performance data, vehicle specifications, sensor parameters, weapon parameters or working runtime code. Read the source itself and register the exact page/table/figure before turning any numeric value into game data.

## Start by task

| Task | Read this reference guide | Canonical implementation owners |
|---|---|---|
| Aircraft 6-DoF, aerodynamics, propulsion, FLCS, trim, stall, ground effect | [Flight dynamics and aircraft models](flight-dynamics.md) | `physics/rigidbody/`, `physics/aerodynamics/`, `physics/flight-model/`, `physics/propulsion/`, exact `game/modules/planes/<aircraft>/` |
| Tanks, IFVs/APCs, mobility, suspension, tracked/wheeled motion, terrain | [Ground vehicles and infantry](ground-vehicles-and-infantry.md) | `physics/ground-mobility/`, `physics/rigidbody/`, `physics/collision/`, `game/modules/ground-units/`, `game/modules/infantry/` |
| Radar, AESA/PESA, RWR/ESM, IRST, EO/FLIR, sensor fusion | [Sensors and electronic warfare](sensors-and-ew.md) | `physics/radar/`, `physics/optics/`, `physics/thermal/`, `sensors/<system>/` |
| Weapon profiles, trajectory, guidance, seekers, countermeasures, damage | [Weapons, ballistics and effects](weapons-ballistics-and-effects.md) | `physics/ballistics/`, `physics/guidance/`, `physics/propulsion/`, `physics/armour/`, `sensors/weapon-seeker/`, `game/modules/weapons/` |
| Aircraft electrical/hydraulic/pneumatic/fuel/cooling and installations | [Aircraft systems and platform data](aircraft-systems-and-data.md) | `game/systems/`, `game/modules/planes/<aircraft>/systems/` |
| Test strategy, code/tool references, numerical quality and browser performance | [Validation and open tools](validation-and-open-tools.md) | `game/tests/`, `physics/*/tests/`, `docs/testing-and-validation/` |
| Tactical unit behavior, infantry/armor organization, campaign and logistics context | [Tactics and campaign context](tactics-and-campaign.md) | `game/modules/ai/`, `game/modules/ground-units/`, `game/modules/infantry/`, `game/modules/logistics/`, `game/modules/campaign/` |

## Source-quality hierarchy

Claude must label each source by what it can legitimately establish:

1. **Exact primary platform source:** an applicable aircraft/vehicle manual, technical order, manufacturer source, maintenance/operations publication or configuration-specific record. Best for the exact product, model, block, engine, sensor, software and operator fit it covers.
2. **Official test or research report:** flight-test, wind-tunnel, instrumented mobility, laboratory or validation data. Strong evidence for the tested configuration and conditions; not automatically transferable to another variant.
3. **Engineering standard, handbook or textbook:** establishes terminology, methods, test approaches and general physics. Usually does not provide exact platform-specific performance.
4. **Official simulator documentation / developer notes:** useful for simulation architecture, cockpit logic, task sequencing and model decomposition. Treat its parameters and claims as simulator behavior unless independently validated.
5. **Secondary archive, enthusiast site or forum:** useful for locating documents and identifying research leads. Never promote its claims to authoritative data without primary confirmation.

A source's government or university domain does not make every number universally applicable. Read the scope, test article, revision, distribution statement and limitations.

## Mandatory evidence rules for Claude

- **Do not fabricate values.** An unknown value remains unknown. A synthetic value must be tagged synthetic and kept out of real-platform configuration.
- **Do not merge variants.** Record exact product/series/block, engine, operator, modification, avionics and software baseline. Similar names do not prove identical hardware.
- **Record traceability.** For each adopted fact, capture source title, author/issuing body, publication/revision date, exact page/table/figure/paragraph, URL or repository path, access date, applicability, units, frame/datum, provenance class, uncertainty and reviewer status.
- **Separate fact from inference.** Mark values as measured, published, derived, estimated, synthetic/gameplay-tuned or unknown. Explain derivations and assumptions.
- **Preserve validity envelopes.** Record Mach/altitude/AoA/configuration, terrain/soil, sensor mode/environment, ammunition/impact conditions or other conditions under which the reference applies.
- **Resolve conflicts instead of averaging.** Check whether two sources describe different variants, dates, definitions, coordinate conventions or test conditions. Keep disputed alternatives visible until resolved.
- **No source laundering.** A simulator manual does not become an aircraft technical order because it resembles one. A doctrine publication does not establish tank armor thickness or engine performance. A generic standard does not establish the parameters of an individual platform.
- **Respect distribution and copyright.** Do not commit restricted, export-controlled, classified, copyrighted or unclear-license documents/assets. Link to the publisher/authority when redistribution is not allowed. Do not bypass access controls.
- **Use the owner documents.** The reference library informs system design; it does not replace the canonical ownership and integration contracts in `docs/ARCHITECTURE_OVERVIEW.md`.
- **Never claim a reference proves runtime implementation.** A document, schema, example dataset or acceptance test is not a working simulation.

## How deeply to research a feature

For each major system, Claude should produce a short source plan before coding:

1. Define the exact simulation question and selected fidelity tier.
2. List required physical inputs, state variables, outputs, update domain and coupling interfaces.
3. Identify one general engineering source and one or more exact-platform sources.
4. Find validation evidence or define a controlled synthetic test where real data is unavailable.
5. Record unsupported areas and approximation limits.
6. Only then design the data schema and vertical slice.

For example, a radar implementation needs more than one maximum-range number: it needs an architecture source, a signal-processing source, an applicable equipment baseline and test/validation cases. An aircraft flight model needs more than a three-view drawing: it needs geometry, mass properties, aerodynamic evidence, control-system evidence and an envelope/validation plan.

## Existing platform source registers

These aircraft-specific registers already exist and must be extended rather than duplicated:

- [F-16C Block 50 source register](../../game/modules/planes/F-16/docs/references/README.md)
- [MiG-29 product 9.13 source register](../../game/modules/planes/MiG-29A/docs/references/README.md)

The public BMS/DCS manuals listed there are simulator references and carry the caveats written in those registers. Do not silently promote their modeled values to primary engineering data.

## Suggested research output

For any significant capability, keep the deliverable small and auditable:
- an annotated source list;
- a variant/applicability matrix;
- a parameter/evidence table;
- a short assumptions and uncertainty section;
- validation cases mapped to sources;
- links from the canonical owner README.

Use [the source-record template](source-record-template.md) for new records.
