import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { f16FuelSystem } from "../../src/platforms/aircraft/f16c-block50/F16FuelSystem.js";
import { createF16Definition } from "../../src/platforms/aircraft/f16c-block50/F16Definition.js";
import { createMiG29Definition } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";
import { F34_KG_PER_L, mig29FuelSystem } from "../../src/platforms/aircraft/mig29/MiG29FuelSystem.js";
import { TankSet } from "../../src/systems/fuel/FuelTanks.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const burn = (flow: number, rpm = 0.9, alt = 3000) => ({ engineFlowKgS: { left: flow / 2, right: flow / 2 }, engineSpeed: { left: rpm, right: rpm }, nzG: 1, altitudeM: alt });

describe("shared tank physics", () => {
  it("transfers are limited by usable fuel and free space; inertia is a point-mass sum", () => {
    const t = new TankSet([{ id: "a", capacityKg: 100, unusableKg: 10, positionBodyM: [1, 0, 0] }, { id: "b", capacityKg: 50, unusableKg: 0, positionBodyM: [-1, 0, 0] }]);
    t.set("b", 40);
    expect(t.transfer("a", "b", 1000, 1)).toBe(10); // only 10 kg of room
    t.set("a", 15);
    t.set("b", 0);
    expect(t.transfer("a", "b", 1000, 1)).toBe(5); // 10 kg unusable stays
    expect(t.inertiaAbout([0, 0, 0])[1][1]).toBeCloseTo(10 * 1 + 5 * 1, 9);
    expect(() => new TankSet([{ id: "x", capacityKg: 0, unusableKg: 0, positionBodyM: [0, 0, 0] }])).toThrow();
  });
});

describe("MiG-29 fuel system (GAF T.O. 1F-MIG29-1 sequence)", () => {
  it("uses the published tank capacities (4,300 L internal)", () => {
    const f = mig29FuelSystem();
    expect(f.tanks.totalKg() / F34_KG_PER_L).toBeCloseTo(4300, 6);
    expect(f.tanks.spec("tank2").capacityKg / F34_KG_PER_L).toBeCloseTo(900, 6);
  });

  it("follows the manual's order: tank 1 first, then tank 3, outer tanks into tank 3, tank 2 last; wing tanks drain evenly", () => {
    const f = mig29FuelSystem(); f.reset();
    const order: string[] = [];
    let maxWingImbalance = 0;
    for (let i = 0; i < 20000 && f.tanks.totalKg() > 100; i++) {
      f.step(burn(1.2), 0.5);
      maxWingImbalance = Math.max(maxWingImbalance, Math.abs(f.tanks.kg("wingL") - f.tanks.kg("wingR")));
      for (const id of ["tank1", "tank3", "wingL", "tank3A1", "tank2"]) if (f.tanks.kg(id) < f.tanks.spec(id).capacityKg - 1 && !order.includes(id)) order.push(id);
    }
    expect(order.slice(0, 2)).toEqual(["tank1", "tank3"]);
    expect(order.at(-1)).toBe("tank2");
    expect(maxWingImbalance).toBeLessThan(1);
  });

  it("burns only from the feed tank; shows 550 KG REMAIN; reports NO BOOST and starves the engines when empty", () => {
    const f = mig29FuelSystem(); f.reset();
    f.step(burn(1.2), 1);
    expect(f.tanks.kg("tank2")).toBeGreaterThan(f.tanks.spec("tank2").capacityKg - 2); // tank 1 refills it (minus this step's burn)
    let saw550 = false;
    for (let i = 0; i < 20000 && f.engineFuelAvailable("left"); i++) { f.step(burn(2.4), 0.5); if (f.annunciations().includes("550 KG REMAIN")) saw550 = true; }
    expect(saw550).toBe(true);
    expect(f.engineFuelAvailable("left")).toBe(false);
    expect(f.annunciations()).toContain("NO BOOST");
  });

  it("CL tank transfers only above 80 % RPM and not above 30,000 ft", () => {
    const run = (rpm: number, alt: number) => { const f = mig29FuelSystem({ centerlineTank: true }); f.reset(); for (let i = 0; i < 600; i++) f.step(burn(1.2, rpm, alt), 0.5); return f.tanks.kg("centerline"); };
    const full = 1500 * F34_KG_PER_L;
    expect(run(0.75, 3000)).toBeCloseTo(full, 3);
    expect(run(0.95, 10000)).toBeCloseTo(full, 3);
    expect(run(0.95, 3000)).toBeLessThan(full - 200); // limited by the room opening up in tank 1
  });
});

describe("F-16 fuel system (secondary-reported tank layout)", () => {
  it("transfers wing fuel first and keeps the forward and aft systems balanced", () => {
    const f = f16FuelSystem(); f.reset();
    for (let i = 0; i < 400; i++) f.step({ engineFlowKgS: { f110: 1.5 }, engineSpeed: { f110: 0.9 }, nzG: 1, altitudeM: 3000 }, 0.5);
    expect(f.tanks.kg("wingL")).toBeLessThan(f.tanks.spec("wingL").capacityKg - 100);
    const frac = (t: string, r: string) => (f.tanks.kg(t) + f.tanks.kg(r)) / (f.tanks.spec(t).capacityKg + f.tanks.spec(r).capacityKg);
    expect(Math.abs(frac("f1", "fwdReservoir") - frac("a1", "aftReservoir"))).toBeLessThan(0.05);
  });
});

describe("runtime: fuel moves the CG and changes mass and inertia", () => {
  const terrain = new TerrainSurface();
  terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 0, featureSizeM: 20000 }));
  const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
  for (const [name, def] of [["MiG-29", createMiG29Definition()], ["F-16", createF16Definition()]] as const) {
    it(`${name}: snapshot exposes tanks; burning fuel moves the CG and lightens the jet`, () => {
      const a = new FixedWingAircraft(def, terrain, env, { positionEnuM: [0, 0, 5000], headingRad: 0, speedMps: 220, throttle: 1 });
      const s0 = a.snapshot();
      expect(s0.fuelTanks?.length).toBeGreaterThan(4);
      expect(s0.fuelKg).toBeCloseTo(def.mass.internalFuelKg, 3);
      for (let i = 0; i < 120 * 120; i++) a.stepTick();
      const s1 = a.snapshot();
      expect(s1.massKg).toBeLessThan(s0.massKg - 100);
      const shift = Math.abs(s1.cgFractionMac - s0.cgFractionMac);
      // MiG-29: the GAF sequence empties forward tank 1 first, so the CG moves aft noticeably.
      // F-16: the fwd/aft balancing keeps the CG nearly fixed.
      if (name === "MiG-29") expect(shift).toBeGreaterThan(0.005); else expect(shift).toBeLessThan(0.01);
      expect(shift).toBeLessThan(0.06);
    }, 20_000); // simulates 2 minutes of full-throttle flight
  }
});
