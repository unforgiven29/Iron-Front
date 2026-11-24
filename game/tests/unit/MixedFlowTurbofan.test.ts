import { describe, expect, it } from "vitest";
import { standardAtmosphere } from "../../src/physics/environment/Atmosphere.js";
import { Fadec, scheduleSteadyState } from "../../src/physics/propulsion/Fadec.js";
import { chokedThroatArea, supersonicMachForAreaRatio, variableConvergentDivergentNozzle } from "../../src/physics/propulsion/components/Nozzle.js";
import { inletRecovery, MixedFlowTurbofan, solveCycle } from "../../src/physics/propulsion/MixedFlowTurbofan.js";
import { F16_ENGINE } from "../../src/platforms/aircraft/f16c-block50/F16Data.js";
import { F110_CONTROL, F110_DESIGN } from "../../src/platforms/aircraft/f16c-block50/F110Engine.js";

const LBF = 4.4482216152605;
const at = (altM: number, mach: number) => { const a = standardAtmosphere(altM); return { temperatureK: a.temperatureK, pressurePa: a.pressurePa, mach }; };
const steady = (altM: number, mach: number, ab: number, spool = 1) => {
  const amb = at(altM, mach);
  const theta = (amb.temperatureK * (1 + 0.2 * mach * mach)) / 288.15;
  return solveCycle(F110_DESIGN, amb, spool / Math.sqrt(theta), ab);
};
/** Thrust-specific fuel consumption, lb/(lbf·h). */
const tsfc = (r: ReturnType<typeof solveCycle>) => (r.fuelFlowKgS / 0.45359237 * 3600) / (r.netThrustN / LBF);

/** Test-stand (uninstalled) F110: bellmouth inlet, no installation losses. */
const BENCH = { ...F110_DESIGN, installationLossFraction: 0, inlet: { kind: "bellmouth", recovery: () => 1 } };
const bench = (ab: number, n1c = F110_CONTROL.maxCorrectedSpeed) => solveCycle(BENCH, at(0, 0), n1c, ab);

describe("F110 engine (GE deck gas generator + calibrated afterburner)", () => {
  it("matches the published uninstalled ratings: afterburner calibrated to 29,000 lbf, dry ≈17,000 lbf predicted by the deck", () => {
    expect(bench(1, 1).netThrustN).toBeCloseTo(F16_ENGINE.maxAfterburnerThrustN.value, 0);
    expect(bench(0).netThrustN / LBF).toBeGreaterThan(16_000);
    expect(bench(0).netThrustN / LBF).toBeLessThan(18_200);
  });

  it("produces realistic fuel consumption, spool speeds and exhaust temperature", () => {
    expect(tsfc(bench(0))).toBeGreaterThan(0.6);
    expect(tsfc(bench(0))).toBeLessThan(0.85);
    expect(tsfc(bench(1, 1))).toBeGreaterThan(1.6);
    expect(tsfc(bench(1, 1))).toBeLessThan(2.3);
    expect(F110_DESIGN.afterburnerMaxTemperatureK).toBeLessThan(2400);
    const mil = bench(0, 1);
    expect(mil.n1Rpm).toBeCloseTo(8241, -1);
    expect(mil.n2Rpm).toBeCloseTo(14709, -2);
    expect(mil.exhaustGasTemperatureK).toBeGreaterThan(1000);
    expect(mil.outsideDeck).toBe(false);
  });

  it("lapses with altitude, gains ram airflow with Mach, and keeps afterburning thrust supersonic", () => {
    expect(steady(9144, 0.9, 0).netThrustN).toBeLessThan(0.55 * steady(0, 0.9, 0).netThrustN);
    expect(steady(0, 0.9, 0).airflowKgS).toBeGreaterThan(steady(0, 0, 0).airflowKgS);
    const r = steady(0, 0.9, 0);
    expect(r.ramDragN).toBeGreaterThan(0);
    expect(r.grossThrustN - r.ramDragN).toBeCloseTo(r.netThrustN, 6);
    expect(steady(12192, 1.6, 1).netThrustN).toBeGreaterThan(steady(12192, 1.6, 0).netThrustN * 1.5);
    expect(inletRecovery(0.8)).toBe(1);
    expect(inletRecovery(2)).toBeCloseTo(0.925, 3);
  });

  it("idles at a few hundred lbf, like the deck's ground idle", () => {
    const idle = bench(0, F110_CONTROL.idleSpeed).netThrustN / LBF;
    expect(idle).toBeGreaterThan(200);
    expect(idle).toBeLessThan(1000);
  });

  it("the plant follows a demand with rotor lag and flames out without fuel", () => {
    // Plant only, driven by a raw step (no engine control): surge is tested separately, so it is off here.
    const { surge: _surge, ...noSurge } = BENCH.dynamics!;
    void _surge;
    const e = new MixedFlowTurbofan({ ...BENCH, dynamics: noSurge }, F110_CONTROL.idleSpeed);
    const sl = at(0, 0);
    let s = e.step({ speed: 1, afterburner: 0 }, sl, true, 0.1);
    expect(s.spoolSpeed).toBeGreaterThan(F110_CONTROL.idleSpeed);
    expect(s.spoolSpeed).toBeLessThan(0.75);
    for (let i = 0; i < 30; i++) s = e.step({ speed: 1, afterburner: 1 }, sl, true, 0.1);
    expect(s.netThrustN).toBeGreaterThan(0.99 * F16_ENGINE.maxAfterburnerThrustN.value);
    s = e.step({ speed: 1, afterburner: 1 }, sl, false, 0.1);
    expect(s).toMatchObject({ flameout: true, netThrustN: 0, fuelFlowKgS: 0 });
  });
});

