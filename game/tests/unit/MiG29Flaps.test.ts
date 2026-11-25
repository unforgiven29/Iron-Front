import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { mig29Aerodynamics } from "../../src/platforms/aircraft/mig29/MiG29Aerodynamics.js";
import { MIG29_CONTROLS as K } from "../../src/platforms/aircraft/mig29/MiG29Data.js";
import { createMiG29Definition, MIG29_SWITCHES } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const DEG = Math.PI / 180;
const aero = (flap: number, alphaDeg = 6) => {
  const V = 80, q = 0.5 * 1.225 * V * V;
  const o = mig29Aerodynamics().compute({ alphaRad: alphaDeg * DEG, betaRad: 0, trueAirspeedMps: V, dynamicPressurePa: q, mach: V / 340, ratesRadps: [0, 0, 0], surfaces: { flap }, cgFractionMac: 0.3 });
  const a = alphaDeg * DEG;
  // Body FRD → stability axes: lift = −(Fz·cosα − Fx·sinα), drag = −(Fx·cosα + Fz·sinα).
  return { lift: -(o.forceBodyN[2] * Math.cos(a) - o.forceBodyN[0] * Math.sin(a)), drag: -(o.forceBodyN[0] * Math.cos(a) + o.forceBodyN[2] * Math.sin(a)), pitch: o.momentBodyNm[1] };
};

describe("MiG-29 trailing-edge flaps (ESTIMATED increments)", () => {
  it("add lift and drag and a nose-down pitching moment, growing with deflection", () => {
    const up = aero(0), to = aero(K.flapTakeoffDeg.value), ldg = aero(K.flapLandingDeg.value);
    expect(to.lift).toBeGreaterThan(up.lift);
    expect(ldg.lift).toBeGreaterThan(to.lift);
    expect(ldg.drag).toBeGreaterThan(to.drag);
    expect(to.drag).toBeGreaterThan(up.drag);
    expect(ldg.pitch).toBeLessThan(up.pitch);
  });

  const terrain = new TerrainSurface();
  terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 0, featureSizeM: 20000 }));
  const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
  const fly = (a: FixedWingAircraft, s: number) => { for (let i = 0; i < Math.round(s * 120); i++) a.stepTick(); return a.snapshot(); };

  it("the lever drives a hydraulic actuator at its rate; flaps blow up above the limit speed", () => {
    const slow = new FixedWingAircraft(createMiG29Definition(), terrain, env, { positionEnuM: [0, 0, 1500], headingRad: 0, speedMps: 90, throttle: 0.6 });
    slow.controls.request(MIG29_SWITCHES.flaps, "LANDING", "test");
    const mid = fly(slow, 2).surfaces["flap"]!;
    expect(mid).toBeGreaterThan(5);
    expect(mid).toBeLessThan(K.flapLandingDeg.value); // still travelling (≈5°/s)
    expect(fly(slow, 6).surfaces["flap"]).toBeCloseTo(K.flapLandingDeg.value, 0);
    const fast = new FixedWingAircraft(createMiG29Definition(), terrain, env, { positionEnuM: [0, 0, 1500], headingRad: 0, speedMps: 200, throttle: 0.6 });
    fast.controls.request(MIG29_SWITCHES.flaps, "LANDING", "test");
    expect(fly(fast, 6).surfaces["flap"]).toBeLessThan(0.5);
  });

  it("without main hydraulic pressure the flaps do not move", () => {
    const a = new FixedWingAircraft(createMiG29Definition(), terrain, env, { positionEnuM: [0, 0, 1500], headingRad: 0, speedMps: 90, throttle: 0.6 });
    a.controls.request(MIG29_SWITCHES.hydraulicFault, "MAIN PUMP FAIL", "test");
    let s = fly(a, 1);
    for (let t = 0; t < 120 && (s.hydraulics!.circuits.find((c) => c.id === "main")!.pressurePa > 0.5e6); t++) s = fly(a, 1);
    a.controls.request(MIG29_SWITCHES.flaps, "LANDING", "test");
    expect(fly(a, 6).surfaces["flap"]).toBeLessThan(2);
  }, 60000);
});
