import { describe, expect, it } from "vitest";
import { DebugFlyer, type FlyerControls } from "../../src/debug/DebugFlyer.js";

const deg = (r: number) => (r * 180) / Math.PI;
const fly = (f: DebugFlyer, seconds: number, controls?: Partial<FlyerControls>) => {
  if (controls) f.setControls({ ...f.snapshot().controls, ...controls });
  for (let i = 0; i < Math.round(seconds * 120); i++) f.scheduler.step();
  return f.snapshot();
};

describe("debug flyer (synthetic test airframe)", () => {
  const flyer = new DebugFlyer();

  it("starts level, heading north, airborne above synthetic terrain", () => {
    const s = flyer.snapshot();
    expect(deg(s.headingRad)).toBeCloseTo(0, 6);
    expect(deg(s.pitchRad)).toBeCloseTo(0, 6);
    expect(deg(s.rollRad)).toBeCloseTo(0, 6);
    expect(s.ground.kind).toBe("airborne");
  });

  it("flies hands-off without diverging", () => {
    const f = new DebugFlyer();
    const s = fly(f, 20);
    expect(s.ground.kind).toBe("airborne");
    expect(Math.abs(deg(s.rollRad))).toBeLessThan(20);
    expect(Math.abs(deg(s.pitchRad))).toBeLessThan(30);
    expect(s.trueAirspeedMps).toBeGreaterThan(100);
  });

  it("pitches up with back stick and banks/turns right with right stick", () => {
    const f = new DebugFlyer();
    const pulled = fly(f, 1.5, { pitch: 0.5 });
    expect(pulled.pitchRad).toBeGreaterThan(0.05);
    expect(pulled.loadFactorG).toBeGreaterThan(1.2);
    const g = new DebugFlyer();
    const rolled = fly(g, 0.7, { roll: 0.6 });
    expect(deg(rolled.rollRad)).toBeGreaterThan(15);
    const turned = fly(g, 6, { roll: 0, pitch: 0.25 });
    expect(turned.headingRad).toBeGreaterThan(0.1);
  });

  it("detects terrain impact and freezes", () => {
    const f = new DebugFlyer();
    fly(f, 2.5, { pitch: -0.4, throttle: 1 });
    let s = f.snapshot();
    f.setControls({ ...s.controls, pitch: 0 });
    for (let i = 0; i < 120 * 60 && s.ground.kind !== "crashed"; i++) { f.scheduler.step(); s = f.snapshot(); }
    expect(s.ground.kind).toBe("crashed");
    const after = fly(f, 1);
    expect(s.ground.kind === "crashed" && s.ground.impactSpeedMps).toBeGreaterThan(50);
    expect(after.positionEnuM).toEqual(s.positionEnuM);
  });

  it("is deterministic for any frame cadence", () => {
    const run = (dt: number, frames: number) => {
      const f = new DebugFlyer();
      f.setControls({ pitch: 0.2, roll: -0.3, yaw: 0.1, throttle: 0.9 });
      for (let i = 0; i < frames; i++) f.advanceFrame(dt);
      return f.snapshot();
    };
    expect(run(1 / 30, 150)).toEqual(run(1 / 144, 720));
  });
});