describe("FADEC (shared engine control) with the F110 schedule", () => {
  const run = (fadec: Fadec, engine: MixedFlowTurbofan, throttle: number, amb: ReturnType<typeof at>, seconds: number) => {
    let out = fadec.output, s = engine.state;
    for (let i = 0; i < Math.round(seconds / 0.02); i++) {
      out = fadec.step(throttle, { ambient: amb, spoolSpeed: s.spoolSpeed, fuelAvailable: true }, 0.02);
      s = engine.step({ speed: out.speedDemand, afterburner: out.afterburnerDemand, throat: out.throat }, amb, true, 0.02);
    }
    return { out, s };
  };
  const make = (throttle: number, amb: ReturnType<typeof at>) => {
    const f = new Fadec(BENCH, F110_CONTROL, throttle, amb);
    return { f, e: new MixedFlowTurbofan(BENCH, f.initialSpeed) };
  };

  it("uses the deck's throttle map: PLA 48.9° gives corrected N1 ≈ 0.835 at sea level", () => {
    const throttle = ((48.9 - 20) / 65) * F110_CONTROL.afterburnerDetentThrottle;
    expect(scheduleSteadyState(BENCH, F110_CONTROL, "primary", throttle, at(0, 0)).speed).toBeCloseTo(0.835, 2);
  });

  it("slams idle → MIL through the acceleration schedule (≈4 s), then lights the afterburner only after the core is up", () => {
    const sl = at(0, 0);
    const { f, e } = make(0, sl);
    let r = run(f, e, 1, sl, 1);
    expect(r.out.activeLimits).toContain("acceleration");
    expect(r.s.afterburnerLit).toBe(false);
    r = run(f, e, 1, sl, 1.5);
    expect(r.s.spoolSpeed).toBeLessThan(0.95);
    r = run(f, e, 1, sl, 4);
    expect(r.s.afterburnerLit).toBe(true);
    expect(r.s.netThrustN).toBeGreaterThan(0.98 * F16_ENGINE.maxAfterburnerThrustN.value);
  });

  it("MIL follows the deck's schedule: corrected N1 lapses with a hot engine face, and is held with a cold one", () => {
    const hotAmb = at(3000, 0.95);
    const hot = scheduleSteadyState(BENCH, F110_CONTROL, "primary", F110_CONTROL.afterburnerDetentThrottle, hotAmb);
    const thetaHot = (hotAmb.temperatureK * (1 + 0.2 * 0.95 * 0.95)) / 288.15;
    expect(hot.limits).toContain("corrected-speed");
    // Deck: θ1 ≈ 1.12 at MIL gives corrected N1 ≈ 0.98 (TM-104326 points B end / C end).
    expect(hot.speed / Math.sqrt(thetaHot)).toBeCloseTo(1.006 - 0.35 * (thetaHot - 1.05), 3);
    expect(hot.speed / Math.sqrt(thetaHot)).toBeGreaterThan(0.97);
    expect(hot.speed / Math.sqrt(thetaHot)).toBeLessThan(0.99);
    const coldAmb = at(12192, 0.6);
    const cold = scheduleSteadyState(BENCH, F110_CONTROL, "primary", F110_CONTROL.afterburnerDetentThrottle, coldAmb);
    const theta = (coldAmb.temperatureK * (1 + 0.2 * 0.36)) / 288.15;
    expect(cold.limits).not.toContain("max-speed");
    expect(cold.speed / Math.sqrt(theta)).toBeCloseTo(1.001, 2);
  });

  it("raises idle at very high altitude to keep burner pressure (minimum-pressure limiter)", () => {
    const op = scheduleSteadyState(BENCH, F110_CONTROL, "primary", 0, at(20000, 0.4));
    expect(op.limits).toContain("min-burner-pressure");
  });

  it("SEC (backup) closes the nozzle (≈ the MIL position, so MIL thrust is kept), slows acceleration and inhibits the afterburner", () => {
    const sl = at(0, 0);
    const pri = make(1, sl), sec = make(1, sl);
    sec.f.setMode("backup");
    const p = run(pri.f, pri.e, F110_CONTROL.afterburnerDetentThrottle, sl, 3);
    const r = run(sec.f, sec.e, 1, sl, 3);
    expect(r.out.mode).toBe("backup");
    expect(r.s.afterburnerLit).toBe(false);
    expect(r.out.activeLimits).toContain("afterburner-inhibited");
    expect(r.out.throat).toEqual({ kind: "position", position: 0 });
    expect(Math.abs(r.s.netThrustN - p.s.netThrustN) / p.s.netThrustN).toBeLessThan(0.03);
    const slow = make(0, sl);
    slow.f.setMode("backup");
    const fast = make(0, sl);
    expect(run(slow.f, slow.e, 0.77, sl, 2).s.spoolSpeed).toBeLessThan(run(fast.f, fast.e, 0.77, sl, 2).s.spoolSpeed);
  });
});

