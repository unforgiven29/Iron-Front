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

  it("servo-valve authority: rate falls with hinge load, more on one system; aiding loads don't slow it; no pressure holds", () => {
    expect(actuatorRateFraction([1, 1], 0)).toBe(1);
    expect(actuatorRateFraction([1, 0], 0)).toBe(1); // unloaded: one tandem chamber still moves the surface at full rate
    expect(actuatorRateFraction([1, 1], 0.3)).toBeCloseTo(Math.sqrt(0.7), 9);
    expect(actuatorRateFraction([1, 0], 0.3)).toBeCloseTo(Math.sqrt(0.4), 9);
    expect(actuatorRateFraction([1, 0], 0.6)).toBe(0); // stalled: one chamber cannot overcome the load
    expect(actuatorRateFraction([1, 1], -0.3)).toBe(1); // load aiding the motion
    expect(actuatorRateFraction([0, 0], 0)).toBe(0);
  });

  it("a failed pump bleeds its system down; dual-fed surfaces keep reduced rate, A-only speedbrake stops", () => {
    const net = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    net.setFaults([{ kind: "pump-failed", pumpId: "pump.A" }]);
    // The FLCS accumulator holds the failed system near its precharge for a while, then it bleeds away.
    const s = run(net, 300);
    expect(psi(s, "A")).toBeLessThan(1000);
    expect(psi(s, "B")).toBeGreaterThan(2900);
    const loaded = { dynamicPressurePa: 30_000, deflectionDeg: 12, limitDeg: 25, movingAwayFromNeutral: true };
    const healthy = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    expect(net.rateFraction("elevator", loaded)).toBeGreaterThan(0.5);
    expect(net.rateFraction("elevator", loaded)).toBeLessThan(healthy.rateFraction("elevator", loaded) - 0.05);
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

describe("Hinge loads and the hydraulic leading-edge flaps", () => {
  it("surfaces move slower against air load at high dynamic pressure and large deflection, not when returning", () => {
    const net = new HydraulicNetwork(F16_HYDRAULIC_INSTALLATION);
    const at = (q: number, defl: number, away: boolean) => net.rateFraction("elevator", { dynamicPressurePa: q, deflectionDeg: defl, limitDeg: 25, movingAwayFromNeutral: away });
    expect(at(2_000, 20, true)).toBeGreaterThan(0.98);
    expect(at(60_000, 20, true)).toBeLessThan(0.75);
    expect(at(60_000, 20, true)).toBeLessThan(at(60_000, 5, true));
    expect(at(60_000, 20, false)).toBe(1);
  });

  it("the F-16 leading-edge flaps are a hydraulic actuator following the TP-1538 schedule", () => {
    const terrain = new TerrainSurface();
    terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 10, featureSizeM: 20000 }));
    const a = createF16Aircraft(terrain, { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) }, { positionEnuM: [0, 0, 4000], headingRad: 0, speedMps: 150, throttle: 0.8 });
    a.setPilotInputs({ pitch: 1, roll: 0, yaw: 0 });
    let lefMax = 0, lastLef = 0, lefRate = 0;
    for (let i = 0; i < 120 * 4; i++) { a.stepTick(); const l = a.snapshot().surfaces["lef"] ?? 0; lefRate = Math.max(lefRate, Math.abs(l - lastLef) * 120); lastLef = l; lefMax = Math.max(lefMax, l); }
    expect(lefMax).toBeGreaterThan(15); // deflects at high alpha
    expect(lefRate).toBeLessThanOrEqual(25 + 1e-6); // 25°/s actuator (TP-1538)
    expect(a.snapshot().hydraulics?.circuits.every((c) => c.pressurePa > 2000 * PSI)).toBe(true);
  });
});

describe("Hydraulics in the flying F-16", () => {
  const terrain = new TerrainSurface();
  terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 10, featureSizeM: 20000 }));
  const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
  /** Time for the roll surface to reach 15° on a full roll input at high dynamic pressure, after `waitS` with the fault set. */
  const timeTo15 = (fault: string, waitS: number) => {
    const a = createF16Aircraft(terrain, env, { positionEnuM: [0, 0, 1000], headingRad: 0, speedMps: 300, throttle: 0.8 });
    a.controls.request(F16_SWITCHES.hydraulicFault, fault, "test");
    for (let i = 0; i < 120 * waitS; i++) a.stepTick();
    // DIRECT (test) mode: full stick commands full roll-surface deflection regardless of roll rate.
    a.controls.request(F16_SWITCHES.flcsMode, "DIRECT", "test");
    a.setPilotInputs({ pitch: 0, roll: 1, yaw: 0 });
    let t = 0;
    while (Math.abs(a.snapshot().surfaces["aileron"] ?? 0) < 15 && t < 3) { a.stepTick(); t += 1 / 120; }
    return { t, snap: a.snapshot() };
  };

  it("reports both systems in the snapshot; under high air load the roll surfaces move slower on one system", () => {
    const normal = timeTo15("NORMAL", 1), single = timeTo15("B PUMP FAIL", 300);
    expect(normal.snap.hydraulics?.circuits.length).toBe(2);
    expect(normal.t).toBeLessThan(1);
    expect(single.t).toBeGreaterThan(1.1 * normal.t);
  });
});
