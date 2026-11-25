import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { createMiG29Definition, MIG29_SWITCHES } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";
import { mig29PneumaticLoads } from "../../src/platforms/aircraft/mig29/MiG29Pneumatics.js";
import { MIG29_HYDRAULIC_INSTALLATION } from "../../src/platforms/aircraft/mig29/MiG29Systems.js";
import { HydraulicNetwork } from "../../src/systems/hydraulics/HydraulicNetwork.js";
import { PneumaticNetwork, type PneumaticInstallation } from "../../src/systems/pneumatics/PneumaticNetwork.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const R = 8.314462618;
const inst: PneumaticInstallation = {
  systems: [
    { id: "a", bottles: [{ id: "a1", volumeM3: 0.004 }, { id: "a2", volumeM3: 0.006 }], chargePressurePa: 15e6 },
    { id: "b", bottles: [{ id: "b1", volumeM3: 0.005 }], chargePressurePa: 10e6, thermalTimeConstantS: 100 }
  ],
  regulators: [{ id: "reg", systemId: "a", setpointPa: 3e6 }],
  consumers: [
    { id: "jack", supplyId: "reg", requiredPressurePa: 3e6, strokeVolumeM3: 0.001 },
    { id: "flow", supplyId: "b", requiredPressurePa: 5e6, flowM3sAtFull: 1e-4 }
  ]
};
const sys = (n: PneumaticNetwork, id: string) => n.snapshot().systems.find((s) => s.id === id)!;

describe("Shared pneumatic (stored-gas) network", () => {
  it("is charged to its servicing pressure and uses ideal-gas consumption per stroke at the regulated pressure", () => {
    const n = new PneumaticNetwork(inst);
    expect(n.pressurePa("a")).toBeCloseTo(15e6, -2);
    const before = sys(n, "a").gasMol;
    n.step(0.01, { actuations: { jack: 2 } });
    // 2 strokes × 1 L at 3 MPa (regulator outlet), isothermal at 288.15 K.
    expect(before - sys(n, "a").gasMol).toBeCloseTo((3e6 * 0.002) / (R * 288.15), 6);
    expect(n.pressurePa("b")).toBeCloseTo(10e6, -2); // independent system untouched
  });

  it("regulator: outlet = min(setpoint, upstream); failed closed = 0, failed open = upstream", () => {
    const n = new PneumaticNetwork(inst);
    expect(n.pressurePa("reg")).toBe(3e6);
    expect(n.supplyFraction("jack")).toBe(1);
    n.setFaults([{ kind: "regulator-failed", regulatorId: "reg", mode: "closed" }]);
    expect(n.pressurePa("reg")).toBe(0);
    expect(n.supplyFraction("jack")).toBe(0);
    n.setFaults([{ kind: "regulator-failed", regulatorId: "reg", mode: "open" }]);
    expect(n.pressurePa("reg")).toBeCloseTo(15e6, -2);
    n.setFaults([]);
    n.setFaults([{ kind: "system-leak", systemId: "a", leakMolSPerPa: 1e-6 }]);
    for (let i = 0; i < 2000; i++) n.step(0.1);
    expect(n.pressurePa("a")).toBeLessThan(3e6);
    expect(n.pressurePa("reg")).toBeCloseTo(n.pressurePa("a"), 3); // below setpoint the regulator passes upstream pressure
  });

  it("isolation: a leak drains only its own system; no in-flight recharge; servicing restores the charge", () => {
    const n = new PneumaticNetwork(inst);
    n.setFaults([{ kind: "system-leak", systemId: "a", leakMolSPerPa: 1e-6 }]);
    let last = n.pressurePa("a");
    for (let i = 0; i < 100; i++) { n.step(0.5); const p = n.pressurePa("a"); expect(p).toBeLessThanOrEqual(last); last = p; }
    expect(last).toBeLessThan(10e6);
    expect(n.pressurePa("b")).toBeCloseTo(10e6, -2);
    n.setFaults([]);
    n.service("a");
    expect(n.pressurePa("a")).toBeCloseTo(15e6, -2);
    expect(sys(n, "a").inventoryFraction).toBeCloseTo(1, 9);
  });

  it("a failed check valve crossfeeds towards pressure equality and never past it", () => {
    const n = new PneumaticNetwork(inst);
    n.setFaults([{ kind: "check-valve-failed", systemA: "a", systemB: "b", conductanceMolSPerPa: 1e-3 }]);
    const total = sys(n, "a").gasMol + sys(n, "b").gasMol;
    for (let i = 0; i < 50; i++) n.step(0.1);
    expect(n.pressurePa("a")).toBeCloseTo(n.pressurePa("b"), -3);
    expect(sys(n, "a").gasMol + sys(n, "b").gasMol).toBeCloseTo(total, 6); // gas conserved
  });

  it("gas temperature follows ambient with its time constant (cold soak lowers pressure)", () => {
    const n = new PneumaticNetwork(inst);
    for (let i = 0; i < 1000; i++) n.step(1, { ambientK: 230 });
    expect(n.pressurePa("b")).toBeCloseTo(10e6 * (230 / 288.15), -3);
    expect(n.pressurePa("a")).toBeCloseTo(15e6, -2); // no time constant: isothermal
  });

  it("rejects an installation with an unknown supply or no bottle volume", () => {
    expect(() => new PneumaticNetwork({ systems: inst.systems, consumers: [{ id: "x", supplyId: "nope", requiredPressurePa: 1 }] })).toThrow(/unknown supply/);
    expect(() => new PneumaticNetwork({ systems: [{ id: "z", bottles: [], chargePressurePa: 1e6 }] })).toThrow(/bottle volume/);
  });

  it("hydraulic pumps deliver only what their inlet fraction allows (starved reservoir)", () => {
    const run = (inlet: number) => {
      const h = new HydraulicNetwork(MIG29_HYDRAULIC_INSTALLATION);
      h.reset(true);
      h.setFaults([{ kind: "circuit-leak", circuitId: "main", leakM3sPerPa: 2e-4 / 21e6 }]);
      for (let i = 0; i < 600; i++) h.step(0.05, () => 1, {}, { pumpInletFraction: { main: inlet, booster: inlet } });
      return h.pressurePa("main");
    };
    expect(run(1)).toBeGreaterThan(18e6);
    expect(run(0)).toBeLessThan(5e6);
  });
});