describe("Nozzle component (variable convergent–divergent)", () => {
  const nozzle = variableConvergentDivergentNozzle({ minThroatAreaM2: 0.2, maxThroatAreaM2: 0.6, exitAreaRatioClosed: 1.1, exitAreaRatioOpen: 1.3, thrustCoefficient: 1 });
  const flow = (ambientPressurePa: number) => ({ massFlowKgS: 100, totalPressurePa: 300_000, totalTemperatureK: 900, gamma: 1.35, cpJkgK: 1100, ambientPressurePa });

  it("uses the isentropic area–Mach relation and the choked-flow throat area", () => {
    expect(supersonicMachForAreaRatio(1.6875, 1.4)).toBeCloseTo(2.0, 3); // standard table value
    const R = 1100 * 0.35 / 1.35;
    const g = 1.35, gamma = Math.sqrt(g) * (2 / (g + 1)) ** ((g + 1) / (2 * (g - 1)));
    expect(chokedThroatArea(flow(101325))).toBeCloseTo(100 * Math.sqrt(R * 900) / (300_000 * gamma), 9);
  });

  it("makes pressure thrust: positive under-expanded at altitude, and the same flow gives more total thrust there", () => {
    const sl = nozzle.evaluate(flow(101325), { kind: "auto" });
    const alt = nozzle.evaluate(flow(20_000), { kind: "auto" });
    expect(alt.exitPressurePa).toBeGreaterThan(20_000);
    expect(alt.pressureThrustN).toBeGreaterThan(0);
    expect(alt.grossThrustN).toBeGreaterThan(sl.grossThrustN);
    expect(sl.momentumThrustN + sl.pressureThrustN).toBeCloseTo(sl.grossThrustN, 6);
  });

  it("opens the throat to pass the flow in auto, and reports when a held throat is too small", () => {
    const auto = nozzle.evaluate(flow(101325), { kind: "auto" });
    expect(auto.throatAreaM2).toBeCloseTo(auto.requiredThroatAreaM2, 9);
    expect(auto.throatAreaRatio).toBeCloseTo(1, 9);
    const closed = nozzle.evaluate(flow(101325), { kind: "position", position: 0 });
    expect(closed.throatAreaM2).toBe(0.2);
    expect(closed.throatAreaRatio).toBeGreaterThan(1);
  });

  it("generic-map engines: a held-closed throat makes the cycle run its turbine hotter (back-pressure matching)", () => {
    const sl = at(0, 0);
    const { gasGenerator: _deck, ...withoutDeck } = F110_DESIGN;
    void _deck;
    const generic = { ...withoutDeck, turbineInletTemperatureK: 1600, afterburnerMaxTemperatureK: 2000, nozzle: variableConvergentDivergentNozzle({ minThroatAreaM2: 0.22, maxThroatAreaM2: 0.6, exitAreaRatioClosed: 1.1, exitAreaRatioOpen: 1.3, thrustCoefficient: 0.98 }) };
    const open = solveCycle(generic, sl, 0.95, 0);
    const closed = solveCycle(generic, sl, 0.95, 0, { throat: { kind: "position", position: 0 } });
    expect(closed.backPressureLimited).toBe(true);
    expect(closed.turbineInletTemperatureK).toBeGreaterThan(open.turbineInletTemperatureK);
    expect(closed.nozzle.throatAreaRatio).toBeLessThanOrEqual(1 + 1e-6);
  });
});
