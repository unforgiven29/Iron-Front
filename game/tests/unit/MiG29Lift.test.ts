/**
 * MiG-29 lift validation against GAF T.O. 1F-MIG29-1 figure A8-13 "Maximum available AoA"
 * (MiG-29G, clean, CG 25.5 % MAC). Weight is not printed on the figure: 13,000 kg is ASSUMED (the
 * weight of the appendix turn charts). Values read by eye (±0.3°, ±0.02 M).
 *  - Low-speed boundary: 9 g is reached at the 26° AoA limit at M 0.54 (SL), 0.64 (9,840 ft), 0.74 (16,400 ft).
 *  - Transonic/supersonic: AoA required for the 7 g limit.
 */
import { describe, expect, it } from "vitest";
import { standardAtmosphere } from "../../src/physics/environment/Atmosphere.js";
import { levelFlightPoint } from "../../src/platforms/aircraft/common/Performance.js";
import { createMiG29Definition, MIG29_PERFORMANCE_OPTIONS as O } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";

const FT = 0.3048, MASS = 13000, DEG = Math.PI / 180;
const SEVEN_G: readonly (readonly [number, number, number])[] = [[0, 0.965, 3.4], [9840, 0.99, 4.3], [16400, 0.99, 5.7], [0, 1.15, 3.3], [9840, 1.18, 4.75], [16400, 1.19, 6.0], [16400, 1.69, 5.0]];
const NINE_G_AT_26: readonly (readonly [number, number])[] = [[0, 0.54], [9840, 0.64], [16400, 0.74]];

/** Load factor available at 26° AoA with LEF extended (lift + thrust component). */
function nAt26(ft: number, mach: number): number {
  const def = createMiG29Definition(), atm = standardAtmosphere(ft * FT), V = mach * atm.speedOfSoundMps, a = 26 * DEG;
  const o = def.createSystems().aero.compute({ alphaRad: a, betaRad: 0, trueAirspeedMps: V, dynamicPressurePa: 0.5 * atm.densityKgM3 * V * V, mach, ratesRadps: [0, 0, 0], surfaces: { lef: 20 }, cgFractionMac: def.mass.cgFractionMac });
  const lift = -o.forceBodyN[2] * Math.cos(a) + o.forceBodyN[0] * Math.sin(a);
  return (lift + levelFlightPoint(def, O, ft * FT, mach, MASS).thrustN * Math.sin(a)) / (MASS * 9.80665);
}

describe("MiG-29 lift vs GAF T.O. 1F-MIG29-1 fig. A8-13", () => {
  it("reaches 9 g at the 26° AoA limit at the published Mach numbers (±0.35 g)", () => {
    for (const [ft, m] of NINE_G_AT_26) expect(Math.abs(nAt26(ft, m) - 9), `${ft} ft M${m}`).toBeLessThan(0.35);
  });
  it("needs the published AoA for 7 g transonic and supersonic (±0.4°)", () => {
    const def = createMiG29Definition();
    for (const [ft, m, alpha] of SEVEN_G) expect(Math.abs(levelFlightPoint(def, O, ft * FT, m, MASS * 7).alphaDeg - alpha), `${ft} ft M${m}`).toBeLessThan(0.4);
  });
});
