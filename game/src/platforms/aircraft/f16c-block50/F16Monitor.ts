/**
 * F-16C systems monitor — this package's own caution/warning logic and F110-GE-129 accessory
 * indications. It observes the engine, fuel, hydraulic and electrical models; it never changes them.
 *
 * PRIMARY (T.O. GR1F-16CJ-1, Section I, GE 129 and systems; Section V fig 5-2):
 *  - ENGINE warning (battery bus 1): rpm below 60 % (sub-idle) or ≈2 s after FTIT indication
 *    exceeds 1,100 °C; goes off when the condition clears.
 *  - HYD/OIL PRESS warning (battery bus 1): system A or B below 1,000 psi (off when both are above);
 *    engine oil below ≈10 psi for 30 s (time delay for manoeuvres), off above ≈20 psi.
 *  - FWD FUEL LOW / AFT FUEL LOW (emergency DC bus 1): from the fuel system (400 / 250 lb, C).
 *  - FUEL/OIL HOT: fuel to the engine too hot, or GE 129 oil above 300 °F.
 *  - SEC caution: engine in SEC. ELEC SYS caution with any ELEC panel light: MAIN GEN (main gen not
 *    on the non-essential AC bus), STBY GEN (standby power not available), EPU GEN (EPU commanded but
 *    its generator not powering the emergency AC buses), FLCS PMG (in flight: no FLCS branch on the
 *    PMG), ACFT BATT TO FLCS (battery feeding the FLCS).
 *  - Indicators and their buses: RPM 0–110 % (battery bus 1), FTIT 200–1,200 °C = EGT (battery bus
 *    1), NOZ POS 0–100 % (emergency AC 2), OIL 0–100 psi (emergency AC 2), FUEL FLOW pph incl. AB
 *    (emergency AC 1), HYD PRESS A/B (emergency AC 2).
 *  - Ignition (GE 129): high-energy ignition on from ≈10 % to 59 % rpm in a start, and for relight
 *    when rpm falls faster than 5 %/s or below 59 %; low-energy backup when decelerating through
 *    ≈55 % airborne. SEC: high-energy ignition continuously on, IGVs fixed fully closed.
 *  - VSV reset: after a throttle snap to IDLE the compressor VSVs are reset slightly closed for
 *    2 minutes (idle rpm 2–3 % higher meanwhile).
 *  - Brake/JFS accumulators (2): read from the hydraulic network (F16Hydraulics.ts); charged by system B,
 *    recharge in 40 s (hot) to 60 s (cold).
 * ESTIMATED: the IGV schedule (no GE 129 schedule in the manual: closed below 60 % corrected fan
 * speed, fully open by 90 %), oil pressure falling at low g (the manual allows zero oil pressure
 * for up to 1 min below +1 g), the snap-to-idle
 * detection rate, oil-hot level in K.
 */
import type { MonitorContext, MonitorOutput } from "../common/AircraftDefinition.js";
import { F110_DESIGN } from "./F110Engine.js";

const PSI = 6894.757;
export const F16_MONITOR = Object.freeze({
  engineSubIdle: 0.60, ftitWarnC: 1100, ftitWarnDelayS: 2, hydWarnPsi: 1000, oilWarnPsi: 10, oilClearPsi: 20, oilWarnDelayS: 30,
  oilHotK: (300 - 32) * 5 / 9 + 273.15, ignitionOn: 0.10, ignitionOff: 0.59, relightDecelPerS: 0.05, lowEnergyBelow: 0.55,
  vsvResetS: 120,
  // ESTIMATED
  igvClosedBelow: 0.60, igvOpenAbove: 0.90, accumulatorPrechargePsi: 1000, accumulatorFullPsi: 3000
});
const M = F16_MONITOR;

