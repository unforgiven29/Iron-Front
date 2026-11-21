# MiG-29 product 9.13 — aircraft flight-model installation

**Selected identity:** single-seat product 9.13; folder/display label MiG-29A is organizational. **Status:** installation architecture only; no executable aerodynamic model or authoritative coefficient database exists.

This folder holds MiG-29 product 9.13-specific flight-model geometry, coefficient data, controls and validation evidence. Shared physical algorithms remain in physics/flight-model, physics/aerodynamics, physics/rigidbody and physics/propulsion. Do not fork the F-16 solver or add MiG-specific name branches to shared code.

## Focused installation records

- [Surface and aerodynamic geometry](surfaces/README.md)
- [Aerodynamic data and coefficient records](aerodynamic-data/README.md)
- [Control surfaces and actuator installation](controls-and-actuators/README.md)
- [Validation envelope and scenarios](validation/README.md)

## Platform configuration

The data package must identify exact product, production series/standard, operator, engine fit and modifications; reference datum/body coordinate frames; wing and fuselage geometry; leading-edge root extensions and surface geometry; twin vertical fins/rudders; horizontal tail/taileron geometry; flap/slat/aileron layout; twin engine locations and thrust axes; stores and fuel loading; landing gear; damage zones; actuator/circuit mapping; and source applicability.

The GAF T.O. 1F-MIG29-1 manual used for the systems dossier does not, by itself, establish every aerodynamic coefficient or exact product 9.13 fit. Preserve this uncertainty. Do not silently import MiG-29 9.12, 9.13S, 9.13B, 9.13SE or later modernization data.

## Twin-engine installation

The selected platform package supplies two separate RD-33 installation records only after exact engine variant/source is confirmed. Each engine has its own transform, thrust vector, state, fuel feed, damage, accessory load and validity. Asymmetric spool/thrust/fuel/installation damage must produce asymmetric moment through the shared force interface.

## Control and actuator interface

The control-law/augmentation adapter maps pilot commands to actual surface positions. The aircraft's main and boost hydraulic installation and any dual-chamber actuator architecture constrain those positions and rates. Read the [MiG-29 installed systems dossier](../systems/README.md), especially the hydraulic, electrical and pneumatic guides. Do not copy F-16 FLCS, A/B actuator or EPU assumptions into the MiG-29 package.

## Data/provenance rules

Every value has units, frame/reference datum, exact applicability, source document/revision/page or test record, uncertainty, provenance class, validity envelope and review status. Synthetic test data remains isolated from aircraft configuration. Unknown values stay unknown.

## First implementation and acceptance

Start with geometry/data schema validation and symmetric low-AoA forces. Add per-surface local flow and force/moment aggregation; then control-surface actual position, twin RD-33 installation and nonlinear/configuration datasets. Validate twin-engine asymmetry, high-lift states and supported high-AoA regimes only after suitable evidence exists. Use the [MiG-29 platform systems acceptance](../../../../tests/acceptance/MiG-29-platform-systems.md) for cross-domain failures and shared FM verification guides for flight dynamics.
