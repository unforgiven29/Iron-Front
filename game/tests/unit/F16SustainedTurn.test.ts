/**
 * F-16 sustained-turn validation against T.O. GR1F-16CJ-1-1 figure B8-48 "Turn Performance — Sea
 * Level" (F-16CJ Block 50, F110-GE-129, DATA BASIS FLIGHT TEST, standard day, GW 26,000 lb, drag
 * index 50). Ps = 0 boundary digitized by eye (±0.3 °/s), converted to load factor.
 * ASSUMPTION: drag index × 1e-4 = ΔCD0 on the 300 ft² reference (applied through the speedbrake
 * drag term). Uses the shared trimmed calculator with FADEC-scheduled thrust.
 */
import { describe, expect, it } from "vitest";
import { levelFlightPoint } from "../../src/platforms/aircraft/common/Performance.js";
import { createF16Definition } from "../../src/platforms/aircraft/f16c-block50/F16Definition.js";
import { F16_PERFORMANCE_OPTIONS as BASE } from "../../src/platforms/aircraft/f16c-block50/F16Performance.js";

const DRAG_INDEX = 50;
const OPTIONS = { ...BASE, devices: (a: number, q: number, p: number) => ({ ...BASE.devices!(a, q, p), speedbrake: ((DRAG_INDEX * 1e-4) / 0.075) * 60 }) };
/** [Mach, sustained load factor] read from fig. B8-48 (Ps = 0 line). */
const B8_48: readonly (readonly [number, number])[] = [[0.5, 5.27], [0.64, 7.01], [0.8, 9.0], [1.0, 7.03], [1.06, 5.74]];

function sustainedG(mach: number): number {
  const def = createF16Definition(), mass = 26000 * 0.45359237;
  const ok = (n: number) => { const p = levelFlightPoint(def, OPTIONS, 0, mach, mass * n); return p.trimmed && p.alphaDeg <= 25 && p.specificExcessPowerMps >= 0; };
  let lo = 1, hi = 14;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
  return lo;
}

describe("F-16 sustained turn vs T.O. GR1F-16CJ-1-1 fig. B8-48 (sea level, 26,000 lb, DI 50)", () => {
  it("is within 0.6 g of the flight-test Ps = 0 boundary, including the transonic collapse above M 0.95", () => {
    for (const [mach, g] of B8_48) expect(Math.abs(sustainedG(mach) - g), `M${mach}`).toBeLessThan(0.6);
    // Transonic: sustained g must fall sharply from M 0.9 to M 1.06, as on the chart.
    expect(sustainedG(0.9) - sustainedG(1.06)).toBeGreaterThan(3);
  }, 120_000);
});