export function f16Monitor(): { step(ctx: MonitorContext, dt: number): MonitorOutput; reset(): void } {
  let ftitHighS = 0, oilLowS = 0, oilLight = false, vsvResetS = 0, lastN = 0, lastThrottleHigh = false;
  let starting = false;
  const reset = () => { ftitHighS = 0; oilLowS = 0; oilLight = false; vsvResetS = 0; lastN = 0; lastThrottleHigh = false; starting = false; };
  return {
    reset,
    step: (ctx, dt) => {
      const e = ctx.engines[0];
      const bus = (id: string) => ctx.electrical?.buses.find((b) => b.id === id)?.powered ?? true;
      const src = (id: string) => ctx.electrical?.sources.find((x) => x.id === id);
      const hyd = (id: string) => ctx.hydraulics?.circuits.find((c) => c.id === id)?.pressurePa ?? 0;
      const airborne = !ctx.sensors.weightOnWheels;
      // Cockpit RPM is core (N2) speed from the engine alternator, percent of the deck reference.
      const n2Ref = F110_DESIGN.gasGenerator?.referenceN2Rpm;
      const n = e ? (e.n2Rpm !== undefined && n2Ref ? e.n2Rpm / n2Ref : e.spoolSpeed) : 0;
      const decel = dt > 0 ? (lastN - n) / dt : 0;
      const ftitC = e ? (e.exhaustGasTemperatureK ?? e.turbineInletTemperatureK) - 273.15 : 0;
      // Oil pressure: the engine model's pump pressure, starved at low g (ESTIMATED).
      const gFactor = Math.max(0, Math.min(1, ctx.sensors.nzG / 0.5));
      // Oil pump pressure ∝ core speed² (the engine model's health spec, scaled on physical N2).
      const oilMaxPa = F110_DESIGN.dynamics?.health?.oilPressureAtMaxPa ?? 0;
      const oilPsi = e?.health ? (oilMaxPa * n * n / PSI) * gFactor : 0;
      const sec = e?.control.mode === "backup";

      // Timers.
      ftitHighS = ftitC > M.ftitWarnC ? ftitHighS + dt : 0;
      oilLowS = oilPsi < M.oilWarnPsi ? oilLowS + dt : 0;
      if (oilLowS >= M.oilWarnDelayS) oilLight = true;
      if (oilPsi > M.oilClearPsi) oilLight = false;
      // VSV reset after a snap to IDLE (throttle from above MIL-ish to idle within a short time).
      const throttleHigh = ctx.switches !== undefined && (e?.control.speedDemand ?? 0) > 0.9;
      if (lastThrottleHigh && (e?.control.speedDemand ?? 1) < 0.75 && decel > 0.02) vsvResetS = M.vsvResetS;
      lastThrottleHigh = throttleHigh || (lastThrottleHigh && (e?.control.speedDemand ?? 0) > 0.75);
      vsvResetS = Math.max(0, vsvResetS - dt);
      // Ignition.
      if (n >= M.ignitionOn && n < M.ignitionOff && decel <= 0) starting = true;
      if (n >= M.ignitionOff || n < 0.02) starting = false;
      const highEnergy = sec || starting || (n > 0.02 && (decel > M.relightDecelPerS || n < M.ignitionOff));
      const lowEnergy = airborne && n < M.lowEnergyBelow && decel > 0;
      // IGVs (fraction closed; SEC = fixed fully closed).
      const fan = e?.fanSpeed ?? n;
      const igvClosed = sec ? 1 : Math.max(0, Math.min(1, (M.igvOpenAbove - fan) / (M.igvOpenAbove - M.igvClosedBelow)));
      // Brake/JFS accumulators: the hydraulic network's check-valve branch on system B.
      const branchPa = (id: string) => ctx.hydraulics?.branches?.find((b) => b.id === id)?.pressurePa ?? 0;
      const accPsi = branchPa("B.brakes") / PSI;
      const accumulator = Math.max(0, Math.min(1, (accPsi - M.accumulatorPrechargePsi) / (M.accumulatorFullPsi - M.accumulatorPrechargePsi)));
      lastN = n;

      // ELEC panel.
      const ess = ctx.electrical?.buses.find((b) => b.id === "ac.nonessential");
      const mainGen = !!ctx.electrical && ess?.sourceId !== "gen.main";
      const stbyGen = !!ctx.electrical && !(src("gen.standby")?.available ?? true);
      const epuRunning = ctx.hydraulics?.emergencyUnit?.state === "running" || ctx.hydraulics?.emergencyUnit?.state === "starting";
      const emAc = ctx.electrical?.buses.find((b) => b.id === "ac.emergency1");
      const epuGen = epuRunning && !!emAc && !(ctx.electrical?.buses.find((b) => b.id === "ac.essential")?.powered ?? true) && emAc.sourceId !== "gen.epu";
      const flcs = ctx.electrical?.buses.find((b) => b.id === "flcs");
      const flcsPmg = airborne && !!flcs && flcs.sourceId !== "pmg.flcs";
      const battToFlcs = flcs?.sourceId === "battery.main";
      const fi = ctx.fuelComponents?.indications ?? {};
      const tankKg = (id: string) => ctx.fuelTanks?.find((t) => t.id === id)?.kg ?? Infinity;
      const LB = 0.45359237;

      const lights: { text: string; level: "caution" | "warning" }[] = [];
      const warn = (on: boolean, text: string, busId: string) => { if (on && bus(busId)) lights.push({ text, level: "warning" }); };
      const caution = (on: boolean, text: string, busId = "dc.battery2") => { if (on && bus(busId)) lights.push({ text, level: "caution" }); };
      warn(!!e && (n < M.engineSubIdle || ftitHighS >= M.ftitWarnDelayS || ctx.switches["f16.test.engine-fault"] === "ALTERNATOR"), "ENGINE", "dc.battery1");
      warn(hyd("A") / PSI < M.hydWarnPsi || hyd("B") / PSI < M.hydWarnPsi || oilLight, "HYD/OIL PRESS", "dc.battery1");
      caution(tankKg("fwdReservoir") < 400 * LB, "FWD FUEL LOW", "dc.emergency1");
      caution(tankKg("aftReservoir") < 250 * LB, "AFT FUEL LOW", "dc.emergency1");
      caution((fi["fuelHot"] ?? 0) > 0 || (e?.health?.oilTemperatureK ?? 0) > M.oilHotK, "FUEL/OIL HOT", "dc.emergency2");
      caution(sec, "SEC", "dc.emergency2");
      caution(mainGen || stbyGen || epuGen || flcsPmg || battToFlcs, "ELEC SYS");
      if ((fi["gravityFeed"] ?? 0) > 0) lights.push({ text: "GRAVITY FEED", level: "caution" });

      return {
        lights,
        indications: {
          // RPM signal comes from the engine alternator (zero if it fails).
          rpmPercent: bus("dc.battery1") && ctx.switches["f16.test.engine-fault"] !== "ALTERNATOR" ? n * 100 : 0,
          ftitC: bus("dc.battery1") ? Math.max(200, ftitC) : 200,
          nozzlePercent: bus("ac.emergency2") && e ? (Number.isFinite(e.nozzle.position) ? e.nozzle.position : 0) * 100 : 0,
          oilPsi: bus("ac.emergency2") ? Math.min(100, oilPsi) : 0,
          fuelFlowPph: bus("ac.emergency1") && e ? e.fuelFlowKgS * 3600 / LB : 0,
          hydAPsi: bus("ac.emergency2") ? hyd("A") / PSI : 0,
          flcsAccAPsi: branchPa("A.flcs") / PSI, flcsAccBPsi: branchPa("B.flcs") / PSI, lgBranchPsi: branchPa("B.lg") / PSI, dragChuteAccPsi: branchPa("B.dragchute") / PSI,
          hydBPsi: bus("ac.emergency2") ? hyd("B") / PSI : 0,
          igvClosedFraction: igvClosed, vsvResetS, highEnergyIgnition: highEnergy ? 1 : 0, lowEnergyIgnition: lowEnergy ? 1 : 0,
          oilLowTimerS: oilLowS, ftitHighTimerS: ftitHighS,
          brakeJfsAccumulatorPsi: accPsi, brakeJfsAccumulatorCharge: accumulator,
          elecMainGen: mainGen ? 1 : 0, elecStbyGen: stbyGen ? 1 : 0, elecEpuGen: epuGen ? 1 : 0, elecFlcsPmg: flcsPmg ? 1 : 0, elecBattToFlcs: battToFlcs ? 1 : 0,
          masterCaution: lights.some((l) => l.level === "caution") ? 1 : 0
        }
      };
    }
  };
}
