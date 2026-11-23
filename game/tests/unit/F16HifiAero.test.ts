import { describe, expect, it } from "vitest";
import { lookupND, validateTableND } from "../../src/physics/aerodynamics/Tables.js";
import { f16Aerodynamics } from "../../src/platforms/aircraft/f16c-block50/F16FlightModel.js";
import { f16HifiAerodynamics, LefSchedule } from "../../src/platforms/aircraft/f16c-block50/F16HifiAerodynamics.js";
import { HIFI } from "../../src/platforms/aircraft/f16c-block50/HifiAeroData.js";

const DEG = Math.PI / 180;
const base = { betaRad: 0, trueAirspeedMps: 153, dynamicPressurePa: 14_340, mach: 0.45, ratesRadps: [0, 0, 0] as const, cgFractionMac: 0.35 };
const surf = (el: number, ail = 0, rud = 0) => ({ elevatorDeg: el, aileronDeg: ail, rudderDeg: rud });

describe("high-fidelity F-16 tables", () => {
  it("all 43 tables are well-formed and sized to their axes", () => {
    for (const [name, t] of Object.entries(HIFI)) validateTableND(t, name);
    expect(Object.keys(HIFI)).toHaveLength(43);
  });

  it("N-D lookup reproduces grid points exactly and interpolates between them", () => {
    const t = HIFI.Cz;
    const at = (ia: number, ib: number, ie: number) => t.values[ia + 20 * (ib + 19 * ie)] as number;
    expect(lookupND(t, [10, -4, 0]).value).toBe(at(6, 7, 2));
    expect(lookupND(t, [12.5, -4, 0]).value).toBeCloseTo((at(6, 7, 2) + at(7, 7, 2)) / 2, 12);
    expect(lookupND(t, [95, 0, 0]).clamped).toBe(true);
  });

  it("agrees with the reduced (Stevens & Lewis) tables near trim, as both come from NASA TP-1538", () => {
    for (const [alpha, el] of [[2, -1], [5, -3], [10, -6]] as const) {
      const lo = f16Aerodynamics({ ...base, alphaRad: alpha * DEG, surfaces: surf(el) }).coefficients;
      // The reduced set has no LEF; compare with the LEF fully retracted.
      const hi = f16HifiAerodynamics({ ...base, alphaRad: alpha * DEG, surfaces: surf(el), lefDeg: 0 }).coefficients;
      expect(Math.abs(hi.cz - lo.cz)).toBeLessThan(0.08);
      expect(Math.abs(hi.cm - lo.cm)).toBeLessThan(0.03);
    }
  });

  it("covers high alpha that the reduced set clamps, and rolls/yaws the right way", () => {
    // Main tables reach 90°; the reduced set stops at 45°. (LEF increment tables stop at 45° and are flagged above.)
    expect(lookupND(HIFI.Cx, [60, 0, 0]).clamped).toBe(false);
    expect(f16Aerodynamics({ ...base, alphaRad: 60 * DEG, surfaces: surf(0) }).outsideEnvelope).toBe(true);
    const roll = (ail: number) => f16HifiAerodynamics({ ...base, alphaRad: 4 * DEG, surfaces: surf(0, ail), lefDeg: 5 }).coefficients.cl;
    expect(roll(-20)).toBeGreaterThan(roll(0)); // negative aileron rolls right (source convention)
    const yaw = (rud: number) => f16HifiAerodynamics({ ...base, alphaRad: 4 * DEG, surfaces: surf(0, 0, rud), lefDeg: 5 }).coefficients.cn;
    expect(yaw(-30)).toBeGreaterThan(yaw(0)); // negative rudder yaws nose right
  });

  it("LEF schedule deploys with alpha, retracts with dynamic pressure, stays within 0..25° and is rate limited", () => {
    const lef = new LefSchedule();
    lef.step(2 * DEG, 30_000, 70_000, 1 / 120);
    const cruise = lef.positionDeg;
    for (let i = 0; i < 600; i++) lef.step(20 * DEG, 5_000, 70_000, 1 / 120);
    expect(lef.positionDeg).toBeGreaterThan(cruise);
    expect(lef.positionDeg).toBeLessThanOrEqual(25);
    const before = lef.positionDeg;
    lef.step(-10 * DEG, 60_000, 70_000, 0.1);
    expect(before - lef.positionDeg).toBeLessThanOrEqual(LefSchedule.rateLimitDegS * 0.1 + 1e-9);
    expect(lef.positionDeg).toBeGreaterThanOrEqual(0);
  });
});
