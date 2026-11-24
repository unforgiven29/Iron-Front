import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { createF16Definition } from "../../src/platforms/aircraft/f16c-block50/F16Definition.js";
import { F16_SWITCHES } from "../../src/platforms/aircraft/f16c-block50/F16Switches.js";
import { createMiG29Definition, MIG29_SWITCHES } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";
import { mig29AccessoryDrives } from "../../src/platforms/aircraft/mig29/MiG29Systems.js";
import { ElectricalNetwork } from "../../src/systems/electrical/ElectricalNetwork.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const terrain = new TerrainSurface();
terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 0, featureSizeM: 20000 }));
const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
const fly = (a: FixedWingAircraft, s: number) => { for (let i = 0; i < Math.round(s * 120); i++) a.stepTick(); return a.snapshot(); };
const bus = (s: ReturnType<FixedWingAircraft["snapshot"]>, id: string) => s.electrical!.buses.find((b) => b.id === id)!;

describe("shared electrical network", () => {
  const net = () => new ElectricalNetwork({
    sources: [
      { id: "gen", kind: "generator", driveId: "e", minDriveFraction: 0.5, ratedPowerW: 1000 },
      { id: "bat", kind: "battery", capacityAh: 1, nominalVoltage: 24 }
    ],
    buses: [{ id: "b", sources: ["gen", "bat"], essentialLoadW: 240, sheddableLoadW: 900, shedOn: ["bat"] }]
  });
  it("transfers to the next source, sheds on backup, drains the battery, and trips an overloaded generator", () => {
    const n = net();
    n.step(1, () => 1);
    expect(n.snapshot.sources.find((s) => s.id === "gen")!.tripped).toBe(true); // 1,140 W on a 1 kW generator
    let s = n.step(1, () => 1);
    expect(s.buses[0]!.sourceId).toBe("bat");
    expect(s.buses[0]!.shed).toBe(true);
    for (let i = 0; i < 3600; i++) s = n.step(1, () => 0);
    expect(s.buses[0]!.powered).toBe(false); // 240 W / 24 V = 10 A empties 1 Ah in 6 min
  });
});

describe("MiG-29 systems (GAF T.O. 1F-MIG29-1)", () => {
  it("the gearbox follows the RH engine unless the LH is ≥7 % faster", () => {
    const d = mig29AccessoryDrives();
    const ctx = (l: number, r: number) => ({ engineSpeed: (id: string) => (id === "left" ? l : r), hydraulicPressurePa: () => 21e6, emergencyUnitRunning: false });
    expect(d(ctx(0.9, 0.85))["gbx"]).toBe(0.85);
    expect(d(ctx(0.95, 0.85))["gbx"]).toBe(0.95);
    expect(d(ctx(0, 0.9))["gbx"]).toBe(0.9);
  });

  it("one engine out keeps both hydraulic systems and both generators (gearbox driven by the other)", () => {
    const a = new FixedWingAircraft(createMiG29Definition(), terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 200, throttle: 0.8 });
    a.controls.request(MIG29_SWITCHES.leftEngine, "CUT", "test");
    const s = fly(a, 60);
    expect(s.engines.find((e) => e.id === "left")!.flameout).toBe(true);
    for (const c of s.hydraulics!.circuits) expect(c.pressurePa).toBeGreaterThan(18e6);
    expect(bus(s, "ac").sourceId).toBe("gen.ac");
    expect(bus(s, "dc").sourceId).toBe("gen.dc");
  });

  it("AC generator failure: PTO feeds essential AC, non-essentials (incl. the SAU) are shed, AC GEN caution", () => {
    const a = new FixedWingAircraft(createMiG29Definition(), terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 200, throttle: 0.6 });
    a.controls.request(MIG29_SWITCHES.electricalFault, "AC GEN FAIL", "test");
    const s = fly(a, 2);
    expect(bus(s, "ac").sourceId).toBe("pto");
    expect(bus(s, "ac").shed).toBe(true);
    expect(s.annunciations).toContain("SAU OFF (NO POWER)");
    expect(createMiG29Definition().annunciate!(s).map((x) => x.text)).toContain("AC GEN");
  });

  it("both generators failed: batteries carry DC and the PTO, then run down; TWO GEN warning", () => {
    const a = new FixedWingAircraft(createMiG29Definition(), terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 200, throttle: 0.6 });
    a.controls.request(MIG29_SWITCHES.electricalFault, "BOTH GEN FAIL", "test");
    const s = fly(a, 5);
    expect(bus(s, "dc").sourceId).toBe("battery");
    expect(bus(s, "ac").sourceId).toBe("pto");
    expect(createMiG29Definition().annunciate!(s).map((x) => x.text)).toContain("TWO GEN");
    const before = s.electrical!.sources.find((x) => x.id === "battery")!.chargeAh!;
    const later = fly(a, 60).electrical!.sources.find((x) => x.id === "battery")!.chargeAh!;
    expect(later).toBeLessThan(before);
  });

  it("emergency pump runs only with both systems low AND both engines at ≥85 %", () => {
    const d = mig29AccessoryDrives();
    const ctx = (l: number, r: number, p: number) => ({ engineSpeed: (id: string) => (id === "left" ? l : r), hydraulicPressurePa: () => p, emergencyUnitRunning: false });
    expect(d(ctx(0.9, 0.9, 21e6))["emergencyPump"]).toBe(0);
    expect(d(ctx(0.9, 0.9, 5e6))["emergencyPump"]).toBe(1);
    expect(d(ctx(0.8, 0.9, 5e6))["emergencyPump"]).toBe(0);
  });
});

