import { describe, expect, it } from "vitest";
import { standardAtmosphere } from "../../src/physics/environment/Atmosphere.js";
import { Fadec, scheduleSteadyState } from "../../src/physics/propulsion/Fadec.js";
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

describe("F110 gas-path cycle (calibrated to published SLS ratings)", () => {
  it("hits the published sea-level-static dry and afterburning thrust", () => {
    expect(steady(0, 0, 0).netThrustN).toBeCloseTo(F16_ENGINE.militaryThrustN.value, 0);
    expect(steady(0, 0, 1).netThrustN).toBeCloseTo(F16_ENGINE.maxAfterburnerThrustN.value, 0);
  });

  it("produces realistic fuel consumption and temperatures it was NOT tuned to", () => {
    expect(tsfc(steady(0, 0, 0))).toBeGreaterThan(0.6);
    expect(tsfc(steady(0, 0, 0))).toBeLessThan(0.85);
    expect(tsfc(steady(0, 0, 1))).toBeGreaterThan(1.6);
    expect(tsfc(steady(0, 0, 1))).toBeLessThan(2.3);
    expect(F110_DESIGN.turbineInletTemperatureK).toBeGreaterThan(1300);
    expect(F110_DESIGN.turbineInletTemperatureK).toBeLessThan(1900);
    expect(F110_DESIGN.afterburnerMaxTemperatureK).toBeLessThan(2400);
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

  it("idles at a few percent of max thrust", () => {
    const idle = steady(0, 0, 0, F110_CONTROL.idleSpeed).netThrustN;
    expect(idle).toBeGreaterThan(0.02 * F16_ENGINE.maxAfterburnerThrustN.value);
    expect(idle).toBeLessThan(0.12 * F16_ENGINE.maxAfterburnerThrustN.value);
  });

  it("the plant follows a demand with rotor lag and flames out without fuel", () => {
    const e = new MixedFlowTurbofan(F110_DESIGN, 0.72);
    const sl = at(0, 0);
    let s = e.step({ speed: 1, afterburner: 0 }, sl, true, 0.1);
    expect(s.spoolSpeed).toBeGreaterThan(0.72);
    expect(s.spoolSpeed).toBeLessThan(0.9);
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
      s = engine.step({ speed: out.speedDemand, afterburner: out.afterburnerDemand }, amb, true, 0.02);
    }
    return { out, s };
  };
  const make = (throttle: number, amb: ReturnType<typeof at>) => {
    const f = new Fadec(F110_DESIGN, F110_CONTROL, throttle, amb);
    return { f, e: new MixedFlowTurbofan(F110_DESIGN, f.initialSpeed) };
  };

  it("slams idle → MIL through the acceleration schedule, then lights the afterburner only after the core is up", () => {
    const sl = at(0, 0);
    const { f, e } = make(0, sl);
    let r = run(f, e, 1, sl, 1);
    expect(r.out.activeLimits).toContain("acceleration");
    expect(r.s.afterburnerLit).toBe(false);
    r = run(f, e, 1, sl, 2);
    expect(r.s.spoolSpeed).toBeLessThan(0.99); // ≈3.5 s idle → MIL, not instant
    r = run(f, e, 1, sl, 3);
    expect(r.s.afterburnerLit).toBe(true);
    expect(r.s.netThrustN).toBeGreaterThan(0.98 * F16_ENGINE.maxAfterburnerThrustN.value);
  });

  it("holds the compressor-exit temperature limit at high Mach (model-based limiter)", () => {
    const hot = at(0, 1.2);
    const op = scheduleSteadyState(F110_DESIGN, F110_CONTROL, "primary", 1, hot);
    expect(op.limits).toContain("compressor-exit-temperature");
    const theta = (hot.temperatureK * (1 + 0.2 * 1.44)) / 288.15;
    expect(solveCycle(F110_DESIGN, hot, op.speed / Math.sqrt(theta), op.afterburner).compressorExitTemperatureK).toBeLessThanOrEqual(F110_CONTROL.maxCompressorExitTemperatureK! + 0.5);
  });

  it("raises idle at high altitude to keep burner pressure (minimum-pressure limiter)", () => {
    const high = at(20000, 0.4); // the generic map keeps burner pressure high, so only very high altitude binds
    const op = scheduleSteadyState(F110_DESIGN, F110_CONTROL, "primary", 0, high);
    expect(op.limits).toContain("min-burner-pressure");
    expect(op.speed).toBeGreaterThan(F110_CONTROL.idleSpeed);
  });

  it("SEC (backup) caps speed, slows acceleration and inhibits the afterburner", () => {
    const sl = at(0, 0);
    const { f, e } = make(0.5, sl);
    f.setMode("backup");
    const r = run(f, e, 1, sl, 10);
    expect(r.out.mode).toBe("backup");
    expect(r.s.afterburnerLit).toBe(false);
    expect(r.out.activeLimits).toContain("afterburner-inhibited");
    expect(r.s.spoolSpeed).toBeLessThanOrEqual(F110_CONTROL.backup.maxPhysicalSpeed + 1e-6);
    expect(r.s.netThrustN).toBeLessThan(F16_ENGINE.militaryThrustN.value);
    expect(r.s.netThrustN).toBeGreaterThan(0.75 * F16_ENGINE.militaryThrustN.value);
  });
});
