import { describe, expect, it } from "vitest";
import { solveCycle } from "../../src/physics/propulsion/MixedFlowTurbofan.js";
import { F110_DESIGN } from "../../src/platforms/aircraft/f16c-block50/F110Engine.js";
import { F110_FLIGHT_POINTS, F110_GROUND_AMBIENT_PSIA, F110_GROUND_RUN, type DeckRow } from "../../src/platforms/aircraft/f16c-block50/F110DeckData.js";
import { F16_ENGINE } from "../../src/platforms/aircraft/f16c-block50/F16Data.js";

const PSI = 6894.757, LB = 0.45359237, LBF = 4.4482216152605;

/**
 * Run our engine at a TM-104326 point: the published engine-face pressure is imposed through the
 * inlet recovery, the core speed is the published N2, and installation losses are removed (the
 * deck Fg is the engine's own gross thrust).
 */
function ours(row: DeckRow, mach: number, tAmbR: number, pAmbPsi: number) {
  const [, t1, p1, pt25, ps3, wfe, n1, , , , p8, , fg, w8] = row;
  void n1;
  const amb = { temperatureK: tAmbR / 1.8, pressurePa: pAmbPsi * PSI, mach };
  const pt0 = amb.pressurePa * (1 + 0.2 * mach * mach) ** 3.5;
  const design = { ...F110_DESIGN, installationLossFraction: 0, inlet: { kind: "test", recovery: () => (p1 * PSI) / pt0 } };
  const theta = (t1 / 1.8) / 288.15;
  const c = solveCycle(design, amb, n1 / 8241 / Math.sqrt(theta), 0);
  return { c, deck: { fg: fg * LBF, w8: w8 === null ? null : w8 * LB, wfe: (wfe * LB) / 3600, p8: p8 * PSI, pt25: pt25 * PSI, ps3: ps3 * PSI } };
}

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("F110-GE-129 against the GE engine deck (NASA TM-104326)", () => {
  it("reproduces the ground run it was built from (consistency check of tables + nozzle)", () => {
    for (const r of F110_GROUND_RUN.slice(2)) {
      const { c, deck } = ours(r, 0, 517.6, F110_GROUND_AMBIENT_PSIA);
      expect(rel(c.grossThrustN, deck.fg)).toBeLessThan(0.03);
      expect(rel(c.fuelFlowKgS, deck.wfe)).toBeLessThan(0.01);
    }
  });

  it("predicts the 19 HELD-OUT flight points (Mach 0.3–0.96, 3,500–12,000 ft, part power to MIL)", () => {
    const err = { fg: [] as number[], w8: [] as number[], wf: [] as number[], ps3: [] as number[] };
    for (const [, mach, tAmb, pAmb, row] of F110_FLIGHT_POINTS) {
      const { c, deck } = ours(row, mach, tAmb, pAmb);
      err.fg.push(rel(c.grossThrustN, deck.fg));
      if (deck.w8 !== null) err.w8.push(rel(c.airflowKgS + c.fuelFlowKgS, deck.w8));
      err.wf.push(rel(c.fuelFlowKgS, deck.wfe));
      err.ps3.push(rel(c.compressorExitPressurePa, deck.ps3));
    }
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    // Gross thrust: mean within 2.5 %, worst within 6 % (worst is "D end", whose ambient temperature is anomalous).
    expect(mean(err.fg)).toBeLessThan(0.025);
    expect(Math.max(...err.fg)).toBeLessThan(0.06);
    expect(Math.max(...err.w8)).toBeLessThan(0.04);
    expect(Math.max(...err.wf)).toBeLessThan(0.06);
    expect(Math.max(...err.ps3)).toBeLessThan(0.09);
  });

  it("gives the published uninstalled sea-level-static intermediate thrust (≈17,000 lbf) without being tuned to it", () => {
    const sls = solveCycle({ ...F110_DESIGN, installationLossFraction: 0, inlet: { kind: "bellmouth", recovery: () => 1 } }, { temperatureK: 288.15, pressurePa: 101325, mach: 0 }, 1.006, 0);
    expect(sls.netThrustN / LBF).toBeGreaterThan(16_000);
    expect(sls.netThrustN / LBF).toBeLessThan(18_200);
    expect(F16_ENGINE.militaryThrustN.value / LBF).toBe(17_000);
  });
});
