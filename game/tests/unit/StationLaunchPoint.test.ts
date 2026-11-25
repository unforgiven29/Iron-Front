import { describe, expect, it } from "vitest";
import { stationLaunchPoint } from "../../src/platforms/aircraft/common/Avionics.js";
import { MIG29_STORES } from "../../src/platforms/aircraft/mig29/MiG29Stores.js";
import { F16_STORES } from "../../src/platforms/aircraft/f16c-block50/F16Stores.js";
import { debugReport } from "../../src/app/DebugOverlay.js";

// Body FRD → ENU for heading north, wings level: x → +N, y (right) → +E, z (down) → −U.
const s = Math.SQRT1_2;
const own = { timeS: 0, positionEnuM: [100, 200, 3000] as [number, number, number], velocityEnuMps: [0, 200, 0] as [number, number, number],
  bodyToWorld: [s, s, 0, 0] as [number, number, number, number], headingRad: 0, pitchRad: 0, rollRad: 0 };

describe("station launch points", () => {
  it("every station of both aircraft has a launch point, mirrored left/right", () => {
    for (const plan of [MIG29_STORES, F16_STORES]) {
      const n = plan.stations.length;
      for (let i = 0; i < n; i++) {
        const a = plan.stations[i]!.launchPointM!, b = plan.stations[n - 1 - i]!.launchPointM!;
        expect(a, plan.stations[i]!.id).toBeDefined();
        expect(a[1]).toBeCloseTo(-b[1], 9);
      }
    }
  });

  it("left pylon launches left of the aircraft, right pylon right, both below the CG", () => {
    const rot = (v: [number, number, number]) => { // check the test quaternion maps body x to north
      const p = stationLaunchPoint({ stations: [{ id: "t", label: "t", allowed: [], launchPointM: v }] }, 0, own);
      return [p[0] - 100, p[1] - 200, p[2] - 3000];
    };
    const fwd = rot([1, 0, 0]);
    expect(fwd[1]).toBeCloseTo(1, 6);
    const l = stationLaunchPoint(MIG29_STORES, 0, own), r = stationLaunchPoint(MIG29_STORES, 5, own);
    const right = rot([0, 1, 0]);
    const side = (p: readonly number[]) => (p[0]! - 100) * right[0]! + (p[1]! - 200) * right[1]! + (p[2]! - 3000) * right[2]!;
    expect(side(l)).toBeLessThan(-3);
    expect(side(r)).toBeGreaterThan(3);
    expect(Math.abs(l[0] - r[0]) + Math.abs(l[1] - r[1])).toBeGreaterThan(6);
  });

  it("falls back to 1.5 m below the CG for a station without geometry", () => {
    const p = stationLaunchPoint({ stations: [{ id: "x", label: "x", allowed: [] }] }, 0, own);
    expect(Math.hypot(p[0] - 100, p[1] - 200, p[2] - 3000)).toBeCloseTo(1.5, 6);
  });
});

describe("debug report", () => {
  it("lists avionics status, missiles, events and truth targets", () => {
    const text = debugReport({
      timeS: () => 12.3, ownPositionEnuM: () => [0, 0, 1000],
      avionics: () => ({ radar: "TRACK", lockRangeM: 25000, loss: "" }),
      missiles: () => [{ id: "m1", type: "R-27R", side: "blue", timeS: 4, positionEnuM: [0, 5000, 1000], velocityEnuMps: [0, 800, 0], phase: "coast", seeker: "LOCKED" }],
      events: () => [{ timeS: 8.3, missileId: "m1", kind: "launch", detail: "p3" }],
      truthTargets: () => [{ id: "bandit-1", positionEnuM: [0, 30000, 5000], destroyed: false }]
    });
    for (const want of ["TRACK", "25000", "R-27R", "800 m/s", "5.0 km", "LAUNCH", "bandit-1", "30.3 km"]) expect(text).toContain(want);
  });
});
