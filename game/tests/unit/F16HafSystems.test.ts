import { describe, expect, it } from "vitest";
import type { MonitorContext } from "../../src/platforms/aircraft/common/AircraftDefinition.js";
import { F16_FUEL, F16_TANK_LB, f16FuelSystem } from "../../src/platforms/aircraft/f16c-block50/F16FuelSystem.js";
import { f16Monitor } from "../../src/platforms/aircraft/f16c-block50/F16Monitor.js";
import { F16_SWITCHES } from "../../src/platforms/aircraft/f16c-block50/F16Switches.js";

const LB = 0.45359237;
type Opt = { flow?: number; n?: number; nz?: number; hydA?: number; feed?: string; master?: string; qty?: string; dead?: string[] };
const input = (o: Opt) => ({
  engineFlowKgS: { f110: o.flow ?? 1 }, engineSpeed: { f110: o.n ?? 0.9 }, nzG: o.nz ?? 1, altitudeM: 3000,
  hydraulicPressurePa: (c: string) => (c === "A" ? (o.hydA ?? 20.7e6) : 20.7e6),
  busPowered: (id: string) => !(o.dead ?? []).includes(id),
  switches: { [F16_SWITCHES.engFeed]: o.feed ?? "NORM", [F16_SWITCHES.fuelMaster]: o.master ?? "MASTER", [F16_SWITCHES.fuelQtySel]: o.qty ?? "NORM" }
});
const run = (f: ReturnType<typeof f16FuelSystem>, o: Opt, s: number, dt = 0.05) => { for (let i = 0; i < s / dt; i++) f.step(input(o), dt); };
const lb = (f: ReturnType<typeof f16FuelSystem>, ...ids: string[]) => ids.reduce((a, id) => a + f.tanks.kg(id), 0) / LB;

describe("F-16C fuel system (T.O. GR1F-16CJ-1 figs 1-19..1-23, C model, JP-8)", () => {
  it("tank capacities: 7,160 lb internal; F-1+F-2+FWD RSVR 3,250; A-1+AFT RSVR 2,810; reservoirs and wings", () => {
    const f = f16FuelSystem(); f.reset();
    expect(f.tanks.totalKg() / LB).toBeCloseTo(7160, 6);
    expect(lb(f, "f1", "f2", "fwdReservoir")).toBeCloseTo(3250, 6);
    expect(lb(f, "a1", "aftReservoir")).toBeCloseTo(2810, 6);
    expect(F16_TANK_LB["fwdReservoir"]).toBe(480);
    expect(F16_TANK_LB["wingL"]).toBe(550);
  });

  it("FFP takes equal amounts from each reservoir: the forward–aft difference stays constant; wings empty first", () => {
    const f = f16FuelSystem(); f.reset();
    const d0 = lb(f, "f1", "f2", "fwdReservoir") - lb(f, "a1", "aftReservoir");
    run(f, { flow: 1.2 }, 300);
    expect(lb(f, "wingL")).toBeLessThan(550 - 200);
    expect(lb(f, "f1")).toBeCloseTo(F16_TANK_LB["f1"]!, 0); // F-1 untouched while the wing still feeds
    // Right wing feeds the forward system, left wing the aft system: the fuselage difference is held.
    expect(Math.abs(lb(f, "f1", "f2", "fwdReservoir", "wingR") - lb(f, "a1", "aftReservoir", "wingL") - d0)).toBeLessThan(5);
  });

  it("ENG FEED AFT moves fuel from the aft tanks to the engine and forward tanks (CG forward); FWD the reverse", () => {
    const fwdAft = (feed: string) => { const f = f16FuelSystem(); f.reset(); run(f, { flow: 0.8, feed }, 600); return lb(f, "f1", "f2", "fwdReservoir", "wingR") - lb(f, "a1", "aftReservoir", "wingL"); };
    const norm = fwdAft("NORM");
    expect(fwdAft("AFT")).toBeGreaterThan(norm + 500);
    expect(fwdAft("FWD")).toBeLessThan(norm - 500);
  });

  it("automatic forward transfer (C): opens below a 300 lb forward-heavy differential with forward fuel < 2,800 lb; never with FUEL QTY SEL out of NORM", () => {
    const setup = () => { const f = f16FuelSystem(); f.reset(); f.tanks.set("f1", 200 * LB); f.tanks.set("f2", 600 * LB); f.tanks.set("wingR", 0); f.tanks.set("wingL", 0); return f; };
    const a = setup(); run(a, { flow: 0.3 }, 30);
    expect(a.components!().valves.find((v) => v.id === "trim")!.open).toBe(true);
    run(a, { flow: 0.3 }, 1200);
    const diff = lb(a, "f1", "f2", "fwdReservoir") - lb(a, "a1", "aftReservoir");
    expect(diff).toBeGreaterThanOrEqual(F16_FUEL.trimOpenBelowLb - 1);
    expect(diff).toBeLessThanOrEqual(F16_FUEL.trimCloseAtLb + 1);
    const b = setup(); run(b, { flow: 0.3, qty: "RSVR" }, 30);
    expect(b.components!().valves.find((v) => v.id === "trim")!.open).toBe(false);
    const c = setup(); run(c, { flow: 0.3, dead: ["dc.emergency2"] }, 30);
    expect(c.components!().valves.find((v) => v.id === "trim")!.open).toBe(false);
  });

  it("one reservoir empty: the FFP keeps the engine running below 25,000 pph, not above", () => {
    const at = (pph: number) => { const f = f16FuelSystem(); f.reset(); for (const id of ["aftReservoir", "a1", "wingL"]) f.tanks.set(id, 0); run(f, { flow: pph * LB / 3600 }, 2); return f.engineFuelAvailable("f110"); };
    expect(at(20_000)).toBe(true);
    expect(at(30_000)).toBe(false);
  });

  it("gravity feed (no generators → no boost pumps, and hydraulic system A failed): flame-out when either reservoir empties", () => {
    const f = f16FuelSystem(); f.reset();
    const dead = ["dc.essential", "dc.nonessential"];
    run(f, { flow: 0.5, hydA: 0, dead }, 5);
    expect(f.components!().indications!["gravityFeed"]).toBe(1);
    expect(f.engineFuelAvailable("f110")).toBe(true);
    for (const id of ["aftReservoir", "a1", "wingL"]) f.tanks.set(id, 0);
    run(f, { flow: 0.5, hydA: 0, dead }, 1);
    expect(f.engineFuelAvailable("f110")).toBe(false);
  });

  it("negative g with full reservoirs: about 10 s at AB and about 30 s at MIL (Section V limits)", () => {
    const tToStarve = (flow: number) => { const f = f16FuelSystem(); f.reset(); let t = 0; while (t < 120) { f.step(input({ flow, nz: -1 }), 0.05); t += 0.05; if (!f.engineFuelAvailable("f110")) break; } return t; };
    expect(tToStarve(8)).toBeGreaterThan(8); expect(tToStarve(8)).toBeLessThan(13);
    expect(tToStarve(2.7)).toBeGreaterThan(25); expect(tToStarve(2.7)).toBeLessThan(35);
  });

  it("FUEL MASTER OFF closes the main shutoff valve over its 24 s travel, then the engine starves", () => {
    const f = f16FuelSystem(); f.reset();
    run(f, { master: "OFF" }, 10);
    expect(f.engineFuelAvailable("f110")).toBe(true);
    run(f, { master: "OFF" }, 15);
    expect(f.engineFuelAvailable("f110")).toBe(false);
  });

  it("feed fuel heats up at low fuel flow (heat exchanger) — FUEL HOT logic: more flow, cooler fuel", () => {
    const temp = (flow: number) => { const f = f16FuelSystem(); f.reset(); run(f, { flow, n: 0.9 }, 120); return f.components!().indications!["feedFuelTemperatureK"]!; };
    expect(temp(0.1)).toBeGreaterThan(temp(0.5) + 30);
  });
});

