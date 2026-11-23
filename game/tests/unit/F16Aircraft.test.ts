import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { F16Aircraft, type F16Snapshot } from "../../src/platforms/aircraft/f16c-block50/F16Aircraft.js";
import { F16_FLCS_LIMITS } from "../../src/platforms/aircraft/f16c-block50/F16Data.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const D = 180 / Math.PI;
function jet(speedMps = 200, altitude = 3000) {
  const t = new TerrainSurface();
  t.addTile(generateSyntheticTile({ seed: 1, tileId: "test/flat-ish", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 300, featureSizeM: 20000 }));
  return new F16Aircraft(t, { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("calm", [0, 0, 0]) }, { positionEnuM: [0, 0, altitude], headingRad: 0, speedMps, throttle: 0.5 });
}
function fly(a: F16Aircraft, seconds: number, each?: (s: F16Snapshot) => void): F16Snapshot {
  for (let i = 0; i < Math.round(seconds * 120); i++) { a.stepTick(); each?.(a.snapshot()); }
  return a.snapshot();
}

describe("F-16C Block 50 vertical slice (provisional data, project-designed FLCS)", () => {
  it("holds 1 g hands-off without diverging or faulting", () => {
    const s = fly(jet(), 10);
    expect(s.faults).toEqual([]);
    expect(Math.abs(s.nzG - 1)).toBeLessThan(0.1);
    expect(Math.abs(s.ratesRadps[1] * D)).toBeLessThan(1);
    expect(Math.abs(s.rollRad * D)).toBeLessThan(1);
    expect(s.ground.kind).toBe("airborne");
  });

  it("tracks a g command without sustained oscillation", () => {
    const a = jet();
    a.setPilotInputs({ pitch: 0.5, roll: 0, yaw: 0 }); // ≈ 5 g
    let peak = 0;
    fly(a, 3, (s) => { peak = Math.max(peak, s.nzG); });
    expect(peak).toBeGreaterThan(4.5);
    expect(peak).toBeLessThan(6.5);
  });

  it("limits angle of attack and g on full aft stick (no departure)", () => {
    const a = jet();
    a.setThrottle(0.3);
    a.setPilotInputs({ pitch: 1, roll: 0, yaw: 0 });
    let maxAlpha = 0, maxG = 0;
    fly(a, 15, (s) => { maxAlpha = Math.max(maxAlpha, s.alphaRad * D); maxG = Math.max(maxG, s.nzG); });
    expect(maxAlpha).toBeLessThan(F16_FLCS_LIMITS.alphaLimitDeg.value + 2);
    expect(maxG).toBeLessThan(F16_FLCS_LIMITS.maxPositiveG.value + 0.5);
  });

  it("rolls right on right stick and stops rolling when released", () => {
    const a = jet();
    a.setPilotInputs({ pitch: 0, roll: 1, yaw: 0 });
    let peakP = 0;
    const rolled = fly(a, 0.5, (s) => { peakP = Math.max(peakP, s.ratesRadps[0] * D); });
    expect(rolled.rollRad).toBeGreaterThan(0.3);
    expect(peakP).toBeGreaterThan(100);
    a.setPilotInputs({ pitch: 0, roll: 0, yaw: 0 });
    const held = fly(a, 2);
    expect(Math.abs(held.ratesRadps[0] * D)).toBeLessThan(5);
  });

  it("yaws right on right pedal", () => {
    const a = jet();
    a.setPilotInputs({ pitch: 0, roll: 0, yaw: 1 });
    const s = fly(a, 1);
    expect(s.headingRad).toBeGreaterThan(0.005);
  });

  it("is deterministic for any frame cadence", () => {
    const run = (dt: number, frames: number) => {
      const a = jet();
      a.setPilotInputs({ pitch: 0.3, roll: -0.4, yaw: 0.1 });
      a.setThrottle(0.9);
      for (let i = 0; i < frames; i++) a.advanceFrame(dt);
      return a.snapshot();
    };
    expect(run(1 / 30, 150)).toEqual(run(1 / 144, 720));
  });

  it("flags flight outside the low-speed aero dataset", () => {
    const a = jet(260, 200); // Mach ≈ 0.77
    const s = fly(a, 0.1);
    expect(s.outsideAeroEnvelope).toBe(true);
  });
});
