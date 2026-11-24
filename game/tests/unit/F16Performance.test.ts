import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { normalShockRecovery } from "../../src/physics/propulsion/MixedFlowTurbofan.js";
import { bestClimbRate, maxLevelMach } from "../../src/platforms/aircraft/common/Performance.js";
import { createF16Aircraft, F16_SWITCHES } from "../../src/platforms/aircraft/f16c-block50/F16Aircraft.js";
import { applyCompressibility, compressibilityFactors, LOW_SPEED_REFERENCE, TP3355_F16C } from "../../src/platforms/aircraft/f16c-block50/F16Compressibility.js";
import { F16_MASS } from "../../src/platforms/aircraft/f16c-block50/F16Data.js";
import { createF16Definition } from "../../src/platforms/aircraft/f16c-block50/F16Definition.js";
import { F16_PERFORMANCE_OPTIONS } from "../../src/platforms/aircraft/f16c-block50/F16Performance.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const FT = 0.3048;
const DEG = Math.PI / 180;
const MID_FUEL_KG = F16_MASS.emptyMassKg.value + 3175 / 2;

describe("F-16 compressibility (NASA TP-3355 supersonic data)", () => {
  it("reproduces the measured F-16C minimum drag and lift-curve slope at M 1.6–2.16", () => {
    for (const pt of TP3355_F16C.cdMin) {
      expect(LOW_SPEED_REFERENCE.cdMin + compressibilityFactors(pt.m).deltaCdMin).toBeCloseTo(pt.v, 6);
    }
    for (const pt of TP3355_F16C.clAlphaPerDeg) {
      expect(LOW_SPEED_REFERENCE.clAlphaPerDeg * compressibilityFactors(pt.m).liftScale).toBeCloseTo(pt.v, 6);
    }
  });

  it("moves the aerodynamic centre aft supersonic: relaxed-stable subsonic, strongly stable at M 1.6", () => {
    expect(LOW_SPEED_REFERENCE.dCmdCL).toBeGreaterThan(0); // relaxed static stability at 0.35c
    const cm = (alphaDeg: number, mach: number) => {
      const a = alphaDeg * DEG;
      const base = { cx: 0, cz: -(0.1 + 0.0653 * alphaDeg) * Math.cos(a), cm: LOW_SPEED_REFERENCE.dCmdCL * 0.0653 * alphaDeg };
      return applyCompressibility(base, a, mach).cm;
    };
    expect(cm(4, 1.6) - cm(0, 1.6)).toBeLessThan(0);
    expect(compressibilityFactors(0.2).basis).toBe("low-speed");
    expect(compressibilityFactors(1.0).basis).toBe("estimated");
    expect(compressibilityFactors(2.0).basis).toBe("measured");
  });

  it("uses exact normal-shock recovery for the F-16's fixed pitot inlet", () => {
    expect(normalShockRecovery(0.9)).toBe(1);
    expect(normalShockRecovery(2.0)).toBeCloseTo(0.7209, 4);
    expect(normalShockRecovery(1.5)).toBeCloseTo(0.9298, 4);
  });
});

describe("F-16 performance vs published figures (steady-state, mid fuel, clean)", () => {
  const def = createF16Definition();
  it("maximum level speed: ≈M1.2 at sea level and ≈M1.89 (max sustained) at 40,000 ft", () => {
    const sl = maxLevelMach(def, F16_PERFORMANCE_OPTIONS, 0, MID_FUEL_KG);
    const h40 = maxLevelMach(def, F16_PERFORMANCE_OPTIONS, 40000 * FT, MID_FUEL_KG);
    expect(sl).toBeGreaterThan(1.1);
    expect(sl).toBeLessThan(1.32);
    expect(h40).toBeGreaterThan(1.8);
    expect(h40).toBeLessThan(2.06);
  });

  it("cannot run away: no level speed above Mach 2.1 anywhere in the envelope", () => {
    for (const ft of [0, 20000, 36000, 45000]) expect(maxLevelMach(def, F16_PERFORMANCE_OPTIONS, ft * FT, MID_FUEL_KG)).toBeLessThan(2.1);
  });

  it("service ceiling is above 50,000 ft (USAF fact sheet: 'above 50,000 feet')", () => {
    expect(bestClimbRate(def, F16_PERFORMANCE_OPTIONS, 50000 * FT, MID_FUEL_KG).mps).toBeGreaterThan(0.508);
  });
});

describe("F-16 weight, speedbrake and FLCS behaviour", () => {
  const terrain = new TerrainSurface();
  terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "test/t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 200, featureSizeM: 20000 }));
  const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
  const jet = (speed = 200) => createF16Aircraft(terrain, env, { positionEnuM: [0, 0, 4000], headingRad: 0, speedMps: speed, throttle: 0.6 });
  const fly = (a: ReturnType<typeof jet>, s: number) => { for (let i = 0; i < Math.round(s * 120); i++) a.stepTick(); return a.snapshot(); };

  it("weighs empty mass + fuel and gets lighter as fuel burns", () => {
    const a = jet();
    expect(a.snapshot().massKg).toBeCloseTo(F16_MASS.emptyMassKg.value + 3175, 3);
    a.setThrottle(1);
    const s = fly(a, 10);
    expect(s.massKg).toBeCloseTo(F16_MASS.emptyMassKg.value + s.fuelKg, 6);
    expect(s.massKg).toBeLessThan(F16_MASS.emptyMassKg.value + 3175);
  });

  it("speedbrake extends at a finite rate and adds drag", () => {
    const run = (sb: boolean) => {
      const a = jet(220);
      if (sb) a.controls.request(F16_SWITCHES.speedbrake, "EXTEND", "test");
      a.setThrottle(0.3);
      const s0 = fly(a, 0.5);
      const s = fly(a, 6);
      return { half: s0.surfaces["speedbrake"] ?? 0, v: s.trueAirspeedMps, full: s.surfaces["speedbrake"] ?? 0 };
    };
    const out = run(true), clean = run(false);
    expect(out.half).toBeGreaterThan(0);
    expect(out.half).toBeLessThan(60);
    expect(out.full).toBe(60);
    expect(out.v).toBeLessThan(clean.v - 5);
  });

  it("AoA/g limiter holds full aft stick under the AoA limit and settles without porpoising", () => {
    for (const speed of [160, 220]) {
      const a = jet(speed);
      a.setThrottle(0.8);
      a.setPilotInputs({ pitch: 1, roll: 0, yaw: 0 });
      let maxAlpha = 0, lo = 99, hi = -99;
      for (let i = 1; i <= 720; i++) {
        a.stepTick();
        const al = a.snapshot().alphaRad / DEG;
        maxAlpha = Math.max(maxAlpha, al);
        if (i > 360) { lo = Math.min(lo, al); hi = Math.max(hi, al); }
      }
      expect(maxAlpha).toBeLessThan(25.5);
      expect(hi - lo).toBeLessThan(2);
    }
  });

  it("ARI keeps a loaded roll coordinated (small sideslip)", () => {
    const b = jet(200);
    fly(b, 1);
    b.setPilotInputs({ pitch: 0.3, roll: 1, yaw: 0 });
    let maxBeta = 0;
    for (let i = 0; i < 240; i++) { b.stepTick(); maxBeta = Math.max(maxBeta, Math.abs(b.snapshot().betaRad / DEG)); }
    expect(maxBeta).toBeLessThan(5);
  });
});
