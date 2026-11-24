import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { createMiG29Definition, MIG29_SWITCHES } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const terrain = new TerrainSurface();
terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 0, featureSizeM: 20000 }));
const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
const jet = () => { const a = new FixedWingAircraft(createMiG29Definition(), terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 200, throttle: 0.7 }); a.controls.request(MIG29_SWITCHES.gear, "UP", "test"); return a; };
const fly = (a: FixedWingAircraft, s: number) => { for (let i = 0; i < Math.round(s * 120); i++) a.stepTick(); return a.snapshot(); };
const texts = (a: FixedWingAircraft, s: ReturnType<FixedWingAircraft["snapshot"]>) => a.definition.annunciate!(s).map((x) => x.text);
const bus = (s: ReturnType<FixedWingAircraft["snapshot"]>, id: string) => s.electrical!.buses.find((b) => b.id === id)!;

describe("MiG-29 hydraulics (GAF T.O. 1F-MIG29-1)", () => {
  it("pressure limiter: with main below 13 MPa only the flight controls stay on main; utilities (gear, NWS, speedbrakes, ramps) are isolated", () => {
    const a = jet(); fly(a, 2);
    expect(a.snapshot().hydraulics!.branches!.find((b) => b.id === "main.util")!.open).toBe(true);
    a.controls.request(MIG29_SWITCHES.hydraulicFault, "MAIN PUMP FAIL", "test");
    let s = fly(a, 1);
    for (let t = 0; t < 120 && s.hydraulics!.circuits.find((c) => c.id === "main")!.pressurePa > 12.9e6; t++) s = fly(a, 1);
    expect(s.hydraulics!.branches!.find((b) => b.id === "main.util")!.open).toBe(false);
    expect(texts(a, s)).toContain("HYD LIMITER: FLT CONTROLS ONLY");
  });

  it("speedbrakes: extend normally; retracted when boost pressure is lost; inhibited with the gear down", () => {
    const a = jet(); fly(a, 8);
    a.controls.request(MIG29_SWITCHES.speedbrake, "EXTEND", "test");
    expect(fly(a, 4).surfaces["speedbrake"]).toBeGreaterThan(30);
    a.controls.request(MIG29_SWITCHES.hydraulicFault, "BOOSTER PUMP FAIL", "test");
    let s = fly(a, 1);
    for (let t = 0; t < 200 && s.hydraulics!.circuits.find((c) => c.id === "booster")!.pressurePa > 9.9e6; t++) s = fly(a, 1);
    expect(fly(a, 4).surfaces["speedbrake"]).toBeLessThan(2);
    const b = new FixedWingAircraft(createMiG29Definition(), terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 120, throttle: 0.6 });
    b.controls.request(MIG29_SWITCHES.gear, "UP", "test"); b.controls.request(MIG29_SWITCHES.gear, "DN", "test");
    expect(fly(b, 10).gear!.extension).toBe(1);
    b.controls.request(MIG29_SWITCHES.speedbrake, "EXTEND", "test");
    expect(fly(b, 4).surfaces["speedbrake"]).toBeLessThan(0.5);
  });

  it("reservoirs and fluid temperature are modelled; fuel cooling keeps the fluid near the fuel temperature", () => {
    const s = fly(jet(), 120);
    const m = s.hydraulics!.circuits.find((c) => c.id === "main")!;
    expect(m.reservoirFraction).toBeGreaterThan(0.9);
    expect(m.temperatureK!).toBeLessThan(330);
  });
});

describe("MiG-29 electrical system (GAF T.O. 1F-MIG29-1)", () => {
  it("AC generator loss: the PTO feeds 115 V and 36 V with the non-essential consumers shed", () => {
    const a = jet(); a.controls.request(MIG29_SWITCHES.electricalFault, "AC GEN FAIL", "test");
    const s = fly(a, 2);
    expect(bus(s, "ac").sourceId).toBe("pto"); expect(bus(s, "ac").shed).toBe(true);
    expect(bus(s, "ac36").sourceId).toBe("pto36");
    expect(texts(a, s)).toContain("PTO ON");
  });

  it("transformer failure: 36 V moves to the PTO (LRF, rate sensors, ILS shed) while 115 V stays on the generator", () => {
    const a = jet(); a.controls.request(MIG29_SWITCHES.electricalFault, "TRANSFORMER FAIL", "test");
    const s = fly(a, 2);
    expect(bus(s, "ac").sourceId).toBe("gen.ac");
    expect(bus(s, "ac36").sourceId).toBe("pto36"); expect(bus(s, "ac36").shed).toBe(true);
  });

  it("CSD overspeed disconnects the AC generator (DISCON GEN DRIVE); DC GEN switch OFF puts the DC bus on the batteries, which are not recharged", () => {
    const a = jet(); a.controls.request(MIG29_SWITCHES.electricalFault, "CSD OVERSPEED", "test");
    const s = fly(a, 2);
    expect(texts(a, s)).toContain("DISCON GEN DRIVE");
    expect(bus(s, "ac").sourceId).toBe("pto");
    const b = jet(); b.controls.request(MIG29_SWITCHES.dcGen, "OFF", "test");
    const t1 = fly(b, 2), c1 = t1.electrical!.sources.find((x) => x.id === "battery")!.chargeAh!;
    expect(bus(t1, "dc").sourceId).toBe("battery");
    b.controls.request(MIG29_SWITCHES.dcGen, "ON", "test");
    const t2 = fly(b, 30);
    expect(bus(t2, "dc").sourceId).toBe("gen.dc");
    expect(t2.electrical!.sources.find((x) => x.id === "battery")!.chargeAh!).toBeCloseTo(c1, 6);
  });
});
