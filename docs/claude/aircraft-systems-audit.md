# Aircraft systems audit — F-16C Block 50 and MiG-29 9.13

**Date:** 2026-11-25. **Scope:** engine, electrical, hydraulic, fuel, pneumatic and flight-model systems, plus how they connect, in `game/src` at commit `232f42f`.
**Method:** reading code and running tests. A README was not taken as proof. Every classification below rests on code paths and tests.
**Classes:** IMPLEMENTED (working code with tests) · PARTIAL (working, important behaviour missing) · ESTIMATED (working, but the parameters are project estimates) · UNVERIFIED (working, but the source does not apply exactly to this variant) · MISSING · DOCUMENTATION ONLY.

Implemented is not the same as accurate. Nearly all MiG-29 data comes from the GAF T.O. 1F-MIG29-1 (MiG-29G, 9.12 family), so every MiG-29 value is at best UNVERIFIED for product 9.13. Much F-16 data is generic T.O. GR1F-16CJ-1 or TP-1538 data, not Block 50-specific.

## 1. Classification by area

### Engines (shared `physics/propulsion`, packages `F110*.ts`, `MiG29Engines.ts`)

| Capability | F-16 / F110-GE-129 | MiG-29 / RD-33 | Notes |
|---|---|---|---|
| Thermodynamic cycle (fan, compressor, burner, turbines, mixer, AB, C-D nozzle) | IMPLEMENTED (deck-anchored) | IMPLEMENTED, ESTIMATED component maps | Bench check: RD-33 MIL 49.4 kN / SFC 0.78, max AB 81.4 kN / 1.89 kg/kgf·h, which matches published figures. Station data are reported. |
| Independent N1/N2 spool dynamics | PARTIAL | PARTIAL | A two-spool lag exists in the transient model. There is no rotor-inertia/torque-balance solution. |
| Start sequence, ignition, ground start, shutdown | **MISSING** | **MISSING** | Engines start running at reset. JFS (F-16) and air-turbine starter/APU (MiG-29) are not modelled. |
| Flameout / relight | PARTIAL | PARTIAL | Afterburner blow-out and relight are modelled. Main-burner flameout comes from fuel starvation, but there is no in-flight relight envelope or windmill start. |
| Surge / stall | IMPLEMENTED, ESTIMATED margins | IMPLEMENTED, ESTIMATED margins | Margin table minus penalties for acceleration, distortion and AB light-off pulses. Recovery hold. |
| Oil, vibration, life counters | ESTIMATED | ESTIMATED | Oil temperature and pressure are first-order functions of NH². There is no oil-system network (tank, pump, filter, cooler). |
| Deterioration / wear | **MISSING** | **MISSING** | Life counters accumulate but do not degrade efficiencies or margins. |
| Engine control | IMPLEMENTED: DEC/MEC, PRI/HYB/SEC, automatic transfers, supersonic idle lock-up, PFLs | IMPLEMENTED: FADEC limits, NPM/LPM | SEC transfer and recovery should be re-checked against T.O. §1 alternator/DEC logic (a test exists for detection only). MiG-29 combat mode is **MISSING**. |
| Minimum afterburner | n/a (zones) | FIXED this session | Before the fix, light AB gave less thrust than MIL while burning 6–13 % more fuel. |

### Electrical (shared `systems/electrical`)

| Capability | Status | Notes |
|---|---|---|
| Sources, priority transfer, converters, batteries, overload trip, shedding | IMPLEMENTED | The fidelity tier is "bus power availability". |
| Voltage, frequency, current as continuous quantities | **MISSING** | Required by brief §5 (regulation, under/over voltage and frequency). |
| Equipment-level consumers with states | **MISSING** | Loads are fixed watts per bus (`essentialLoadW`/`sheddableLoadW`) and are ESTIMATED. |
| Generator speed dependence | PARTIAL | On/off at a minimum drive speed. No output-versus-speed curve, excitation or thermal limit. |
| Battery charge/discharge | PARTIAL | Ah drain. Recharge only where the package declares it. No voltage sag or temperature. |
| F-16 architecture (main/standby/EPU generators, FLCS PMG, batteries, bus set) | IMPLEMENTED, UNVERIFIED for Block 50 specifics | |
| MiG-29 architecture (AC 30 kVA, DC 12 kW, PTO, transformer, 2× silver-zinc) | IMPLEMENTED, UNVERIFIED for 9.13 | |

### Hydraulics (shared `systems/hydraulics`)

