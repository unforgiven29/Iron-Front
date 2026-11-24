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

describe("MiG-29 control laws from the GAF T.O. 1F-MIG29-1 (MiG-29G; 9.13 applicability unverified)", () => {
  it("feel-control unit: full 35°/15° taileron at low speed and above 30,000 ft, 17°45'/5°45' at 470–650 KTAS near the ground", async () => {
    const { stabilatorAuthority } = await import("../../src/platforms/aircraft/mig29/MiG29ControlSystem.js");
    expect(stabilatorAuthority(200, 0)).toEqual([35, 15]);
    expect(stabilatorAuthority(550, 1000)).toEqual([17.75, 5.75]);
    expect(stabilatorAuthority(900, 1000)).toEqual([35, 15]);
    expect(stabilatorAuthority(550, 35000)).toEqual([35, 15]);
    const [midUp] = stabilatorAuthority(340, 0);
    expect(midUp).toBeLessThan(35);
    expect(midUp).toBeGreaterThan(17.75);
  });

  it("LEF lock out at AoA ≥ 8.7° below M0.8 and retract at ≤ 7° or above M0.8 (hysteresis)", async () => {
    const { lefSchedule } = await import("../../src/platforms/aircraft/mig29/MiG29Definition.js");
    const lef = lefSchedule();
    const at = (alphaDeg: number, mach = 0.5) => lef.step({ nzG: 1, nyG: 0, weightOnWheels: false, alphaRad: alphaDeg / D, betaRad: 0, ratesRadps: [0, 0, 0], dynamicPressurePa: 2e4, staticPressurePa: 8e4, mach, trueAirspeedMps: 170, pitchRad: 0, rollRad: 0 }, 1 / 120)["lef"];
    expect(at(8.5)).toBe(0);
    expect(at(9)).toBeGreaterThan(0);
    expect(at(7.5)).toBeGreaterThan(0); // hysteresis band
    expect(at(6.9)).toBe(0);
    expect(at(10, 0.85)).toBe(0);
  });

  it("AoA limiter caps a full aft stick near 15° with LEF in, and differential tailerons drop out when the LEF are out", async () => {
    const { mig29ControlSystem } = await import("../../src/platforms/aircraft/mig29/MiG29ControlSystem.js");
    const fcs = mig29ControlSystem();
    const sensors = (alphaDeg: number) => ({ nzG: 1, nyG: 0, weightOnWheels: false, alphaRad: alphaDeg / D, betaRad: 0, ratesRadps: [0, 0, 0] as const, dynamicPressurePa: 2e4, staticPressurePa: 8e4, mach: 0.3, trueAirspeedMps: 100, pitchRad: 0, rollRad: 0 }); // ≈194 KTAS: below the feel-unit band
    const lefIn = fcs.step({ pitch: 0, roll: 1, yaw: 0 }, sensors(5), { lef: 0 }, 1 / 120);
    const lefOut = fcs.step({ pitch: 0, roll: 1, yaw: 0 }, sensors(5), { lef: 20 }, 1 / 120);
    expect(lefIn.commands["differentialStabilator"]).toBe(5);
    expect(lefOut.commands["differentialStabilator"]).toBe(0);
    const over = fcs.step({ pitch: 1, roll: 0, yaw: 0 }, sensors(18), { lef: 0 }, 1 / 120);
    const under = fcs.step({ pitch: 1, roll: 0, yaw: 0 }, sensors(12), { lef: 0 }, 1 / 120);
    expect(over.annunciations).toContain("AOA LIMIT");
    expect(over.commands["elevator"]!).toBeGreaterThan(under.commands["elevator"]!);
    expect(under.commands["elevator"]).toBe(-35);
  });

  it("uses the manual's weights and RD-33 ratings", async () => {
    const { MIG29_MASS, MIG29_ENGINE } = await import("../../src/platforms/aircraft/mig29/MiG29Data.js");
    expect(MIG29_MASS.emptyMassKg.value).toBe(11001);
    expect(MIG29_MASS.internalFuelKg.value).toBe(3453);
    expect(MIG29_ENGINE.militaryThrustN.value / 9.80665).toBeCloseTo(5040, 6);
    expect(MIG29_ENGINE.maxAfterburnerThrustN.value / 9.80665).toBeCloseTo(8300, 6);
  });
});
