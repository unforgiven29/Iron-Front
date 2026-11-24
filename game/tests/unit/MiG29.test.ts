import { describe, expect, it } from "vitest";
import { loadAircraftCatalog } from "../../src/app/AircraftCatalog.js";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { createMiG29Definition, MIG29_SWITCHES } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const D = 180 / Math.PI, KT = 1.943844;
const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
const terrain = () => {
  const t = new TerrainSurface();
  t.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 0, featureSizeM: 20000 }));
  return t;
};
const airborne = () => new FixedWingAircraft(createMiG29Definition(), terrain(), env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 200, throttle: 0.6 });
const fly = (a: FixedWingAircraft, s: number, each?: () => void) => { for (let i = 0; i < Math.round(s * 120); i++) { a.stepTick(); each?.(); } return a.snapshot(); };

describe("MiG-29 package: a second, structurally different aircraft on the shared systems", () => {
  it("imports nothing from the F-16 package", async () => {
    const fs = (await import(/* @vite-ignore */ "node:" + "fs")) as { readdirSync(p: string): string[]; readFileSync(p: string, e: string): string };
    const dir = "game/src/platforms/aircraft/mig29";
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(4);
    for (const f of files) expect(fs.readFileSync(`${dir}/${f}`, "utf8")).not.toMatch(/f16c-block50|F16/);
  });

  it("loads through the module system alongside the F-16", () => {
    const catalog = loadAircraftCatalog();
    expect(catalog.problems).toEqual([]);
    expect(catalog.ids).toEqual(expect.arrayContaining(["aircraft.f16c-block50", "aircraft.mig29"]));
    expect(catalog.definition("aircraft.mig29").engines.length).toBe(2);
  });

  it("flies hands-off at about 1 g with its mechanical controls + SAU (no fly-by-wire)", () => {
    const s = fly(airborne(), 15);
    expect(s.faults).toEqual([]);
    expect(Math.abs(s.nzG - 1)).toBeLessThan(0.15);
    expect(Math.abs(s.rollRad * D)).toBeLessThan(2);
    expect(s.fcsMode).toBe("SAU ON");
    expect(s.engines.length).toBe(2);
  });

  it("an engine cut gives asymmetric thrust: the jet yaws toward the dead (left) engine", () => {
    const a = airborne();
    fly(a, 3);
    a.setThrottle(0.9);
    a.controls.request(MIG29_SWITCHES.leftEngine, "CUT", "test");
    const s = fly(a, 6);
    const left = s.engines.find((e) => e.id === "left"), right = s.engines.find((e) => e.id === "right");
    expect(left?.flameout).toBe(true);
    expect(right?.netThrustN).toBeGreaterThan(20_000);
    expect(s.headingRad * D).toBeLessThan(-1); // nose swings left
  });

  it("two hydraulic systems on different engines: losing the booster pump keeps the main system and the surfaces", () => {
    const a = airborne();
    a.controls.request(MIG29_SWITCHES.hydraulicFault, "BOOSTER PUMP FAIL", "test");
    a.setThrottle(0.45);
    const s = fly(a, 120);
    const main = s.hydraulics?.circuits.find((c) => c.id === "main"), booster = s.hydraulics?.circuits.find((c) => c.id === "booster");
    expect(main?.pressurePa).toBeGreaterThan(18e6);
    expect(booster?.pressurePa).toBeLessThan(10e6);
    expect(s.ground.kind).not.toBe("crashed");
  });

  it("takes off from a runway on its own gear in afterburner", () => {
    const a = new FixedWingAircraft(createMiG29Definition(), terrain(), env, { positionEnuM: [0, -8000, createMiG29Definition().landingGear?.restCgHeightM ?? 1.8], headingRad: 0, speedMps: 0, throttle: 0, onGround: true });
    a.setThrottle(1);
    let liftoff = Number.NaN;
    fly(a, 40, () => {
      const s = a.snapshot();
      // Rotate to ≈10° pitch with a proportional attitude hold (mechanical controls: stick = surface angle).
      if (s.equivalentAirspeedMps * KT > 140) a.setPilotInputs({ pitch: Math.max(-0.2, Math.min(0.4, 0.06 * (10 - s.pitchRad * D) - 0.03 * s.ratesRadps[1] * D)), roll: 0, yaw: 0 });
      if (Number.isNaN(liftoff) && s.ground.kind === "airborne" && s.positionEnuM[2] > 5) liftoff = s.positionEnuM[1] + 8000;
    });
    expect(liftoff).toBeLessThan(1200);
    expect(a.snapshot().ground.kind).toBe("airborne");
  });
});
