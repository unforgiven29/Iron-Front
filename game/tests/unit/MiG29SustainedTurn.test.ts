/**
 * Sustained-turn validation of the MiG-29 against GAF T.O. 1F-MIG29-1 figure A8-3 (MiG-29G, max AB
 * NPM, clean, 13,000 kg). Uses the SAME trimmed steady-state calculator and FADEC-scheduled engine
 * thrust as the rest of the project (common/Performance.ts): the sustained load factor is the
 * largest n for which the jet trims at n·W with specific excess power ≥ 0 and AoA ≤ 26°.
 * Points digitized by eye (±0.2 g); structural-limit plateaus excluded.
 */
import { describe, expect, it } from "vitest";
import { standardAtmosphere } from "../../src/physics/environment/Atmosphere.js";
import { levelFlightPoint } from "../../src/platforms/aircraft/common/Performance.js";
import { createMiG29Definition, MIG29_PERFORMANCE_OPTIONS } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";

const FT = 0.3048, KT = 0.514444;
const casToMach = (cas: number, p: number) => { const qc = 101325 * ((1 + 0.2 * (cas / 340.294) ** 2) ** 3.5 - 1); return Math.sqrt(5 * ((qc / p + 1) ** (1 / 3.5) - 1)); };

export const GAF_A8_3: readonly (readonly [number, number, number])[] = [[0,250,4.2],[0,300,5.4],[0,350,6.6],[0,400,7.8],[9843,500,8.2],[16404,300,4.4],[16404,350,5.5],[16404,460,6.5],[16404,550,5.0],[26247,300,3.8],[26247,375,4.5],[26247,450,3.6],[26247,600,4.0],[36089,320,2.9],[36089,400,2.4],[36089,500,2.9],[36089,650,3.6]];

export function sustainedG(altFt: number, kias: number, def = createMiG29Definition()): number {
  const atm = standardAtmosphere(altFt * FT), M = casToMach(kias * KT, atm.pressurePa);
  const ok = (n: number) => { const p = levelFlightPoint(def, MIG29_PERFORMANCE_OPTIONS, altFt * FT, M, 13000 * n); return p.trimmed && p.alphaDeg <= 26 && p.specificExcessPowerMps >= 0; };
  if (!ok(1)) return 1;
  let lo = 1, hi = 12;
  for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
  return lo;
}

describe("MiG-29 sustained turn vs GAF T.O. 1F-MIG29-1 fig. A8-3 (max AB, clean, 13,000 kg)", () => {
  it("matches the digitized chart within 0.3 g RMS and 0.6 g at every point", () => {
    const def = createMiG29Definition();
    let sq = 0;
    for (const [alt, kias, g] of GAF_A8_3) {
      const err = sustainedG(alt, kias, def) - g;
      expect(Math.abs(err), `${alt} ft ${kias} KIAS`).toBeLessThan(0.6);
      sq += err * err;
    }
    expect(Math.sqrt(sq / GAF_A8_3.length)).toBeLessThan(0.3);
  }, 120_000);
});
