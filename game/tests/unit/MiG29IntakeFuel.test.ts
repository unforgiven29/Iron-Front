import { describe, expect, it } from "vitest";
import { mig29FuelSystem } from "../../src/platforms/aircraft/mig29/MiG29FuelSystem.js";
import { mig29Intake, mig29IntakeSystem } from "../../src/platforms/aircraft/mig29/MiG29Intake.js";

const KT = 0.514444, D = Math.PI / 180;
const sensors = (o: { wow?: boolean; kias?: number; mach?: number; alphaDeg?: number }) => ({ nzG: 1, nyG: 0, weightOnWheels: o.wow ?? false, alphaRad: (o.alphaDeg ?? 3) * D, betaRad: 0, ratesRadps: [0, 0, 0] as const, dynamicPressurePa: 0.5 * 1.225 * ((o.kias ?? 300) * KT) ** 2, staticPressurePa: 101325, mach: o.mach ?? 0.5, trueAirspeedMps: (o.kias ?? 300) * KT, pitchRad: 0, rollRad: 0 });
const ctx = (o: Parameters<typeof sensors>[0] & { gear?: boolean; hyd?: number; n?: number }) => ({ sensors: sensors(o), gearDown: o.gear ?? false, engineSpeed: () => o.n ?? 0.9, hydraulicPressurePa: () => o.hyd ?? 21e6, throttle: 0.5 });
const run = (sys: ReturnType<typeof mig29IntakeSystem>, c: ReturnType<typeof ctx>, s: number) => { let st = sys.step(c, 0.01); for (let i = 0; i < s * 100; i++) st = sys.step(c, 0.01); return st["left"]!; };

describe("MiG-29 intakes (GAF T.O. 1F-MIG29-1) — dynamic ramps and louvers", () => {
  it("closes the duct on the ground below 108 KIAS (louvers open), opens above it, at a finite rate", () => {
    const sys = mig29IntakeSystem(["left"]);
    const fod = run(sys, ctx({ wow: true, kias: 40, gear: true }), 0.5);
    expect(fod.mode).toBe("FOD");
    expect(fod.rampExtension).toBeGreaterThan(0.2);
    expect(fod.rampExtension).toBeLessThan(1); // still moving
    const closed = run(sys, ctx({ wow: true, kias: 40, gear: true }), 3);
    expect(closed.rampExtension).toBe(1);
    expect(closed.auxOpen).toBe(true);
    const open = run(sys, ctx({ wow: true, kias: 130, gear: true }), 3);
    expect(open.rampExtension).toBe(0);
  });

  it("follows the supersonic schedules in flight; with no hydraulic pressure the ramps go fully open", () => {
    const sys = mig29IntakeSystem(["left"]);
    const m2 = run(sys, ctx({ mach: 2.1, kias: 700 }), 4);
    expect(m2.mode).toBe("SCHED 1");
    expect(m2.rampExtension).toBeGreaterThan(0.6);
    const noHyd = run(sys, ctx({ mach: 2.1, kias: 700, hyd: 2e6 }), 4);
    expect(noHyd.mode).toBe("NO HYD");
    expect(noHyd.rampExtension).toBe(0);
  });

  it("recovery: louver mode when the duct is closed; a ramp stuck open supersonic falls to pitot (normal-shock) recovery", () => {
    const inlet = mig29Intake();
    const st = (ext: number) => ({ weightOnWheels: false, equivalentAirspeedMps: 300, state: { rampExtension: ext, rampScheduled: ext, auxOpen: false, mode: "x", distortion: 0 } });
    expect(inlet.recovery(0.1, st(1))).toBeLessThan(0.95);
    expect(inlet.recovery(2.0, st(0))).toBeLessThan(inlet.recovery(2.0, st(0.7)) - 0.05);
  });
});

describe("MiG-29 fuel pumps and valves", () => {
  const step = (f: ReturnType<typeof mig29FuelSystem>, o: { flow?: number; rpm?: number; nz?: number; dc?: boolean }, s: number) => {
    for (let i = 0; i < s * 10; i++) f.step({ engineFlowKgS: { left: (o.flow ?? 1) / 2, right: (o.flow ?? 1) / 2 }, engineSpeed: { left: o.rpm ?? 1, right: o.rpm ?? 1 }, nzG: o.nz ?? 1, altitudeM: 3000, busPowered: () => o.dc ?? true }, 0.1);
  };
  it("keeps the feed tank full through 3 minutes of two-engine max afterburner (≈9 kg/s)", () => {
    const f = mig29FuelSystem(); f.reset();
    step(f, { flow: 9.4 }, 180);
    expect(f.tanks.kg("tank2")).toBeGreaterThan(f.tanks.spec("tank2").capacityKg - 5);
    expect(f.engineFuelAvailable("left")).toBe(true);
    expect(f.components!().pumps.find((p) => p.id === "tank3Turbo")!.running).toBe(true);
  });
  it("at negative g the accumulator feeds the engines for a few seconds, then they starve", () => {
    const f = mig29FuelSystem(); f.reset();
    step(f, { flow: 2, nz: -0.5 }, 2);
    expect(f.engineFuelAvailable("left")).toBe(true);
    expect(f.components!().flows.some((x) => x.from === "accumulator")).toBe(true);
    step(f, { flow: 2, nz: -0.5 }, 10);
    expect(f.engineFuelAvailable("left")).toBe(false);
  });
  it("without gearbox drive only gravity moves fuel (tank 1 → 2); the CL valve needs DC power", () => {
    const f = mig29FuelSystem(); f.reset();
    step(f, { flow: 0, rpm: 0.3 }, 1);
    expect(f.components!().pumps.find((p) => p.id === "activeFuel")!.running).toBe(false);
    const cl = mig29FuelSystem({ centerlineTank: true }); cl.reset();
    step(cl, { flow: 2, dc: false }, 60);
    expect(cl.components!().valves.find((v) => v.id === "clTransfer")!.open).toBe(false);
    expect(cl.tanks.kg("centerline")).toBeCloseTo(cl.tanks.spec("centerline").capacityKg, 3);
  });
});
