import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { actuatorRateFraction, HydraulicNetwork } from "../../src/systems/hydraulics/HydraulicNetwork.js";
import { createF16Aircraft, F16_SWITCHES } from "../../src/platforms/aircraft/f16c-block50/F16Aircraft.js";
import { F16_HYDRAULIC_INSTALLATION } from "../../src/platforms/aircraft/f16c-block50/F16Hydraulics.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const PSI = 6894.757, DT = 1 / 120;
const run = (net: HydraulicNetwork, seconds: number, drive = 1, rates: Record<string, number> = {}) => {
  let snap = net.snapshot();
  for (let i = 0; i < Math.round(seconds / DT); i++) snap = net.step(DT, () => drive, rates);
  return snap;
};
const psi = (snap: ReturnType<HydraulicNetwork["snapshot"]>, id: string) => (snap.circuits.find((c) => c.id === id)?.pressurePa ?? 0) / PSI;

describe("Hydraulic network (shared) with the F-16 A/B installation", () => {
  it("holds both systems near 3000 psi with engines running and nothing moving", () => {
    const s = run(new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION), 5);
    expect(psi(s, "A")).toBeGreaterThan(2900);
    expect(psi(s, "A")).toBeLessThan(3200);
    expect(psi(s, "B")).toBeGreaterThan(2900);
    expect(s.emergencyUnit?.state).toBe("off");
  });

  it("servo-valve authority: full with both systems, reduced (≈70 %) on one, none with neither", () => {
    expect(actuatorRateFraction([1, 1], 1 / 3)).toBeCloseTo(1, 9);
    expect(actuatorRateFraction([1, 0], 1 / 3)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(actuatorRateFraction([0, 0], 1 / 3)).toBe(0);
  });

  it("a failed pump bleeds its system down; dual-fed surfaces keep reduced rate, A-only speedbrake stops", () => {
    const net = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    net.setFaults([{ kind: "pump-failed", pumpId: "pump.A" }]);
    // The FLCS accumulator holds the failed system near its precharge for a while, then it bleeds away.
    const s = run(net, 300);
    expect(psi(s, "A")).toBeLessThan(1000);
    expect(psi(s, "B")).toBeGreaterThan(2900);
    expect(net.rateFraction("elevator")).toBeGreaterThan(0.5);
    expect(net.rateFraction("elevator")).toBeLessThan(0.75);
    expect(net.rateFraction("speedbrake")).toBeLessThan(0.2);
  });

  it("dual loss: accumulators bridge, the EPU starts after its delay and repressurises System A, then runs out", () => {
    const net = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    net.setFaults([{ kind: "pump-failed", pumpId: "pump.A" }, { kind: "pump-failed", pumpId: "pump.B" }]);
    let s = run(net, 1);
    expect(psi(s, "A")).toBeGreaterThan(1500); // accumulator + compliance still hold pressure
    s = run(net, 120);
    expect(s.emergencyUnit?.state).toBe("running");
    expect(psi(s, "A")).toBeGreaterThan(2500);
    expect(psi(s, "B")).toBeLessThan(1000);
    s = run(net, 600);
    expect(s.emergencyUnit?.state).toBe("depleted");
  });

  it("heavy simultaneous surface motion pulls pressure down (finite pump flow)", () => {
    const quiet = run(new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION), 2);
    const busy = run(new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION), 2, 1, { elevator: 60, aileron: 80, rudder: 120, speedbrake: 30 });
    expect(psi(busy, "A")).toBeLessThan(psi(quiet, "A") - 50);
  });

  it("pumps follow engine speed: no engine, no pressure (until the EPU)", () => {
    const net = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    const s = run(net, 300, 0);
    expect(psi(s, "B")).toBeLessThan(1000);
    expect(s.emergencyUnit?.state).not.toBe("off");
  });
});

describe("Hydraulics in the flying F-16", () => {
  const terrain = new TerrainSurface();
  terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 10, featureSizeM: 20000 }));
  const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
  /** Fastest roll-surface movement on a full roll input, after `waitS` with the fault set. */
  const surfaceRate = (fault: string, waitS: number) => {
    const a = createF16Aircraft(terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 220, throttle: 0.7 });
    a.controls.request(F16_SWITCHES.hydraulicFault, fault, "test");
    for (let i = 0; i < 120 * waitS; i++) a.stepTick();
    a.setPilotInputs({ pitch: 0, roll: 1, yaw: 0 });
    let last = a.snapshot().surfaces["aileron"] ?? 0, rate = 0;
    for (let i = 0; i < 60; i++) { a.stepTick(); const now = a.snapshot().surfaces["aileron"] ?? 0; rate = Math.max(rate, Math.abs(now - last) * 120); last = now; }
    return { rate, snap: a.snapshot() };
  };

  it("reports both systems in the snapshot; with one system bled down the roll surfaces move ≈70 % as fast", () => {
    const normal = surfaceRate("NORMAL", 1), single = surfaceRate("B PUMP FAIL", 300);
    expect(normal.snap.hydraulics?.circuits.length).toBe(2);
    expect(normal.rate).toBeGreaterThan(60); // the shaped roll command, not the 80°/s actuator limit, sets this
    expect(single.rate).toBeLessThan(0.8 * normal.rate);
    expect(single.rate).toBeGreaterThan(0.6 * normal.rate);
  });
});