const engine = (o: { n?: number; egtK?: number; mode?: "primary" | "backup" }) => ({
  id: "f110", spoolSpeed: o.n ?? 0.9, fanSpeed: o.n ?? 0.9, flameout: false, exhaustGasTemperatureK: o.egtK ?? 900, turbineInletTemperatureK: 1500,
  fuelFlowKgS: 1, nozzle: { position: 0.2 }, health: { oilPressurePa: 3e5, oilTemperatureK: 360 },
  control: { mode: o.mode ?? "primary", speedDemand: o.n ?? 0.9 }
});
const ctx = (o: Parameters<typeof engine>[0] & { hydA?: number; nz?: number; wow?: boolean } = {}): MonitorContext => ({
  sensors: { nzG: o.nz ?? 1, weightOnWheels: o.wow ?? false } as MonitorContext["sensors"],
  engines: [engine(o)] as unknown as MonitorContext["engines"],
  hydraulics: { circuits: [{ id: "A", pressurePa: o.hydA ?? 20.7e6 }, { id: "B", pressurePa: 20.7e6 }], faults: [] } as unknown as NonNullable<MonitorContext["hydraulics"]>,
  switches: {}, pilot: { pitch: 0, roll: 0, yaw: 0 }
});
const lights = (m: ReturnType<typeof f16Monitor>, c: MonitorContext, s: number) => { let out = m.step(c, 0.05); for (let i = 0; i < s / 0.05; i++) out = m.step(c, 0.05); return out.lights.map((l) => l.text); };

describe("F-16C warning/caution logic (T.O. GR1F-16CJ-1, GE 129)", () => {
  it("ENGINE warning: sub-idle rpm (< 60 %), or FTIT above 1,100 °C for ≈2 s", () => {
    expect(lights(f16Monitor(), ctx({ n: 0.55 }), 0.1)).toContain("ENGINE");
    expect(lights(f16Monitor(), ctx({ n: 0.9 }), 0.1)).not.toContain("ENGINE");
    expect(lights(f16Monitor(), ctx({ egtK: 1120 + 273.15 }), 1)).not.toContain("ENGINE");
    expect(lights(f16Monitor(), ctx({ egtK: 1120 + 273.15 }), 2.5)).toContain("ENGINE");
  });

  it("HYD/OIL PRESS: immediately below 1,000 psi hydraulic; oil below 10 psi only after 30 s", () => {
    expect(lights(f16Monitor(), ctx({ hydA: 900 * 6894.757 }), 0.1)).toContain("HYD/OIL PRESS");
    // Oil pressure collapses in sustained negative g (pump inlet uncovered).
    const lowOil = ctx({ nz: -0.5 });
    expect(lights(f16Monitor(), lowOil, 20)).not.toContain("HYD/OIL PRESS");
    expect(lights(f16Monitor(), lowOil, 31)).toContain("HYD/OIL PRESS");
  });

  it("SEC caution in SEC; IGVs fixed fully closed in SEC", () => {
    const m = f16Monitor();
    expect(lights(m, ctx({ mode: "backup" }), 0.1)).toContain("SEC");
    expect(m.step(ctx({ mode: "backup" }), 0.05).indications["igvClosedFraction"]).toBe(1);
    expect(f16Monitor().step(ctx({ n: 0.95 }), 0.05).indications["igvClosedFraction"]).toBe(0);
  });
});
