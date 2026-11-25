/**
 * Shared missile flyout, launch zones against BP-29 and end-to-end engagements from the MiG-29.
 */
import { describe, expect, it } from "vitest";
import type { Vector3 } from "../../src/core/coordinates/CoordinateFrames.js";
import { MiG29WeaponControl } from "../../src/platforms/aircraft/mig29/avionics/MiG29WeaponControl.js";
import type { AircraftSnapshot } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { DEG } from "../../src/sensors/common/ScanGeometry.js";
import { SOVIET_AAM } from "../../src/weapons/catalog/SovietAirToAir.js";
import { closestApproach, launchZone } from "../../src/weapons/missiles/Missile.js";
import { AirTargetWorld, SIGNATURES, type AirTargetSpec } from "../../src/world/targets/AirTargets.js";
import { MissileWorld } from "../../src/world/weapons/MissileWorld.js";

const NORTH = [0.7071068, 0.7071068, 0, 0] as const;
const flat = { heightAt: () => 0 };

describe("launch zones by flyout (BP-29 conditions: both at 10 km, 900 / 700 km/h)", { timeout: 60_000 }, () => {
  const zone = (spec: (typeof SOVIET_AAM)[keyof typeof SOVIET_AAM], alt: number, dir: number) =>
    launchZone(spec, { positionEnuM: [0, 0, alt], velocityEnuMps: [0, 250, 0] }, { losEnu: [0, 1, 0], velocityEnuMps: [0, dir * 194, 0] }).maxM / 1000;
  it("R-27R matches fig.17: ≈35 km head-on, ≈16 km tail at 10 km (±25 %)", () => {
    expect(zone(SOVIET_AAM.R27R, 10000, -1)).toBeGreaterThan(35 * 0.75);
    expect(zone(SOVIET_AAM.R27R, 10000, -1)).toBeLessThan(35 * 1.25);
    expect(zone(SOVIET_AAM.R27R, 10000, 1)).toBeGreaterThan(16 * 0.75);
    expect(zone(SOVIET_AAM.R27R, 10000, 1)).toBeLessThan(16 * 1.25);
  });
  it("thicker air shortens the zone (1 km vs 10 km) and the bigger-motor ER reaches further", () => {
    expect(zone(SOVIET_AAM.R27R, 1000, -1)).toBeLessThan(zone(SOVIET_AAM.R27R, 10000, -1) * 0.7);
    expect(zone(SOVIET_AAM.R27ER, 10000, -1)).toBeGreaterThan(zone(SOVIET_AAM.R27R, 10000, -1) * 1.2);
  });
  it("closest-approach check cannot tunnel: a 60 m step past a target still reports the 2 m miss", () => {
    expect(closestApproach([30, 2, 0] as Vector3, [-30, 2, 0] as Vector3)).toBeCloseTo(2, 6);
  });
});

function engage(target: AirTargetSpec, setup: (w: MiG29WeaponControl) => void, onTick: (w: MiG29WeaponControl, t: number) => void, seconds: number) {
  const wcs = new MiG29WeaponControl(11);
  const targets = new AirTargetWorld([target], flat);
  const missiles = new MissileWorld(targets, () => 0);
  setup(wcs);
  let y = 0;
  for (let t = 0.02; t < seconds; t += 0.02) {
    y += 230 * 0.02;
    targets.step(0.02);
    missiles.step(0.02);
    onTick(wcs, t);
    wcs.step({ own: { timeS: t, positionEnuM: [0, y, 6000], velocityEnuMps: [0, 230, 0], bodyToWorld: NORTH, headingRad: 0, pitchRad: 0, rollRad: 0 }, snapshot: {} as AircraftSnapshot, scene: targets, head: { az: 0, el: 0 }, weapons: missiles }, 0.02);
  }
  return { wcs, targets, missiles };
}

describe("engagements", { timeout: 120_000 }, () => {
  const headOn: AirTargetSpec = { id: "b", label: "b", signature: SIGNATURES.fighter, positionEnuM: [200, 22000, 6000], headingRad: Math.PI, speedMps: 220, throttle: 0.8 };
  const lockAndFire = (keepLock: boolean) => {
    let fired = false;
    return engage(headOn, (w) => { while (w.weapon?.id !== "r27r") { w.key("f", true); w.key("f", false); } }, (w, t) => {
      if (t > 1 && t < 1.05) w.radar.designate({ look: { az: 200 / 22000, el: 0 }, frame: "stabilized", rangeM: 21500, rangeWindowM: 10000 });
      if (!fired && w.radar.state === "track" && t > 5) { w.key("l", true); w.key("l", false); fired = true; }
      if (fired && !keepLock && w.radar.state === "track") w.radar.breakLock("pilot");
    }, 60);
  };
  it("R-27R: radar lock → launch → the target is destroyed while the radar illuminates", () => {
    const { missiles, targets, wcs } = lockAndFire(true);
    expect(missiles.events().some((e) => e.kind === "launch")).toBe(true);
    expect(missiles.events().some((e) => e.kind === "kill")).toBe(true);
    expect(targets.states()).toHaveLength(0);
    expect(wcs.weapon?.id).not.toBe("r27r"); // the only R-27R is gone; selection moved on
  });
  it("R-27R: breaking lock after launch (no illumination, no radio correction) loses the target", () => {
    const { missiles, targets } = lockAndFire(false);
    expect(missiles.events().some((e) => e.kind === "kill")).toBe(false);
    expect(targets.states()).toHaveLength(1);
  });
  it("R-60M: IRST lock on a tail-on target, seeker lock on the rail, launch → kill", () => {
    const tail: AirTargetSpec = { id: "t", label: "t", signature: SIGNATURES.fighter, positionEnuM: [100, 3500, 6000], headingRad: 0, speedMps: 200, throttle: 1, afterburner: 1 };
    let fired = false;
    const { missiles } = engage(tail, (w) => { w.set("master", "ТП"); while (w.weapon?.id !== "r60m") { w.key("f", true); w.key("f", false); } }, (w, t) => {
      if (t > 0.5 && t < 0.55) w.kols.designate({ az: 0, el: 0 }, "body", 4 * DEG, 6 * DEG);
      if (!fired && w.kols.state === "track" && t > 3) { w.key("l", true); w.key("l", false); fired = true; }
    }, 30);
    expect(missiles.events().some((e) => e.kind === "launch")).toBe(true);
    expect(missiles.events().some((e) => e.kind === "kill")).toBe(true);
  });
});

describe("HMS and radar automation", () => {
  it("HMS lock follows the head while acquiring instead of holding the first direction", () => {
    const w = new MiG29WeaponControl();
    w.set("master", "ШЛЕМ");
    const scene = new AirTargetWorld([], flat);
    const step = (t: number, az: number) => w.step({ own: { timeS: t, positionEnuM: [0, 0, 6000], velocityEnuMps: [0, 230, 0], bodyToWorld: NORTH, headingRad: 0, pitchRad: 0, rollRad: 0 }, snapshot: {} as AircraftSnapshot, scene, head: { az, el: 0 } }, 0.02);
    step(0.02, 0);
    w.key("enter", true); w.key("enter", false);
    step(0.04, 0);
    step(0.06, 20 * DEG);
    expect(w.kols.head.look.az).toBeCloseTo(20 * DEG, 3);
  });
  it("the sidelobe guard is automatic: there is no key for it and it is always on", () => {
    const w = new MiG29WeaponControl();
    expect(w.controls.some((c) => c.key === "c")).toBe(false);
    expect(w.state.compensation).toBe(true);
  });
});