describe("F-16 electrical system (T.O. GR1F-16CJ-1 Section I bus behaviour)", () => {
  it("main generator loss: standby generator powers the essential and emergency AC buses (and all DC but non-essential); ELEC SYS; no EPU", () => {
    const a = new FixedWingAircraft(createF16Definition(), terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 200, throttle: 0.6 });
    a.controls.request(F16_SWITCHES.electricalFault, "MAIN GEN FAIL", "test");
    const s = fly(a, 5);
    expect(bus(s, "ac.essential").sourceId).toBe("gen.standby");
    expect(bus(s, "ac.emergency1").sourceId).toBe("gen.standby");
    expect(bus(s, "ac.nonessential").powered).toBe(false);
    expect(bus(s, "dc.nonessential").powered).toBe(false);
    for (const id of ["dc.essential", "dc.emergency1", "dc.emergency2", "dc.battery1", "dc.battery2"]) expect(bus(s, id).powered).toBe(true);
    expect(s.hydraulics!.emergencyUnit!.state).toBe("off");
    expect(s.lights.map((x) => x.text)).toContain("ELEC SYS");
    expect(s.indications["elecMainGen"]).toBe(1);
    expect(s.indications["elecStbyGen"]).toBe(0);
  });

  it("main + standby generator loss starts the EPU: its generator carries only the emergency AC buses; essential/non-essential DC drop; FLCS stays powered", () => {
    const a = new FixedWingAircraft(createF16Definition(), terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 200, throttle: 0.6 });
    a.controls.request(F16_SWITCHES.electricalFault, "MAIN+STBY GEN FAIL", "test");
    const s = fly(a, 10);
    expect(s.hydraulics!.emergencyUnit!.state).toBe("running");
    expect(bus(s, "ac.emergency1").sourceId).toBe("gen.epu");
    expect(bus(s, "ac.emergency2").sourceId).toBe("gen.epu");
    expect(bus(s, "ac.essential").powered).toBe(false);
    expect(bus(s, "dc.essential").powered).toBe(false);
    expect(bus(s, "dc.nonessential").powered).toBe(false);
    expect(bus(s, "dc.emergency1").powered).toBe(true);
    expect(bus(s, "dc.battery1").sourceId).toBe("conv.dc.emergency1");
    expect(bus(s, "flcs").powered).toBe(true);
    expect(s.annunciations).not.toContain("FLCS POWER LOST");
    expect(s.indications["elecStbyGen"]).toBe(1);
  });
});
