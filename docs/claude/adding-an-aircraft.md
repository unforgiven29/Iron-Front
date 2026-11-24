# Adding an aircraft (e.g. the MiG-29)

Every aircraft is flown by the same shared runtime. A new aircraft is one package folder that
fills in one contract, plus one line in the catalog. You do not edit shared code to add an
aircraft.

## What is shared and what is per aircraft

| Shared (never copy or fork) | Per aircraft (your package) |
|---|---|
| `FixedWingAircraft`: the runtime loop (sense → controls → actuators → devices → engines → aero → physics) | Mass, inertia, CG, fuel load |
| Rigid-body 6-DoF physics, atmosphere and wind, terrain, collision | The list of control surfaces with limits, rates and bandwidth |
| Gas-path turbofan plant (`MixedFlowTurbofan`) and engine control (`Fadec`) | Engine count, design data, FADEC schedule and limits, position and thrust direction |
| Table lookup (`lookup1D/2D/ND`), surface actuators | **Its own aerodynamic model and data** |
| Switch registry, cockpit renderer, HUD | **Its own flight-control system** (fly-by-wire, mechanical, dampers...) |
| Module system (manifest validation, resolution, composition) | Automatic devices (slats, LEF...), switches, cockpit layout, MFD pages, manifest |

Why the aero model and control system are per aircraft: the repo rules forbid forcing two
aircraft into one set of coefficient tables or one control law. The MiG-29's data has a
different shape from the F-16's NASA tables, and its controls are mechanical with stability
augmentation rather than fly-by-wire. Each package implements the same small interfaces in its
own way.

## Steps

1. Create `game/src/platforms/aircraft/<your-aircraft>/` (the F-16 is in `f16c-block50/`).
2. Put every number in a data file with its provenance (status, source, units, applicability).
   Unknown values stay `NaN` with status `unknown`, never 0. See `F16Data.ts`.
3. Implement the contract in `game/src/platforms/aircraft/common/AircraftDefinition.ts`:
   - `aero: AeroModel`: `compute(input)` returns body forces and moments from your data.
     Surfaces arrive by the ids you declared, e.g. `input.surfaces["stab"]`.
   - `fcs: FlightControlSystem`: turns pilot inputs plus sensors into surface commands by id.
   - `devices` (optional): automatically scheduled surfaces such as the F-16's leading-edge flaps.
   - `engines`: one entry per engine, with `design` (a `TurbofanDesign`, calibrated to your
     engine's published thrust with `calibrate()`), `control` (a `FadecSchedule`: throttle map,
     limits, acceleration schedule, afterburner sequencing, backup mode), position and thrust
     axis. The F-16 keeps both in `f16c-block50/F110Engine.ts`. A switch can change an engine's
     control mode with `ctx.setEngineControlMode(engineId, "primary" | "backup")`.
   - Keep the flight-control system readable by splitting it per axis, as the F-16 does in
     `f16c-block50/flcs/` (`PitchChannel`, `RollChannel`, `YawChannel`, wired by `F16FlightControls`).
   - `hydraulics` (optional): a `HydraulicInstallation` for the shared network in `game/src/systems/hydraulics/` — circuits, pumps and their drive, accumulators, emergency unit, and which circuit feeds each surface's actuator chambers. Surfaces listed there move only as fast as their supply allows.
   - `annunciate` (optional): the aircraft's own cautions/warnings from the snapshot (e.g. hydraulic pressure lights).
   - `switches`: switch definitions with their owner logic and optional keyboard keys.
   - `cockpit`: a `CockpitLayout`; `mfdPages`: functions that build MFD text from the snapshot.
   - `manifest`: id, version, `provides: platform.aircraft.definition`.
4. Register it with one entry in `game/src/app/AircraftCatalog.ts`.
5. Add tests like `game/tests/unit/F16Aircraft.test.ts`: a trim or validation point from your
   source, hands-off stability, control directions, and frame-rate determinism.

`game/tests/unit/AircraftModularity.test.ts` contains a complete minimal example: a
test-only twin-engine airframe with its own surfaces, aero and control system, flown by the
same runtime. Copying its shape is a quick way to start a package.