const terrain = new TerrainSurface();
terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 0, featureSizeM: 20000 }));
const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
const fly = (a: FixedWingAircraft, s: number) => { for (let i = 0; i < Math.round(s * 120); i++) a.stepTick(); return a.snapshot(); };
/** A MiG-29 whose named nitrogen system was serviced only to `pa` (e.g. not refilled after use). */
const underServiced = (systemId: string, pa: number) => {
  const d = createMiG29Definition();
  return { ...d, pneumatics: { ...d.pneumatics!, systems: d.pneumatics!.systems.map((x) => (x.id === systemId ? { ...x, chargePressurePa: pa } : x)) } };
};
const airStart = (def = createMiG29Definition()) => new FixedWingAircraft(def, terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 130, throttle: 0.7 });

describe("MiG-29 pneumatic installation (GAF T.O. 1F-MIG29-1)", () => {
  it("main and emergency nitrogen systems at 15 MPa and the drag-chute bottle at 6.3 MPa", () => {
    const s = fly(airStart(), 0.1);
    const p = (id: string) => s.pneumatics!.systems.find((x) => x.id === id)!.pressurePa;
    expect(p("main")).toBeCloseTo(15e6, -5);
    expect(p("emergency")).toBeCloseTo(15e6, -5);
    expect(p("chute")).toBeCloseTo(6.3e6, -5);
  });

  it("staged emergency extension: NOSE extends only the nose gear, MAIN then the mains; normal retraction is cut off", () => {
    const a = airStart();
    a.controls.request(MIG29_SWITCHES.hydraulicFault, "MAIN PUMP FAIL", "test");
    let s = fly(a, 1);
    expect(s.gear!.extension).toBe(0);
    expect(a.controls.request(MIG29_SWITCHES.emergencyGear, "MAIN", "test").accepted).toBe(false); // must go through NOSE
    a.controls.request(MIG29_SWITCHES.emergencyGear, "NOSE", "test");
    s = fly(a, 8);
    expect(s.gear!.legExtension["nose"]).toBe(1);
    expect(s.gear!.legExtension["left"]).toBe(0);
    expect(s.gear!.legExtension["right"]).toBe(0);
    const emergAfterNose = s.pneumatics!.systems.find((x) => x.id === "emergency")!.pressurePa;
    expect(emergAfterNose).toBeLessThan(15e6);
    expect(a.controls.request(MIG29_SWITCHES.emergencyGear, "MAIN", "test").accepted).toBe(true);
    s = fly(a, 10);
    expect(s.gear!.extension).toBe(1);
    expect(s.pneumatics!.systems.find((x) => x.id === "emergency")!.pressurePa).toBeLessThan(emergAfterNose);
    expect(s.pneumatics!.systems.find((x) => x.id === "main")!.pressurePa).toBeCloseTo(15e6, -6); // isolated from main
    // Gear handle UP with main hydraulics back: the shut-off valves keep the gear down.
    a.controls.request(MIG29_SWITCHES.hydraulicFault, "NORMAL", "test");
    a.controls.request(MIG29_SWITCHES.gear, "UP", "test");
    expect(fly(a, 12).gear!.extension).toBe(1);
  });

  it("an almost empty emergency system extends the gear only slowly", () => {
    const a = airStart(underServiced("emergency", 0.3e6));
    a.controls.request(MIG29_SWITCHES.emergencyGear, "NOSE", "test");
    expect(fly(a, 8).gear!.legExtension["nose"]).toBeLessThan(0.2);
  });

  it("restart re-services the bottles and restows the emergency handle", () => {
    const a = airStart();
    a.controls.request(MIG29_SWITCHES.emergencyGear, "NOSE", "test");
    fly(a, 6);
    a.reset({ positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 130, throttle: 0.7 });
    const s = fly(a, 0.5);
    expect(s.switches[MIG29_SWITCHES.emergencyGear]).toBe("STOWED");
    expect(s.gear!.extension).toBe(0);
    expect(s.pneumatics!.systems.find((x) => x.id === "emergency")!.pressurePa).toBeCloseTo(15e6, -5);
    a.controls.request(MIG29_SWITCHES.gear, "DN", "test");
    expect(fly(a, 12).gear!.extension).toBe(1); // normal extension available again
  });

  it("normal wheel brakes are pneumatic: applications use main-system gas, and a drained main system leaves no brake pressure", () => {
    const a = airStart();
    const p0 = fly(a, 0.1).pneumatics!.systems.find((x) => x.id === "main")!.pressurePa;
    for (let i = 0; i < 20; i++) { a.setPilotInputs({ pitch: 0, roll: 0, yaw: 0, brakes: 1 }); fly(a, 0.1); a.setPilotInputs({ pitch: 0, roll: 0, yaw: 0, brakes: 0 }); fly(a, 0.1); }
    const s = a.snapshot();
    const used = p0 - s.pneumatics!.systems.find((x) => x.id === "main")!.pressurePa;
    expect(used).toBeGreaterThan(0);
    const drained = fly(airStart(underServiced("main", 0.1e6)), 0.1);
    expect(drained.pneumatics!.consumers.find((c) => c.id === "brakes.normal")!.supplyFraction).toBeLessThan(0.05);
    expect(drained.pneumatics!.systems.find((x) => x.id === "emergency")!.pressurePa).toBeGreaterThan(14e6); // isolated
  });

  it("MAIN LEAK test switch bleeds only the main system", () => {
    const a = airStart();
    a.controls.request(MIG29_SWITCHES.pneumaticFault, "MAIN LEAK", "test");
    const s = fly(a, 5);
    expect(s.pneumatics!.systems.find((x) => x.id === "main")!.pressurePa).toBeLessThan(15e6 * Math.exp(-5 / 120) * 1.01);
    expect(s.pneumatics!.systems.find((x) => x.id === "emergency")!.pressurePa).toBeCloseTo(15e6, -5);
  });

  it("reservoir pressurisation keeps the hydraulic pump inlets fed; unpressurised, only gravity head remains (none at ≤0 g)", () => {
    const logic = mig29PneumaticLoads(MIG29_SWITCHES.emergencyGear);
    const ctx = (fraction: number, nzG: number) => ({ sensors: { nzG } as never, pilot: { pitch: 0, roll: 0, yaw: 0 }, switches: {}, pressurePa: () => 0, supplyFraction: (id: string) => (id === "hyd.reservoir" ? fraction : 1) });
    expect(logic.step(ctx(1, -1), 0.01).hydraulicPumpInlet!["main"]).toBe(1);
    expect(logic.step(ctx(0, 1), 0.01).hydraulicPumpInlet!["main"]).toBe(1);
    expect(logic.step(ctx(0, 0.5), 0.01).hydraulicPumpInlet!["booster"]).toBe(0.5);
    expect(logic.step(ctx(0, -1), 0.01).hydraulicPumpInlet!["main"]).toBe(0);
  });
});

describe("MiG-29 EFB pneumatics page", () => {
  it("draws the bottles and consumers from the live pneumatic snapshot", () => {
    const a = airStart();
    a.controls.request(MIG29_SWITCHES.pneumaticFault, "MAIN LEAK", "test");
    const s = fly(a, 2);
    const html = a.definition.efb!.pages.find((p) => p.id === "pneumatics")!.render(s, undefined);
    const main = s.pneumatics!.systems.find((x) => x.id === "main")!.pressurePa;
    expect(html).toContain(`${(main / 1e6).toFixed(1)} MPa`);
    for (const t of ["EMERGENCY", "CHUTE", "BRAKE REG", "EMERG GEAR", "LEAK main"]) expect(html).toContain(t);
  });
});
