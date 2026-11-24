/**
 * Quasi-static sustained-turn check: max-AB thrust (two RD-33 on the shared cycle) balances drag at
 * the angle of attack giving the most load factor. Points digitized by eye from GAF T.O. 1F-MIG29-1
 * figure A8-3 (MiG-29G; ±0.2 g reading uncertainty; structural-limit plateaus excluded).
 */
import { describe, expect, it } from "vitest";
import { standardAtmosphere } from "../../src/physics/environment/Atmosphere.js";
import { MixedFlowTurbofan } from "../../src/physics/propulsion/MixedFlowTurbofan.js";
import { mig29Aerodynamics } from "../../src/platforms/aircraft/mig29/MiG29Aerodynamics.js";
import { RD33_DESIGN } from "../../src/platforms/aircraft/mig29/MiG29Engines.js";
const D = Math.PI / 180, FT = 0.3048, KT = 0.514444;
function casToMach(cas: number, p: number) { const a0 = 340.294, p0 = 101325; const qc = p0 * ((1 + 0.2 * (cas / a0) ** 2) ** 3.5 - 1); return Math.sqrt(5 * ((qc / p + 1) ** (1 / 3.5) - 1)); }
function thrust(h: number, M: number) { const atm = standardAtmosphere(h); const e = new MixedFlowTurbofan(RD33_DESIGN, 1); let t = 0; for (let i = 0; i < 2000; i++) t = e.step({ speed: 1, afterburner: 1 }, { temperatureK: atm.temperatureK, pressurePa: atm.pressurePa, mach: M }, true, 0.01).netThrustN; return 2 * t; }
const PTS: [number, number, number][] = [[0,250,4.2],[0,300,5.4],[0,350,6.6],[0,400,7.8],[9843,500,8.2],[16404,300,4.4],[16404,350,5.5],[16404,460,6.5],[16404,550,5.0],[26247,300,3.8],[26247,375,4.5],[26247,450,3.6],[26247,600,4.0],[36089,320,2.9],[36089,400,2.4],[36089,500,2.9],[36089,650,3.6]];
const TC = new Map<string, number>();
function sustained(altFt: number, kias: number) {
  const aero = mig29Aerodynamics(), W = 13000 * 9.80665;
  const h = altFt * FT, atm = standardAtmosphere(h);
  const M = casToMach(kias * KT, atm.pressurePa), V = M * atm.speedOfSoundMps, q = 0.5 * atm.densityKgM3 * V * V;
  const k = `${altFt},${kias}`; if (!TC.has(k)) TC.set(k, thrust(h, M)); const T = TC.get(k)!;
  let best = 0;
  for (let a = 0; a <= 26; a += 0.1) {
    const o = aero.compute({ alphaRad: a * D, betaRad: 0, trueAirspeedMps: V, dynamicPressurePa: q, mach: M, ratesRadps: [0, 0, 0], surfaces: { lef: a > 8.7 && M < 0.8 ? 20 : 0 }, heightAboveGroundM: 1e4, cgFractionMac: 0.25 });
    const lift = -o.forceBodyN[2] * Math.cos(a * D) + o.forceBodyN[0] * Math.sin(a * D), drag = -o.forceBodyN[0] * Math.cos(a * D) - o.forceBodyN[2] * Math.sin(a * D);
    if (T * Math.cos(a * D) >= drag) best = (lift + T * Math.sin(a * D)) / W; else break;
  }
  return best;
}
describe("MiG-29 sustained turn vs GAF T.O. 1F-MIG29-1 fig. A8-3 (max AB, clean, 13,000 kg)", () => {
  it("matches the digitized chart within 0.4 g RMS and 0.8 g at every point", () => {
    let sq = 0;
    for (const [alt, kias, g] of PTS) {
      const err = sustained(alt, kias) - g;
      expect(Math.abs(err), `${alt} ft ${kias} KIAS`).toBeLessThan(0.8);
      sq += err * err;
    }
    expect(Math.sqrt(sq / PTS.length)).toBeLessThan(0.4);
  });
});
