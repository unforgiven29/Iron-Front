import { describe, expect, it } from "vitest";
import { standardAtmosphere } from "../../src/physics/environment/Atmosphere.js";
import { inletRecovery, MixedFlowTurbofan, solveCycle } from "../../src/physics/propulsion/MixedFlowTurbofan.js";
import { F16_ENGINE } from "../../src/platforms/aircraft/f16c-block50/F16Data.js";
import { F110_DESIGN } from "../../src/platforms/aircraft/f16c-block50/F16FlightModel.js";

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
    const idle = steady(0, 0, 0, F110_DESIGN.idleCorrectedSpeed).netThrustN;
    expect(idle).toBeGreaterThan(0.02 * F16_ENGINE.maxAfterburnerThrustN.value);
    expect(idle).toBeLessThan(0.12 * F16_ENGINE.maxAfterburnerThrustN.value);
  });

  it("spools with lag, lights the afterburner only after a delay at full RPM, and flames out without fuel", () => {
    const e = new MixedFlowTurbofan(F110_DESIGN, 0.77, 0);
    const sl = at(0, 0);
    let s = e.step(1, sl, true, 0.1);
    expect(s.spoolSpeed).toBeLessThan(0.8);
    expect(s.afterburnerLit).toBe(false);
    for (let i = 0; i < 100; i++) s = e.step(1, sl, true, 0.1);
    expect(s.afterburnerLit).toBe(true);
    expect(s.netThrustN).toBeGreaterThan(0.95 * F16_ENGINE.maxAfterburnerThrustN.value);
    s = e.step(1, sl, false, 0.1);
    expect(s).toMatchObject({ flameout: true, netThrustN: 0, fuelFlowKgS: 0 });
  });
});
