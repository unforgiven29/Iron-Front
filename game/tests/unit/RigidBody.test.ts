import { describe, expect, it } from "vitest";
import type { Quaternion, Vector3 } from "../../src/core/coordinates/CoordinateFrames.js";
import { RigidBody, rotateVector, sumLoads, validateMassProperties, type MassProperties, type RigidBodyState } from "../../src/physics/rigidbody/RigidBody.js";

const G: Vector3 = [0, 0, -9.80665];
const NO_G: Vector3 = [0, 0, 0];
/** Test-only mass properties; not any real vehicle. */
const BOX: MassProperties = { massKg: 100, inertiaKgM2: [[10, 0, 0], [0, 20, 0], [0, 0, 25]] };
/** Body FRD forward = east, right = south, down = down. */
const LEVEL_EAST: Quaternion = [1, 0, 0, 0];
const rest = (extra: Partial<RigidBodyState> = {}): RigidBodyState =>
  ({ positionEnuM: [0, 0, 1000], velocityEnuMps: [0, 0, 0], bodyToWorld: LEVEL_EAST, angularVelocityBodyRadps: [0, 0, 0], ...extra });
const closeVec = (a: Vector3, b: readonly number[], digits = 9) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i] as number, digits));
const norm = (v: Vector3) => Math.hypot(...v);