| Capability | Status | Notes |
|---|---|---|
| Lumped circuits/branches, compensated pumps, accumulators, check and isolation valves, consumers, reservoirs, fluid temperature, cooler | IMPLEMENTED, sizes ESTIMATED | |
| Actuator coupling: chamber pressure, hinge load ∝ q̄ and deflection, servo-valve speed law | IMPLEMENTED | Degradation changes surface rate. It is not a warning flag. |
| Pump inlet / reservoir pressurisation | IMPLEMENTED (this session, MiG-29) | |
| Pump wear, valve failure, line rupture, actuator failure, overheating consequences | **MISSING** | Faults currently cover pump failure and internal/external leaks only. |
| F-16 A/B, EPU on A, FLCS accumulators, B utilities | IMPLEMENTED, sizes ESTIMATED | |
| MiG-29 main/boost, 13 MPa limiter, emergency fuel-driven pump | IMPLEMENTED, UNVERIFIED for 9.13 | |

### Fuel (shared `systems/fuel` tank physics; package logic)

| Capability | F-16 | MiG-29 |
|---|---|---|
| Individual tanks, capacities, centroids → mass, CG, inertia | IMPLEMENTED (centroids ESTIMATED) | IMPLEMENTED (centroids ESTIMATED). **9.13 spine tank MISSING.** |
| Transfer, feed, boost pumps, sequence | IMPLEMENTED | IMPLEMENTED (GAF sequence) |
| Near-zero-g accumulator | n/a | FIXED this session: it is now a tank. Before, its 30 kg sat outside the mass budget and refills deleted fuel. |
| Fuel pressure as a continuous quantity | PARTIAL (available/not) | PARTIAL |
| Fuel temperature | IMPLEMENTED (heat exchanger) | **MISSING** |
| Leaks, tank isolation, quantity-gauge error | **MISSING** | **MISSING** |

### Pneumatics (shared `systems/pneumatics`, new this cycle)

| Capability | Status |
|---|---|
| Finite gas inventory, ideal gas, thermal relaxation, check-valve isolation, regulators, consumers, leak/regulator/check-valve faults | IMPLEMENTED (sizes ESTIMATED) |
| MiG-29 main/emergency 15 MPa, chute bottle 6.3 MPa, pneumatic normal brakes, reservoir pressurisation, staged emergency gear | IMPLEMENTED, UNVERIFIED for 9.13 |
| Emergency braking, anti-skid valves, canopy, drag chute, fuel shut-off valves, relief valves, pressure-gauge failure | **MISSING** |
| F-16 pneumatics (e.g. emergency gear extension) | **MISSING** — needs the Block 50 source first |

### Flight model

| Capability | F-16 | MiG-29 |
|---|---|---|
| Aircraft-specific aero, geometry, control laws, mass | IMPLEMENTED (TP-1538 hi-fi tables) | IMPLEMENTED (component method, ESTIMATED) |
| LERX vortex, vortex-burst lag, separation hysteresis (Goman–Khrabrov), buffet | IMPLEMENTED (shared `UnsteadyFlow`) | IMPLEMENTED |
| Ground effect including pitch increment | IMPLEMENTED | IMPLEMENTED |
| Trailing-edge flaps / high lift | **MISSING**: flaperons do roll only, with no FLCS TEF schedule | ADDED this session (ESTIMATED) |
| Wake turbulence between aircraft | **MISSING** | **MISSING** |
| Gear, speedbrake, stores drag | gear/speedbrake ESTIMATED; stores MISSING | gear/speedbrake ESTIMATED; stores MISSING |

### Cross-cutting

| Capability | Status |
|---|---|
| Deterministic fixed-step scheduler | IMPLEMENTED (Stage 1) |
| Aircraft save/load and replay | **MISSING**: `FixedWingAircraft` is not a `PersistableModule`, so network, tank and engine state cannot be saved |
| Wear driven by operating history | **MISSING** (life counters only) |
| EFB pages | IMPLEMENTED for engines, fuel, electrics and hydraulics (both aircraft); MiG-29 pneumatics added this session. Electrical pages cannot show voltage, frequency or current because the model has none. |

## 2. Discrepancies found and fixed this session

1. **RD-33 light afterburner** gave less thrust than MIL at higher fuel flow. Fixed with a platform-neutral `minAfterburnerFraction`.
2. **MiG-29 fuel accumulator** sat outside the tank set: its mass was missing from mass, CG and inertia, and each refill removed fuel from the aircraft. Fixed: it is now a tank inside tank 3, and tank 3's capacity is reduced by the accumulator volume so the published 4,300 L total holds.
3. **EFB afterburner plume** was drawn over the nozzle section. Fixed.
4. **Gear-handle switch** did not match the start state (earlier this session). Fixed.

## 3. Open discrepancies and unsupported assumptions

- The MiG-29 data source (GAF 9.12) is not 9.13. The 9.13 spine tank is absent.
- Electrical loads are bus totals presented as estimates. They should become equipment-level loads, still estimated where nothing is measured.
- The MiG-29 hydraulic gear consumer still draws flow during pneumatic emergency extension (minor).
- F-16 SEC recovery behaviour needs a source re-check (brief §4).

## 4. Integration matrices

