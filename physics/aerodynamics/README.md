# Aerodynamics and local airflow

**Ground effect:** implemented in `game/src/physics/aerodynamics/GroundEffect.ts` (McCormick induced-drag factor, effective-aspect-ratio lift slope; tests `game/tests/unit/GroundEffect.test.ts`). Tail-downwash pitching moment, bank asymmetry and dynamic ground effect are not modelled.

**Owner:** physics/aerodynamics. **Status:** shared table lookup (`game/src/physics/aerodynamics/Tables.ts`) and ground effect are implemented; aircraft coefficient models live in their platform packages. No general aerodynamic solver is implemented.

## Responsibility
Generate aerodynamic forces/moments from aircraft-specific geometry/data and local air velocity at each surface. Aircraft packages supply layout, coefficient datasets, controls and provenance. Rigidbody consumes loads.

## Model stages
Surface geometry (wing panels, tails, fins, control surfaces) → ambient/local flow → local velocity/dynamic pressure/Mach/AoA/sideslip → coefficient evaluation/interpolation → force/moment integration at application points.

Include angular-rate velocity at offset surfaces (ω × r), downwash/sidewash, induced flow and wake effects where supported. Nonlinear stall/separation, hysteresis, high-AoA, ground effect, propwash/jet interaction and damage/store effects require explicit data or declared approximations.

## Flight-model boundary
The aircraft flight-model assembly lives in [physics/flight-model](../flight-model/README.md). It creates aircraft-specific element configurations and gathers their contributions; this folder remains the canonical owner of reusable local-flow, coefficient-evaluation and aerodynamic force equations. Do not duplicate the solver inside an aircraft package or in the FM assembly.

## Rules
Every surface samples its own local flow; one aircraft-wide AoA/q is insufficient. Coefficient tables state sign conventions, Mach/AoA/sideslip/configuration axes, uncertainty and valid envelope. Do not use one lift curve or an arbitrary handling multiplier. Out-of-envelope input returns a documented degraded/unsupported result, not hidden extrapolation.

## Outputs and tests
Publish surface and total force/moment, intermediate coefficients, local flow, validity and uncertainty. Test dimensional/sign conventions, symmetric trim, lift/drag trends, controls, sideslip, local angular-rate effect, stall, asymmetry, stores/damage, timestep convergence and sourced reference conditions.


## Advanced model owners

Do not place every aerodynamic behavior in one `Aerodynamics` class. The main solver composes per-element loads from distinct optional model capabilities:
- `unsteady-aerodynamics/`: attached-flow lag, dynamic separation, hysteresis and dynamic-stall response.
- `compressibility/`: local Mach effects, compressibility, transonic drag rise, shock/separation and supported buffet response.
- `physics/flight-model/flow-interactions/`: selected aircraft flow sources, LEX/LERX, wakes, downwash/sidewash and interaction configuration.
- `physics/flight-model/aerodynamic-elements/`: panel/element graph, local station, geometry and contribution metadata.
- `physics/flight-model/high-lift-devices/`: fitted flap/slat/LEF/spoiler/speedbrake definitions and schedules.
- `physics/flight-model/structural-response/`: deformation/modal state and aeroelastic coupling.

Every aircraft selects its own combination and provides its own data. Do not enable a feature merely because the code supports it. A model with no exact platform data must be marked estimated or synthetic-test-only and remain outside real configuration.
