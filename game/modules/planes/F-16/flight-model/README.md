# F-16C Block 50 — aircraft flight-model installation

**Selected baseline:** F-16C Block 50 with GE F110-GE-129. **Status:** a runnable **provisional** vertical slice exists in `game/src/platforms/aircraft/f16c-block50/` (tests: `game/tests/unit/F16FlightModel.test.ts`, `game/tests/unit/F16Aircraft.test.ts`). **No authoritative Block 50 coefficient dataset exists.** The slice runs on labelled substitute data so the aircraft can fly while real data is sought.

## Implemented provisional slice

| Part | What exists | Data status |
|---|---|---|
| Aero tables (`AeroData.ts`) | CX/CZ/CM vs α and elevator; Cl/Cn vs β; aileron/rudder power; nine damping derivatives | `secondary-reported`: NASA TP-1538 low-speed wind-tunnel data via Stevens & Lewis App. A. Early F-16 configuration, **not Block 50**. Valid for α -10..45°, \|β\| ≤ 30°, elevator ±24°; no Mach effects (flagged above M 0.6). The aileron/rudder table β-indexing is **disputed** between public copies; the signed −30..30 original is used. |
| **High-fidelity aero (default)** (`HifiAeroData.ts`, `F16HifiAerodynamics.ts`) | 43 NASA TP-1538 tables: CX/CZ/CM/CN/CL vs α (−20…90°), β (±30°) and stabilator; LEF increments; separate 20° aileron and 30° rudder increments; damping with LEF increments; ΔCnβ, ΔClβ, ΔCm, stabilator effectiveness. Assembly follows the UMN nlplant hifi equations. | `secondary-reported`, same NASA source and same applicability caveats (early F-16, low speed, no Mach). Two documented deviations from that code: aileron is normalised by 20° (the table reference), not 21.5°; values are held at the edge, not extrapolated. Of the 48 source files, 47 matched across two public copies; one truncated copy of CL0720 was replaced by the version that matches a third copy. Cross-checked against the reduced set near trim. |
| LEF schedule (`LefSchedule`) | δLEF = 1.38·(2s+7.25)/(s+7.25)·α − 9.05·q̄/Ps + 1.45, limited to 0–25°, through a rate-limited actuator | `secondary-reported` (S&L/NASA). The actuator bandwidth of 7.3 rad/s and rate of 25°/s are from S&L. |
| Assembly, reduced set (`F16FlightModel.ts`) | S&L total-coefficient equations, CG-offset terms; clamped lookups with envelope flags | Validated: reproduces the published S&L sea-level trim (502 ft/s: α ≈ 2.12°, elevator ≈ −0.76°). Shows the F-16's relaxed static stability at 0.35 MAC. |
| Mass, geometry | S = 300 ft², b = 30 ft, c = 11.32 ft; 20,500 lbf test weight; Jx, Jy, Jz, Jxz | `secondary-reported`, S&L test condition. Mass and inertia are fixed: fuel burn does not move them yet. Engine angular momentum is `unknown` (not modelled). |
| Actuators | First-order 20.2 rad/s, rate- and position-limited stabilator/flaperon/rudder | `secondary-reported` (S&L simulation model), not ISA hydraulics. |
| Engine (F110-GE-129) — **superseded by the gas-path model below** | Spool lag, MIL/AB detent, density lapse, fuel flow, flameout at zero fuel | Max AB 29,000 lbf is `primary-published` (Shaw AFB). Dry fraction, idle, lapse, spool and TSFC are **`estimated`**. 3,175 kg internal fuel is `primary-published` (family-level). |
| **Engine, gas-path (current)** (`F110_DESIGN`, `F16Engine`) | Shared mixed-flow turbofan cycle with F110 inputs; calibrated design temperatures; spool/AB dynamics; fuel burn and flameout | 29,000 lbf AB is `primary-published`. 17,000 lbf dry, ≈270 lb/s airflow, BPR 0.76 and OPR 30.7 are `secondary-reported`. Fan PR, efficiencies, idle and dynamics are `estimated`. TIT and AB temperature are `derived` by calibration. Not tuned to TSFC, yet it comes out at 0.69 dry and 1.83 AB lb/lbf/h, in the realistic range. |
| FLCS (`F16FlightControls.ts` wiring `flcs/PitchChannel.ts`, `RollChannel.ts`, `YawChannel.ts`) | NASA TP-1538 appendix A control laws (figs 62–65) and control system B: g-command CAS with C*-type feedback, alpha limiting, q-scheduled PI loop and alpha stability; roll-rate CAS with command shaping, notch filter and roll-rate limiting; yaw damper, ay feedback, scheduled ARI, spin prevention above 29°. Reproduces TP-1538 fig 30. | Published simulator laws for an F-16-class airframe, not the Block 50 OFP. Deviations: 9 g limit, auto roll trim, linear pedal gradient. |
| Hydraulics (`F16Hydraulics.ts`) | A/B 3000-psi systems feeding the surface actuators through the shared network; single-system loss reduces surface rate (≈70 %); dual loss → EPU on A. | Topology from the flight-manual summary; sizes `estimated`. |
| Engine (`F110Engine.ts`, `F110DeckData.ts`) | Dry engine from the GE F110-GE-129 cycle deck (NASA TM-104326): corrected tables vs fan speed, validated on 19 held-out flight points (Fg mean < 2.5 %, worst 5.4 %). Pitot inlet; thermodynamic afterburner calibrated to 29,000 lbf uninstalled; C-D nozzle with deck AE9/AE8 and Cfg schedules. FADEC throttle map, idle and MIL corrected-N1 lapse from the deck; ENG CONT PRI/SEC (SEC: nozzle closed at the MIL position, slower acceleration, AB inhibited). | Deck data `secondary-reported`; afterburner, installation loss and acceleration rates `estimated`; MIL lapse beyond θ1 1.13 extrapolated. Max level speed: SL M1.25 (≈1.2), 40,000 ft M1.81 (1.89). |
| Aircraft (`F16Aircraft.ts`) | Composes the above on the shared rigid body, atmosphere, terrain and scheduler. Snapshot includes surfaces, engine, envelope flags and task faults. | Closed-loop tests: hands-off 1 g; about 5 g on half stick with no oscillation; full aft stick held under the AoA and g limits; roll and yaw directions; identical at 30 and 144 fps. |

**Not modelled yet:** LEF/TEF schedule and aero (the low-fidelity dataset excludes them), speedbrakes, landing gear and ground handling, hydraulic/electrical/fuel networks, fuel-driven mass/CG change, compressibility, damage, stores and avionics.


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