Legend: ✔ implemented through simulated state · ◐ partial · ✘ missing.

### F-16C Block 50

| From → To | State | Implemented | Missing | Physical variables | Failure consequence | Verification |
|---|---|---|---|---|---|---|
| Engine → electrical | ◐ | Generators on engine/accessory drive; FLCS PMG | Speed-dependent voltage and frequency; excitation | N2, generator V/Hz/A | Generator loss → bus transfer to standby/EPU | `AircraftSystems.test.ts`; needs V/Hz tests |
| Engine → hydraulics | ✔ | Pumps on core speed; EPU on A | Pump wear | N2, pump displacement, P | Engine out → A/B decay → EPU | `F16HydraulicPowerSupply.test.ts` |
| Fuel → engine | ◐ | Feed availability, FFP, heat exchanger | Continuous feed pressure, leaks | Feed P, fuel T | Starvation → flameout | `F16HafSystems.test.ts` |
| Electrical → flight controls | ✔ | FLCS power loss freezes surfaces | Branch-level FLCC channels | Bus power | FLCS power loss | `AircraftSystems.test.ts` |
| Hydraulics → flight controls | ✔ | Chamber pressure × hinge load → rate | Actuator failure modes | P, q̄, δ | Slower roll at high q̄ on one system | `HydraulicNetwork.test.ts` |
| Fuel → flight dynamics | ✔ | Tank mass, CG, inertia | — | Tank kg, centroids | CG shift | `FuelSystems.test.ts` |
| Pneumatics → emergency systems | ✘ | — | F-16 stored-gas uses (source needed) | — | — | — |
| Electrical → engine control | ◐ | DEC alternator loss → MEC | DEC/MEC bus power from the network | Bus power | DEC loss → SEC | `F110EngineControl.test.ts` |

### MiG-29 9.13 (GAF 9.12 data)

| From → To | State | Implemented | Missing | Physical variables | Failure consequence | Verification |
|---|---|---|---|---|---|---|
| Engine → gearbox → electrical/hydraulics/fuel | ✔ | Freewheel GBX on the faster engine drives both pumps, both generators and the active-fuel pump | Generator V/Hz | NH, GBX speed | Both engines out → all GBX loads lost | `MiG29HydElec.test.ts` |
| Hydraulics → flight controls | ✔ | Dual chambers, limiter isolates utilities | Actuator failure modes | P, q̄, δ | Main lost → booster-only control | `MiG29HydElec.test.ts` |
| Hydraulics → flaps (new) | ✔ | Flap actuator on main | — | P, δ | No main → flaps stay | `MiG29Flaps.test.ts` |
| Pneumatics → hydraulics | ✔ | Reservoir pressurisation → pump inlet fraction | Validated inlet law | Regulator outlet P, nz | Regulator fail + ≤0 g → pump starvation | `Pneumatics.test.ts` |
| Pneumatics → gear/brakes | ✔ | Staged emergency extension, pneumatic normal brakes | Emergency braking, anti-skid | Bottle P, leg extension | Empty bottle → no extension | `Pneumatics.test.ts` |
| Fuel → engine | ◐ | Feed tank, boost, accumulator at near-zero g | Continuous feed pressure, fuel temperature | Feed kg, nz | Accumulator empty → starvation | `FuelSystems.test.ts` |
| Fuel → flight dynamics | ✔ | Including the accumulator (fixed) | Spine tank | Tank kg | CG shift | `FuelSystems.test.ts` |
| Electrical → flight controls | ✔ | SAU/AFCS shed on PTO and battery | Equipment-level loads | Bus power | SAU drops out | `MiG29HydElec.test.ts` |

## 5. Recommended sequence (adjusted from brief §17)

The brief's order is sound. Two dependencies move items earlier:

1. **Aircraft save/load first (Phase 1).** Every later phase adds state. Making `FixedWingAircraft` persistable now, with deterministic round-trip tests, lets each new state carry its own save test, instead of retrofitting six systems later.
2. **Electrical V/Hz/A tier plus equipment loads (start of Phase 3, before engine depth).** Engine start (Phase 2) needs starter power, ignition power and DEC/FADEC power from the network. Building start sequences before the electrical model can carry current would mean faking those links.

Then:

3. Engine start, shutdown and relight for both aircraft (JFS / air-turbine starter), and deterioration driven by life counters.
4. Hydraulic failure modes: pump wear, valve and actuator failure, line rupture, overheating consequences.
5. Fuel: continuous feed pressure, leaks and isolation, gauge error, MiG-29 fuel temperature, 9.13 spine tank (only once a source is found).
6. Pneumatics: emergency braking and anti-skid, drag chute, canopy; F-16 uses after a source review.
7. Flight model: F-16 TEF schedule, then wake turbulence (needs multi-aircraft scenarios).

Each step is one vertical slice with tests, the owning README and a `PROJECT_STATE.md` entry.
