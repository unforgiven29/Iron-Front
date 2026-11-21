# Compressibility, transonic flow and shock-related aerodynamic effects

**Owner:** physics/aerodynamics/compressibility. This owner provides reusable compressibility and transonic-flow model components. Aircraft packages select the model and supply aircraft-specific geometry, coefficient data, drag-rise curves, validity limits and validation evidence. **Status:** architecture only; no solver exists.

## Purpose

Compressibility must be evaluated from local flow, not selected from one global aircraft speed label. Across subsonic, transonic and supersonic regimes, density changes, pressure waves, shock formation, boundary-layer interaction and wave drag can change lift, drag, pitching moment, control effectiveness and buffet. A fighter cannot be represented by one incompressible lift/drag curve with a generic Mach multiplier.

This guide defines model responsibilities. It does not assert that full Navier–Stokes/CFD shock resolution is practical or implemented in a browser.

## Inputs and outputs

**Inputs**
- Local element air-relative velocity, speed of sound, temperature/density and Mach.
- Local AoA, sideslip, Reynolds estimate, angular rates and surface deflection.
- Surface sweep, section geometry, thickness/camber and local pressure/area references.
- Aircraft-specific coefficient/derivative datasets and installed configuration.
- Unsteady-flow/separation state from the aerodynamic element.
- Structural deformation and aeroelastic surface twist where that capability is enabled.

**Outputs**
- Compressibility-aware lift/normal, drag/axial and pitching/side-force coefficients.
- Wave/pressure drag and configuration-specific increments where supported.
- Shock/separation/buffet state or lookup indicators only when the model has supporting data.
- Validity, uncertainty, interpolation status and diagnostics.

The output returns through the normal per-element force/moment contract. Do not add a second Mach correction in the flight-model assembly.

## Required regime handling

### Low subsonic and incompressible-valid region
Use the aircraft's selected baseline coefficient source. Apply a compressibility correction only where the underlying method and source specify it. Do not apply a correction twice if the source table already includes compressibility.

### High subsonic and transonic region
The transonic region is not a single universal Mach threshold. Local acceleration over curved/swept surfaces can create locally supersonic flow before free-stream Mach reaches one. The model must be aircraft/section specific and may need to represent:
- local critical-Mach behavior;
- onset and progression of shock systems;
- shock-induced boundary-layer thickening/separation;
- drag divergence/rapid drag rise;
- shifts in pressure distribution and center of pressure;
- changes in lift curve, pitching moment and control effectiveness;
- transonic buffet and unsteady shock/separation interaction where supported.

A low-order browser model may use multidimensional tables or reduced-order response surfaces. Dynamic buffet should be a stateful, bounded response derived from data/model assumptions, not arbitrary random shaking. Do not claim a resolved shock field when the implementation is only a coefficient table.

### Supersonic region
Where the aircraft/data supports supersonic flight, include applicable wave-drag and pressure/moment trends, Mach-dependent control effectiveness, local flow direction and shock-expansion approximations. Store/free-stream Mach and local panel Mach remain distinct. Do not extrapolate subsonic tables into supersonic flight.

## Geometry and configuration dependencies

Compressibility depends on more than Mach:
- section thickness/camber and leading-edge radius;
- wing sweep, twist and local flow direction;
- fuselage/nacelle/forebody interference;
- control deflection and high-lift device position;
- external tanks, pylons and weapons;
- surface roughness/damage/icing if explicitly represented;
- local aeroelastic twist and bending.

Each aircraft must have its own coefficient and correction package. The F-16 and MiG-29 may use different data dimensions, model structure and validity envelopes. No common drag-divergence Mach, shock location or control-effectiveness schedule may be invented for both.

## Coupling

- Unsteady aerodynamics consumes compressibility state where its model supports Mach dependence.
- Structural response consumes pressure/load distributions; aeroelastic deformation feeds back into local geometry.
- Control/actuator interfaces provide actual surface positions.
- Propulsion/inlet integration receives local forebody/inlet conditions and returns installation effects through its own force contract.
- Atmospheric state provides speed of sound/density; renderer only visualizes shock/buffet indicators.
- Stores and damage affect the installed configuration and local flow only through explicit owner contracts.

Avoid circular double application: one owner defines each correction/increment and the data schema records whether a table is baseline, corrected or already configuration-specific.

## Numerical and browser requirements

Prefer bounded reduced-order methods with explicit table dimensionality, interpolation policy and stable time integration. Use adaptive/substeps only within a fixed deterministic policy; do not allow browser frame duration to select the aerodynamic result. A higher-detail shock/buffet state may run at a declared substep rate while the main rigid-body state remains on the authoritative simulation clock.

The model must expose out-of-domain data and finite-value checks. If a table is missing, do not fill the high-Mach region by copying a neighboring aircraft's table.

## Validation matrix

- subsonic baseline convergence and comparison with original coefficient data;
- critical-Mach and drag-rise trend against a cited test/source;
- local-versus-free-stream Mach distinction on swept/rotated surfaces;
- Mach/AoA/sideslip/control/configuration interpolation;
- pitching-moment and center-of-pressure trend through transonic range;
- shock/separation/buffet response only if a dynamic model is implemented;
- store/gear/device configuration and asymmetric damage;
- aeroelastic coupling stability and force/moment conservation;
- timestep/substep convergence, determinism and browser performance.

## Research references

See [Advanced flight physics references](../../../../docs/reference-library/advanced-flight-physics.md). NASA transonic research cited there is a method/validation example for other configurations, not an F-16C or MiG-29 product 9.13 coefficient source.
