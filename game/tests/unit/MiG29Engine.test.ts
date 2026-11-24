/** RD-33 behaviour against GAF T.O. 1F-MIG29-1 (pp. 1-6, 1-27, 1-36). */
import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { solveCycle } from "../../src/physics/propulsion/MixedFlowTurbofan.js";
import { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { createMiG29Definition } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";
import { RD33_DESIGN, RD33_LPM_DESIGN } from "../../src/platforms/aircraft/mig29/MiG29Engines.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const KP = 9.80665;
const SLS = { temperatureK: 288.15, pressurePa: 101325, mach: 0 };
const terrain = new TerrainSurface();
terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 0, featureSizeM: 20000 }));
const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };

describe("RD-33 (GAF T.O. 1F-MIG29-1)", () => {
  it("ground idle is the published ≈66 % NH (fig. 1-4) and gives the published 180 kp, with the nozzle fully open as at IDLE", () => {
    const idle = createMiG29Definition().engines[0]!.control.idleSpeed;
    expect(idle).toBeCloseTo(0.663, 3);
    expect(solveCycle({ ...RD33_DESIGN, installationLossFraction: 0 }, SLS, idle, 0, { throat: { kind: "auto", minPosition: 1 } }).netThrustN / KP).toBeCloseTo(180, -1.5);
  });

  it("variable C-D nozzle: fully open at IDLE, closing toward MIL, opening for afterburner; exhaust expands fully when choked", () => {
    const d = { ...RD33_DESIGN, installationLossFraction: 0 };
    const mil = solveCycle(d, SLS, 1, 0), ab = solveCycle(d, SLS, 1, 1);
    expect(ab.nozzle.throatAreaM2).toBeGreaterThan(mil.nozzle.throatAreaM2 * 1.3);
    expect(mil.nozzle.exitAreaM2).toBeGreaterThan(mil.nozzle.throatAreaM2);
    expect(Math.abs(mil.nozzle.exitPressurePa - 101325) / 101325).toBeLessThan(0.15);
    expect(createMiG29Definition().engines[0]!.control.dryNozzleMinPosition).toBeDefined();
    expect(mil.exhaustGasTemperatureK).toBeGreaterThan(600);
  });

  it("limited power mode gives the published LPM ratings (4,680 kp MIL / 7,520 kp max AB)", () => {
    const d = { ...RD33_LPM_DESIGN, installationLossFraction: 0 };
    expect(solveCycle(d, SLS, 1, 0).netThrustN / KP).toBeCloseTo(4680, -1.5);
    expect(solveCycle(d, SLS, 1, 1).netThrustN / KP).toBeCloseTo(7520, -1.5);
    expect(createMiG29Definition({ engineMode: "LPM" }).engines[0]!.design).toBe(RD33_LPM_DESIGN);
  });

  it("in flight: IDLE → MAX AB in 3–7 s; afterburner lights 2–3 s after the core passes the 72–76 % gate", () => {
    const a = new FixedWingAircraft(createMiG29Definition(), terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 200, throttle: 0 });
    for (let i = 0; i < 120 * 20; i++) a.stepTick();
    a.setThrottle(1);
    let tGate = Number.NaN, tLit = Number.NaN, tFull = Number.NaN;
    for (let i = 1; i < 120 * 12; i++) {
      a.stepTick();
      const e = a.snapshot().engines[0]!, t = i / 120;
      if (Number.isNaN(tGate) && e.spoolSpeed >= 0.74) tGate = t;
      if (Number.isNaN(tLit) && e.afterburnerLit) tLit = t;
      if (Number.isNaN(tFull) && e.afterburnerFraction > 0.99 && e.spoolSpeed > 0.98) tFull = t;
    }
    expect(tLit - tGate).toBeGreaterThanOrEqual(2);
    expect(tLit - tGate).toBeLessThanOrEqual(3.1);
    expect(tFull).toBeGreaterThanOrEqual(3);
    expect(tFull).toBeLessThanOrEqual(7);
  });
});
