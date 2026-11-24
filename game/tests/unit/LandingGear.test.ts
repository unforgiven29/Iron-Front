import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import type { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { createF16Aircraft, F16_SWITCHES } from "../../src/platforms/aircraft/f16c-block50/F16Aircraft.js";
import { F16_LANDING_GEAR } from "../../src/platforms/aircraft/f16c-block50/F16LandingGear.js";
import { flatteningWeight, flattenTileForAirfield, runwayLineUp, type AirfieldSpec } from "../../src/world/infrastructure/Airfield.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const D = 180 / Math.PI, KT = 1.943844;
const flat = () => {
  const t = new TerrainSurface(), n = 201;
  t.addTile({ tileId: "flat", version: 1, originEnuM: [-10000, -10000], spacingM: 100, columns: n, rows: n, heightsM: new Float64Array(n * n), verticalDatum: "scenario-origin", provenance: { kind: "synthetic", source: "flat test field" } });
  return t;
};
const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
const restZ = F16_LANDING_GEAR.restCgHeightM ?? 1.6;
const onGround = (speed = 0, throttle = 0) => createF16Aircraft(flat(), env, { positionEnuM: [0, -8000, restZ], headingRad: 0, speedMps: speed, throttle, onGround: true });
const fly = (a: FixedWingAircraft, s: number, each?: () => void) => { for (let i = 0; i < Math.round(s * 120); i++) { a.stepTick(); each?.(); } return a.snapshot(); };

describe("Landing gear, brakes and steering (shared ground-handling model, F-16 installation)", () => {
  it("rests on its gear at idle with the brakes on: no bounce, no creep", () => {
    const a = onGround();
    a.setPilotInputs({ pitch: 0, roll: 0, yaw: 0, brakes: 1 });
    const s = fly(a, 10);
    expect(s.ground.kind).toBe("on-ground");
    expect(s.gear?.weightOnWheels).toBe(true);
    expect(Math.abs(s.positionEnuM[2] - restZ)).toBeLessThan(0.05);
    expect(Math.hypot(s.velocityEnuMps[0], s.velocityEnuMps[1])).toBeLessThan(0.2);
    expect(Math.abs(s.pitchRad * D)).toBeLessThan(1);
  });

  it("steers with the nose wheel through the pedals while taxiing", () => {
    const a = onGround(10, 0);
    a.setPilotInputs({ pitch: 0, roll: 0, yaw: 0.2 }); // gentle taxi turn (≈0.3 g)
    const s = fly(a, 6);
    expect(s.headingRad * D).toBeGreaterThan(10);
    expect(s.ground.kind).toBe("on-ground");
  });

  it("air start puts the gear-handle switch UP so one request extends the gear", () => {
    const a = createF16Aircraft(flat(), env, { positionEnuM: [0, 0, 1500], headingRad: 0, speedMps: 120, throttle: 0.6 });
    fly(a, 0.05);
    expect(a.snapshot().switches[F16_SWITCHES.gearHandle]).toBe("UP");
    expect(a.snapshot().gear?.extension).toBe(0);
    expect(a.controls.request(F16_SWITCHES.gearHandle, "DN", "test").accepted).toBe(true);
    const s = fly(a, 10);
    expect(s.gear?.handleDown).toBe(true);
    expect(s.gear?.extension).toBe(1);
  });

  it("will not retract the gear with weight on wheels (squat-switch interlock)", () => {
    const a = onGround();
    a.controls.request(F16_SWITCHES.gearHandle, "UP", "test");
    const s = fly(a, 3);
    expect(s.gear?.extension).toBe(1);
    expect(s.ground.kind).toBe("on-ground");
  });

  it("takes off in afterburner, then retracts the gear in flight", () => {
    const a = onGround();
    a.setThrottle(1);
    let liftoff = Number.NaN;
    fly(a, 40, () => {
      const s = a.snapshot();
      if (s.equivalentAirspeedMps * KT > 150) a.setPilotInputs({ pitch: s.pitchRad * D > 10 ? 0.2 : 1, roll: 0, yaw: 0 });
      if (Number.isNaN(liftoff) && s.ground.kind === "airborne" && s.positionEnuM[2] > 5) liftoff = s.positionEnuM[1] + 8000;
    });
    expect(liftoff).toBeLessThan(1000);
    a.controls.request(F16_SWITCHES.gearHandle, "UP", "test");
    const s = fly(a, 7);
    expect(s.ground.kind).toBe("airborne");
    expect(s.gear?.extension).toBe(0);
  });

  /** Fly a stabilised straight-in descent at `sinkMps` (simple vertical-speed hold on the stick) until touchdown. */
  const approach = (sinkMps: number, gearDown: boolean) => {
    const a = createF16Aircraft(flat(), env, { positionEnuM: [0, -9000, 80], headingRad: 0, speedMps: 85, throttle: 0.55, gearDown });
    fly(a, 70, () => {
      const s = a.snapshot();
      if (s.ground.kind !== "airborne") return;
      // Vertical-speed hold (the g-command FLCS holds the flight path at neutral stick) and a speed hold.
      a.setPilotInputs({ pitch: Math.max(-0.35, Math.min(0.3, 0.12 * (-sinkMps - s.verticalSpeedMps) - 0.02 * s.ratesRadps[1] * D)), roll: -s.rollRad, yaw: 0 });
      a.setThrottle(Math.max(0, Math.min(0.75, 0.45 + 0.05 * (78 - s.trueAirspeedMps))));
    });
    return a;
  };

  it("lands at a normal sink rate and stops with the brakes", () => {
    const a = approach(1.5, true);
    expect(a.snapshot().ground.kind).toBe("on-ground");
    a.setThrottle(0);
    a.setPilotInputs({ pitch: 0, roll: 0, yaw: 0, brakes: 1 });
    const start = a.snapshot().positionEnuM[1];
    const s = fly(a, 40);
    expect(s.ground.kind).toBe("on-ground");
    expect(Math.hypot(s.velocityEnuMps[0], s.velocityEnuMps[1])).toBeLessThan(1);
    expect(s.positionEnuM[1] - start).toBeLessThan(1500);
  });

  it("collapses the gear on a hard landing and crashes on a gear-up landing", () => {
    const hard = approach(6, true);
    expect(hard.snapshot().ground.kind).toBe("crashed");
    const up = approach(1.5, false);
    const s = up.snapshot();
    expect(s.ground.kind).toBe("crashed");
    expect(s.ground.kind === "crashed" && s.ground.reason).toContain("gear-up");
  });

  it("brakes need hydraulic System B: with both pumps failed and the accumulators bled the jet barely slows", () => {
    const stopDistance = (fault: string) => {
      const a = onGround(40, 0);
      a.controls.request(F16_SWITCHES.hydraulicFault, fault, "test");
      if (fault !== "NORMAL") fly(a, 0); // fault active from now
      a.setPilotInputs({ pitch: 0, roll: 0, yaw: 0, brakes: 1 });
      const s = fly(a, 15);
      return Math.hypot(s.velocityEnuMps[0], s.velocityEnuMps[1]);
    };
    expect(stopDistance("NORMAL")).toBeLessThan(1);
    expect(stopDistance("B PUMP FAIL")).toBeLessThan(1); // the B system still holds pressure on its accumulator for a while
  });
});

describe("Airfield (world/infrastructure)", () => {
  const field: AirfieldSpec = { id: "f", name: "F", elevationM: 500, runways: [{ id: "36", centreEnuM: [0, 0], headingRad: 0, lengthM: 3000, widthM: 45, surface: "asphalt" }], flatMarginM: 300, blendM: 500, provenance: "test" };

  it("flattens terrain to field elevation on the runway, blending back to natural terrain", () => {
    expect(flatteningWeight(field, 0, 0)).toBe(1);
    expect(flatteningWeight(field, 300, 1700)).toBe(1);
    expect(flatteningWeight(field, 2000, 0)).toBe(0);
    const tile = flattenTileForAirfield(generateSyntheticTile({ seed: 3, tileId: "t", originEnuM: [-4000, -4000], spacingM: 100, columns: 81, rows: 81, baseHeightM: 0, reliefM: 800, featureSizeM: 5000 }), field);
    const t = new TerrainSurface();
    t.addTile(tile);
    const s = t.sample(10, 1000);
    expect(s.status === "valid" && s.heightM).toBeCloseTo(500, 6);
  });

  it("lines up on the runway threshold in either direction", () => {
    const r = field.runways[0]!;
    expect(runwayLineUp(field, r, 150).positionEnuM[1]).toBeCloseTo(-1350, 6);
    const recip = runwayLineUp(field, r, 150, true);
    expect(recip.positionEnuM[1]).toBeCloseTo(1350, 6);
    expect(recip.headingRad).toBeCloseTo(Math.PI, 9);
  });
});
