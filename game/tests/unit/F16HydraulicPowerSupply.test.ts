import { describe, expect, it } from "vitest";
import { F16_HYDRAULIC_INSTALLATION } from "../../src/platforms/aircraft/f16c-block50/F16Hydraulics.js";
import { HydraulicNetwork, type HydraulicStepOptions } from "../../src/systems/hydraulics/HydraulicNetwork.js";

const PSI = 6894.757, DT = 1 / 120;
const run = (net: HydraulicNetwork, s: number, drive = 1, opts: HydraulicStepOptions = {}, rates: Record<string, number> = {}) => {
  for (let i = 0; i < Math.round(s / DT); i++) net.step(DT, () => drive, rates, opts);
  return net.snapshot();
};
const psi = (net: HydraulicNetwork, id: string) => net.pressurePa(id) / PSI;

describe("F-16 hydraulic power supply (T.O. GR1F-16CJ-1 fig 1-33)", () => {
  it("FLCS accumulators sit behind check valves: after a dual pump loss the main systems fall but the flight controls stay pressurised long enough for the EPU", () => {
    const net = new HydraulicNetwork({ ...F16_HYDRAULIC_INSTALLATION, emergencyUnit: undefined } as never);
    run(net, 2);
    net.setFaults([{ kind: "pump-failed", pumpId: "pump.A" }, { kind: "pump-failed", pumpId: "pump.B" }]);
    run(net, 10);
    expect(psi(net, "A")).toBeLessThan(1000);
    expect(psi(net, "A.flcs")).toBeGreaterThan(1500);
    expect(net.rateFraction("elevator")).toBeGreaterThan(0.9);
    const loaded = { dynamicPressurePa: 40_000, deflectionDeg: 40, limitDeg: 60, movingAwayFromNeutral: true };
    expect(net.rateFraction("speedbrake", loaded)).toBeLessThan(0.4); // speedbrakes are on system A main, not the FLCS branch
    expect(net.rateFraction("elevator", loaded)).toBeGreaterThan(0.6);
  });

  it("brake/JFS accumulators recharge from system B in roughly 40–60 s", () => {
    const net = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    net.reset(false);
    let t = 0;
    while (psi(net, "B.brakes") < 2900 && t < 200) { net.step(0.05, () => 1, {}); t += 0.05; }
    expect(t).toBeGreaterThan(30);
    expect(t).toBeLessThan(75);
  });

  it("system B failure: brakes keep working from the accumulators for a number of applications", () => {
    const net = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    run(net, 2);
    net.setFaults([{ kind: "pump-failed", pumpId: "pump.B" }]);
    run(net, 20);
    expect(psi(net, "B")).toBeLessThan(1000);
    expect(net.supplyFraction("B.brakes")).toBeGreaterThan(0.8);
    // Hard braking with anti-skid cycling eventually exhausts them.
    run(net, 300, 1, { consumerDemand: { brakes: 1 } });
    expect(net.supplyFraction("B.brakes")).toBeLessThan(0.5);
  });

  it("LG isolation valve: closed, the gear branch is isolated from B; opened, it charges and the gear consumer draws flow", () => {
    const net = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    net.reset(false);
    run(net, 10);
    expect(psi(net, "B")).toBeGreaterThan(2900);
    expect(psi(net, "B.lg")).toBeLessThan(10);
    net.setValve("B.lg", true);
    const s = run(net, 1, 1, { consumerDemand: { gear: 1 } });
    expect(psi(net, "B.lg")).toBeGreaterThan(2000);
    expect(s.consumers!.find((c) => c.id === "gear")!.flowM3s).toBeGreaterThan(0);
  });

  it("FFP is a system A consumer; utilities are on B", () => {
    const net = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    const s = run(net, 1, 1, { consumerDemand: { ffp: 1, nws: 1 } });
    const node = (id: string) => s.consumers!.find((c) => c.id === id)!.nodeId;
    expect(node("ffp")).toBe("A");
    for (const id of ["gear", "nws", "brakes", "jfs", "gun", "airRefuel", "dragChute"]) expect(node(id).startsWith("B")).toBe(true);
  });

  it("an external leak drains the reservoir; once it is empty the pump cavitates and the system falls", () => {
    const net = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    run(net, 1);
    net.setFaults([{ kind: "external-leak", circuitId: "B", leakM3sPerPa: (2 * 6.309e-5) / (3000 * PSI) }]);
    let s = run(net, 30);
    expect(s.circuits.find((c) => c.id === "B")!.reservoirFraction!).toBeLessThan(0.7);
    s = run(net, 200);
    expect(s.circuits.find((c) => c.id === "B")!.reservoirM3).toBe(0);
    expect(psi(net, "B")).toBeLessThan(1000);
    expect(psi(net, "A")).toBeGreaterThan(2900);
  });

  it("fluid heats with use; the fuel/oil heat exchanger cools it once above the thermal bypass", () => {
    const busy = { elevator: 40, aileron: 60, rudder: 40 };
    const hot = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION), cooled = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    const a = run(hot, 600, 1, {}, busy);
    const b = run(cooled, 600, 1, { cooling: () => ({ sinkK: 300, conductanceWPerK: 400 }) }, busy);
    const T = (s: typeof a) => s.circuits.find((c) => c.id === "A")!.temperatureK!;
    expect(T(a)).toBeGreaterThan(330);
    expect(T(b)).toBeLessThan(T(a) - 10);
    expect(b.circuits.find((c) => c.id === "A")!.coolerBypassed).toBe(false);
    const cold = run(new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION), 1, 1, { cooling: () => ({ sinkK: 250, conductanceWPerK: 400 }) });
    expect(cold.circuits.find((c) => c.id === "A")!.coolerBypassed).toBe(true); // below the thermal-bypass temperature
  });
});
