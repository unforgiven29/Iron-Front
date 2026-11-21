# F-16C Block 50 — aircraft flight-model installation

**Selected baseline:** F-16C Block 50 with GE F110-GE-129. **Status:** installation architecture only; no runnable aerodynamic model or authoritative coefficient dataset exists yet.

This folder holds F-16-specific flight-model configuration and evidence. Shared calculation algorithms remain in physics/flight-model, physics/aerodynamics, physics/rigidbody and physics/propulsion. The F-16 package must not fork those engines or add Block/name conditionals to them.

## Required focused records

- [Surface and aerodynamic geometry](surfaces/README.md)
- [Aerodynamic data and coefficient records](aerodynamic-data/README.md)
- [Control surfaces and actuator installation](controls-and-actuators/README.md)
- [Validation envelope and scenarios](validation/README.md)

## Aircraft installation boundary

The platform data must define the exact reference datum and body frame; wing, fuselage, tail and vertical-tail aerodynamic geometry; left/right and segmented surface layout; panel stations, areas, chord/span axes and force application points; control surface IDs and actual deflection sign/range; high-lift/speedbrake devices; store and external-tank configurations; landing gear and drag geometry; engine installation position/axis and inlet/nozzle references; damage zones; and dataset/source links.

The selected Block 50 configuration must resolve a precise operator/software/equipment baseline before adopting coefficient, control-law or performance data. Do not mix Block 40/42, Block 52, export, CCIP modernization or later upgrade data into this package.

## Flight-control/system interfaces

F-16 FLCS law and mode behavior is an aircraft-specific control-system capability. The FM receives requested/actual surface states through contracts; it does not implement FLCS switch logic itself. Actual actuator positions and rates are constrained by the installed electrical and hydraulic network. Read the [F-16 installed systems dossier](../systems/README.md) and its hydraulic/electrical guides for the A/B, FLCS power and EPU topology.

A flight-control command must never directly set aerodynamic panel deflection. Surface command, actuator target, achieved position and indicated position are distinct states.

## Engine installation

The selected baseline has one GE F110-GE-129 installation. The engine family model remains in physics/propulsion; this package provides only the exact installed transform, thrust axis, inlet/nozzle/bleed/accessory interfaces, fuel feed, damage zones and data applicability. Do not import the F100 installation or engine performance maps.

## Minimum FM data record

Every parameter has stable ID, quantity, SI units, frame/reference datum, exact block/engine/operator applicability, source title/revision/page, data-provenance class, uncertainty, supported envelope, review state and configuration version. Unknown values stay unknown. Synthetic values are permitted only for tests and must be visibly segregated.

## First implementation and acceptance

Start with symmetric geometry and a deliberately limited coefficient envelope, then establish static/level trim using sourced mass and power state. Add real control mappings and hydraulic/electrical actuator constraints next, then high-lift/store/gear configurations and nonlinear envelope. Use [the F-16 vertical-slice acceptance suite](../../../../tests/acceptance/F16-first-vertical-slice.md) plus the shared FM verification requirements.

No arbitrary lift, drag, stability or handling multipliers may be used to force a target result.