describe("RigidBody", () => {
  it("maps body FRD to ENU for the level-east reference attitude", () => {
    closeVec(rotateVector(LEVEL_EAST, [1, 0, 0]), [1, 0, 0]);
    closeVec(rotateVector(LEVEL_EAST, [0, 1, 0]), [0, -1, 0]);
    closeVec(rotateVector(LEVEL_EAST, [0, 0, 1]), [0, 0, -1]);
  });

  it("moves a free particle in a straight line", () => {
    const b = new RigidBody(BOX, rest({ velocityEnuMps: [3, -4, 5] }));
    for (let i = 0; i < 100; i++) b.step(0.01, { forces: [], gravityEnuMps2: NO_G });
    closeVec(b.state.positionEnuM, [3, -4, 1005]);
    closeVec(b.state.velocityEnuMps, [3, -4, 5]);
  });

  it("matches the analytic ballistic solution under gravity (RK4 is exact for constant acceleration)", () => {
    const b = new RigidBody(BOX, rest({ velocityEnuMps: [50, 0, 30] }));
    const dt = 1 / 120;
    for (let i = 0; i < 240; i++) b.step(dt, { forces: [], gravityEnuMps2: G });
    const t = 2;
    closeVec(b.state.positionEnuM, [100, 0, 1000 + 30 * t - 0.5 * 9.80665 * t * t], 8);
    closeVec(b.state.velocityEnuMps, [50, 0, 30 - 9.80665 * t], 9);
  });

  it("applies F = ma in world and body frames", () => {
    const b = new RigidBody(BOX, rest());
    const loads = b.step(1, { forces: [{ sourceId: "thrust", frame: "body.frd", forceN: [200, 0, 0] }], gravityEnuMps2: NO_G });
    closeVec(loads.forceEnuN, [200, 0, 0]);
    closeVec(b.state.velocityEnuMps, [2, 0, 0]);
    const yawedNorth: Quaternion = [Math.SQRT1_2, Math.SQRT1_2, 0, 0]; // forward -> north
    closeVec(rotateVector(yawedNorth, [1, 0, 0]), [0, 1, 0]);
    const c = new RigidBody(BOX, rest({ bodyToWorld: yawedNorth }));
    c.step(1, { forces: [{ sourceId: "thrust", frame: "body.frd", forceN: [200, 0, 0] }], gravityEnuMps2: NO_G });
    closeVec(c.state.velocityEnuMps, [0, 2, 0]);
  });

  it("an offset force produces moment r x F about the CG; a pure couple produces no net force", () => {
    const loads = sumLoads(LEVEL_EAST, [{ sourceId: "tail", frame: "body.frd", forceN: [0, 0, -100], applicationPointBodyM: [-5, 0, 0] }]);
    closeVec(loads.momentBodyNm, [0, -500, 0]); // (-5,0,0) x (0,0,-100) = (0,-500,0): nose-down pitch
    const couple = sumLoads(LEVEL_EAST, [
      { sourceId: "a", frame: "body.frd", forceN: [0, 10, 0], applicationPointBodyM: [1, 0, 0] },
      { sourceId: "b", frame: "body.frd", forceN: [0, -10, 0], applicationPointBodyM: [-1, 0, 0] }
    ]);
    closeVec(couple.forceEnuN, [0, 0, 0]);
    closeVec(couple.momentBodyNm, [0, 0, 20]);
  });

  it("sums contributions independent of order and rejects duplicates and non-finite loads", () => {
    const fs = [
      { sourceId: "b", frame: "world.enu" as const, forceN: [1e-17, 0.1, 0] as Vector3 },
      { sourceId: "a", frame: "body.frd" as const, forceN: [1, 2, 3] as Vector3, applicationPointBodyM: [0.3, 0.1, 0] as Vector3 },
      { sourceId: "c", frame: "world.enu" as const, forceN: [0.7, 0, 1e16] as Vector3 }
    ];
    expect(sumLoads(LEVEL_EAST, [...fs].reverse())).toEqual(sumLoads(LEVEL_EAST, fs));
    expect(() => sumLoads(LEVEL_EAST, [fs[0]!, fs[0]!])).toThrow("Duplicate");
    expect(() => sumLoads(LEVEL_EAST, [{ sourceId: "x", frame: "world.enu", forceN: [Number.NaN, 0, 0] }])).toThrow("non-finite");
  });

  it("keeps a torque-free spin about a principal axis constant", () => {
    const b = new RigidBody(BOX, rest({ angularVelocityBodyRadps: [0, 0, 2] }));
    for (let i = 0; i < 1200; i++) b.step(1 / 120, { forces: [], gravityEnuMps2: NO_G });
    closeVec(b.state.angularVelocityBodyRadps, [0, 0, 2], 12);
    // Yaw rate 2 rad/s about body-down for 10 s: heading turned by 20 rad (body down = world down).
    const fwd = rotateVector(b.state.bodyToWorld, [1, 0, 0]);
    expect(Math.atan2(fwd[1], fwd[0])).toBeCloseTo(Math.atan2(Math.sin(-20), Math.cos(-20)), 6);
  });

  it("conserves energy and world angular momentum in torque-free tumbling (intermediate axis)", () => {
    const b = new RigidBody(BOX, rest({ angularVelocityBodyRadps: [0.01, 3, 0.01] }));
    const e0 = b.rotationalEnergyJ();
    const h0 = b.angularMomentumEnu();
    let maxRoll = 0;
    for (let i = 0; i < 120 * 20; i++) {
      b.step(1 / 120, { forces: [], gravityEnuMps2: NO_G });
      maxRoll = Math.max(maxRoll, Math.abs(b.state.angularVelocityBodyRadps[0]));
    }
    expect(Math.abs(b.rotationalEnergyJ() - e0) / e0).toBeLessThan(1e-6);
    const h1 = b.angularMomentumEnu();
    expect(norm([h1[0] - h0[0], h1[1] - h0[1], h1[2] - h0[2]]) / norm(h0)).toBeLessThan(1e-6);
    expect(maxRoll).toBeGreaterThan(1); // the intermediate-axis spin is unstable and flips
    expect(Math.abs(Math.hypot(...b.state.bodyToWorld) - 1)).toBeLessThan(1e-12);
  });

  it("converges at 4th order as the step halves", () => {
    const run = (dt: number) => {
      const b = new RigidBody(BOX, rest({ angularVelocityBodyRadps: [0.4, 1.2, -0.7] }));
      for (let t = 0; t < Math.round(2 / dt); t++) b.step(dt, { forces: [], moments: [{ sourceId: "m", frame: "body.frd", momentNm: [1, -2, 0.5] }], gravityEnuMps2: G });
      return b.state.angularVelocityBodyRadps;
    };
    const ref = run(1 / 1600);
    const err = (dt: number) => { const w = run(dt); return norm([w[0] - ref[0], w[1] - ref[1], w[2] - ref[2]]); };
    const ratio = err(1 / 50) / err(1 / 100);
    expect(ratio).toBeGreaterThan(12);
    expect(ratio).toBeLessThan(20);
  });

  it("rejects non-physical mass properties and invalid states", () => {
    expect(validateMassProperties({ massKg: 0, inertiaKgM2: BOX.inertiaKgM2 })[0]).toContain("massKg");
    expect(validateMassProperties({ massKg: 1, inertiaKgM2: [[1, 0.5, 0], [0, 1, 0], [0, 0, 1]] })[0]).toContain("symmetric");
    expect(validateMassProperties({ massKg: 1, inertiaKgM2: [[1, 0, 0], [0, -1, 0], [0, 0, 1]] })[0]).toContain("positive definite");
    expect(validateMassProperties({ massKg: 1, inertiaKgM2: [[1, 0, 0], [0, 1, 0], [0, 0, 5]] })[0]).toContain("triangle inequality");
    expect(validateMassProperties({ massKg: 1, inertiaKgM2: [[2, 0.3, 0.1], [0.3, 3, 0.2], [0.1, 0.2, 4]] })).toEqual([]);
    expect(() => new RigidBody(BOX, rest({ bodyToWorld: [0, 0, 0, 2] }))).toThrow("unit quaternion");
    expect(() => new RigidBody(BOX, rest({ velocityEnuMps: [Number.POSITIVE_INFINITY, 0, 0] }))).toThrow("velocityEnuMps");
    const b = new RigidBody(BOX, rest());
    expect(() => b.step(0, { forces: [], gravityEnuMps2: G })).toThrow("dtSeconds");
  });

  it("supports mass change between steps", () => {
    const b = new RigidBody(BOX, rest());
    b.step(1, { forces: [{ sourceId: "f", frame: "world.enu", forceN: [100, 0, 0] }], gravityEnuMps2: NO_G });
    b.setMassProperties({ ...BOX, massKg: 50 });
    b.step(1, { forces: [{ sourceId: "f", frame: "world.enu", forceN: [100, 0, 0] }], gravityEnuMps2: NO_G });
    closeVec(b.state.velocityEnuMps, [3, 0, 0]);
    expect(() => b.setMassProperties({ ...BOX, massKg: -1 })).toThrow("massKg");
  });
});
