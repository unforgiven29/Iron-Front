import { describe, expect, it } from "vitest";
import { LaggedFlowState } from "../../src/physics/aerodynamics/UnsteadyFlow.js";
import { createF16Definition } from "../../src/platforms/aircraft/f16c-block50/F16Definition.js";
import { createMiG29Definition } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";
import { mig29Intake } from "../../src/platforms/aircraft/mig29/MiG29Intake.js";

const D = Math.PI / 180;
const staticX = (a: number) => Math.max(0, Math.min(1, 1 - (a / D - 15) / 20));

describe("Goman–Khrabrov flow-attachment state", () => {
  it("equals the static curve when quasi-steady or held; lags (overshoots) in a fast pull and on the way back (hysteresis)", () => {
    const s = new LaggedFlowState({ tau1Chords: 12, tau2Chords: 4 });
    expect(s.step(25 * D, staticX, 3.45, 100)).toBeCloseTo(staticX(25 * D), 12);
    // Hold at 10°, then pull to 30° in 0.5 s at 100 m/s.
    for (let i = 0; i < 400; i++) s.step(10 * D, staticX, 3.45, 100, 0.01);
    let a = 10 * D;
    for (let i = 0; i < 50; i++) { a += (20 * D) / 50; s.step(a, staticX, 3.45, 100, 0.01); }
    expect(s.value!).toBeGreaterThan(staticX(30 * D) + 0.2); // still more attached than static
    for (let i = 0; i < 400; i++) s.step(30 * D, staticX, 3.45, 100, 0.01);
    expect(s.value!).toBeCloseTo(staticX(30 * D), 3);
    // Fast return to 18°: reattachment lags (less attached than static).
    for (let i = 0; i < 30; i++) { a -= (12 * D) / 30; s.step(a, staticX, 3.45, 100, 0.01); }
    expect(s.value!).toBeLessThan(staticX(18 * D) - 0.1);
  });
});

const input = (alphaDeg: number, extra: Record<string, unknown> = {}) => ({ alphaRad: alphaDeg * D, betaRad: 0, trueAirspeedMps: 120, dynamicPressurePa: 8800, mach: 0.35, ratesRadps: [0, 0, 0] as const, surfaces: { lef: 20 }, cgFractionMac: 0.255, ...extra });
const lift = (o: { forceBodyN: readonly number[] }, a: number) => -o.forceBodyN[2]! * Math.cos(a * D) + o.forceBodyN[0]! * Math.sin(a * D);

for (const [name, make] of [["MiG-29", () => createMiG29Definition()], ["F-16", () => createF16Definition()]] as const) {
  describe(`${name} unsteady aerodynamics`, () => {
    it("reproduces the static (validated) data in steady flight and over-shoots lift in a fast pull past the stall", () => {
      const aero = make().createSystems().aero;
      const steady = lift(aero.compute(input(32)), 32);
      for (let i = 0; i < 300; i++) aero.compute(input(10, { stepSeconds: 0.01 }));
      let o = aero.compute(input(10, { stepSeconds: 0.01 }));
      for (let i = 1; i <= 30; i++) o = aero.compute(input(10 + (22 * i) / 30, { stepSeconds: 0.01 }));
      expect(lift(o, 32)).toBeGreaterThan(steady * 1.03);
      for (let i = 0; i < 600; i++) o = aero.compute(input(32, { stepSeconds: 0.01 }));
      expect(lift(o, 32)).toBeCloseTo(steady, 0);
    });

    it("reports buffet in separated flow and none in cruise", () => {
      const aero = make().createSystems().aero;
      expect(aero.compute(input(3)).buffet ?? 0).toBe(0);
      expect(aero.compute(input(35)).buffet ?? 0).toBeGreaterThan(0.3);
    });

    it("ground effect adds a nose-down pitching moment", () => {
      const aero = make().createSystems().aero;
      const cm = (h?: number) => aero.compute(input(8, h === undefined ? {} : { heightAboveGroundM: h })).momentBodyNm[1];
      expect(cm(2)).toBeLessThan(cm());
    });
  });
}

describe("MiG-29 intake (GAF T.O. 1F-MIG29-1)", () => {
  it("breathes through the louvers (lower recovery) on the ground below 108 KIAS; ramps open above, and in flight", () => {
    const i = mig29Intake(), kt = 0.514444;
    expect(i.recovery(0.1, { weightOnWheels: true, equivalentAirspeedMps: 60 * kt })).toBeLessThan(0.97);
    expect(i.recovery(0.2, { weightOnWheels: true, equivalentAirspeedMps: 130 * kt })).toBe(1);
    expect(i.recovery(0.15, { weightOnWheels: false, equivalentAirspeedMps: 90 * kt })).toBe(1);
    expect(i.recovery(2.0)).toBeLessThan(0.95);
  });
});
