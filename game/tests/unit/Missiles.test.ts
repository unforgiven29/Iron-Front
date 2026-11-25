/**
 * Shared missile flyout, launch zones against BP-29 and end-to-end engagements from the MiG-29.
 */
import { describe, expect, it } from "vitest";
import type { Vector3 } from "../../src/core/coordinates/CoordinateFrames.js";
import { MiG29WeaponControl } from "../../src/platforms/aircraft/mig29/avionics/MiG29WeaponControl.js";
import type { AircraftSnapshot } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { DEG } from "../../src/sensors/common/ScanGeometry.js";
import { SOVIET_AAM } from "../../src/weapons/catalog/SovietAirToAir.js";
import { closestApproach, launchZone, Missile } from "../../src/weapons/missiles/Missile.js";
import { SEEKER_9B1101K } from "../../src/weapons/catalog/SovietAirToAir.js";
import { SemiActiveSeeker } from "../../src/sensors/weapon-seeker/SemiActiveSeeker.js";
import { bistaticDoppler } from "../../src/physics/radar/RadarPhysics.js";
import { deriveHardware } from "../../src/sensors/radar/PulseDopplerRadar.js";
import { N019_PROFILE } from "../../src/platforms/aircraft/mig29/avionics/N019Profile.js";
import { norm, sub, unit } from "../../src/physics/sensing/SweepGeometry.js";
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
  let seekerTracked = false;
  let y = 0;
  for (let t = 0.02; t < seconds; t += 0.02) {
    y += 230 * 0.02;
    targets.step(0.02);
    missiles.step(0.02);
    if (missiles.states().some((m) => m.seekerLocked)) seekerTracked = true;
    onTick(wcs, t);
    wcs.step({ own: { timeS: t, positionEnuM: [0, y, 6000], velocityEnuMps: [0, 230, 0], bodyToWorld: NORTH, headingRad: 0, pitchRad: 0, rollRad: 0 }, snapshot: {} as AircraftSnapshot, scene: targets, head: { az: 0, el: 0 }, weapons: missiles }, 0.02);
  }
  return { wcs, targets, missiles, seekerTracked };
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
    const { missiles, targets, wcs, seekerTracked } = lockAndFire(true);
    expect(seekerTracked).toBe(true); // the 9B-1101K acquired and homed, not just radio correction
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

describe("9B-1101K semi-active seeker", () => {
  const n019 = deriveHardware(N019_PROFILE);
  const setup = (opts: { rangeKm: number; illum?: boolean; presetErrMps?: number; launcherBehind?: boolean; targetAlt?: number; missileAlt?: number }) => {
    const tAlt = opts.targetAlt ?? 6000, mAlt = opts.missileAlt ?? 6000;
    const tgt: AirTargetSpec = { id: "t", label: "t", signature: SIGNATURES.fighter, positionEnuM: [0, opts.rangeKm * 1000, tAlt], headingRad: Math.PI, speedMps: 230, throttle: 0.8 };
    const scene = new AirTargetWorld([tgt], flat);
    const sk = new SemiActiveSeeker(SEEKER_9B1101K, 3);
    const mPos: Vector3 = [0, 0, mAlt], mVel: Vector3 = [0, 600, 0];
    const illPos: Vector3 = opts.launcherBehind === false ? [0, opts.rangeKm * 2000, 6000] : [0, -8000, 6000];
    const illVel: Vector3 = [0, 250, 0];
    const tPos = scene.states()[0]!.positionEnuM, tVel = scene.states()[0]!.velocityEnuMps;
    const fd = bistaticDoppler(illPos, illVel, mPos, mVel, tPos, tVel, n019.wavelengthM) + ((opts.presetErrMps ?? 0) * 2) / n019.wavelengthM;
    sk.preset(unit(sub(tPos, mPos)), fd);
    const ill = opts.illum === false ? null : { positionEnuM: illPos, velocityEnuMps: illVel, erpW: 900 * n019.antenna.transmitGain, duty: 0.6, boresight: unit(sub(tPos, illPos)), pattern: n019.antenna, wavelengthM: n019.wavelengthM };
    let out = sk.step({ positionEnuM: mPos, velocityEnuMps: mVel, bodyAxis: [0, 1, 0], scene, illumination: ill, cue: null }, 0.02);
    for (let i = 0; i < 150; i++) out = sk.step({ positionEnuM: mPos, velocityEnuMps: mVel, bodyAxis: [0, 1, 0], scene, illumination: ill, cue: null }, 0.02);
    return out;
  };
  it("locks a 3 m²-class fighter 10 km ahead when illuminated by the N019", () => {
    expect(setup({ rangeKm: 10 }).status).toBe("track");
  });
  it("without illumination it sees nothing", () => {
    expect(setup({ rangeKm: 10, illum: false }).status).not.toBe("track");
  });
  it("with the launcher outside the rear reference cone there is no coherent reference", () => {
    const o = setup({ rangeKm: 10, launcherBehind: false });
    expect(o.status).not.toBe("track");
    expect(o.reason).toBe("no reference");
  });
  it("the velocity-gate search finds a target whose preset Doppler is off by 60 m/s, not one off by 400 m/s", () => {
    expect(setup({ rangeKm: 10, presetErrMps: 60 }).status).toBe("track");
    expect(setup({ rangeKm: 10, presetErrMps: 400 }).status).not.toBe("track");
  });
  it("received SNR falls with range (bistatic R⁻²·R⁻² law)", () => {
    expect(setup({ rangeKm: 30 }).snrDb).toBeLessThan(setup({ rangeKm: 10 }).snrDb);
  });
});

describe("missile systems: battery, fuze arming, inertial drift, flight model", { timeout: 60_000 }, () => {
  const fly = (spec: (typeof SOVIET_AAM)[keyof typeof SOVIET_AAM], seconds: number, target?: Vector3) => {
    const m = new Missile(`${spec.id}-t`, spec, [0, 0, 8000], [0, 250, 0], () => ({ illumination: null, targetEstimate: target ? { positionEnuM: target, velocityEnuMps: [0, 0, 0] } : null }));
    const scene = new AirTargetWorld([], flat);
    const trace: { t: number; mach: number; alpha: number; nav: number }[] = [];
    for (let t = 0.02; t < seconds && m.alive; t += 0.02) {
      m.step(scene, 0.02, () => 0);
      trace.push({ t, mach: m.state.mach, alpha: m.state.alphaRad, nav: norm(sub(m.navPosition(), m.state.positionEnuM)) });
    }
    return { m, trace };
  };
  it("the R-60M self-destructs when its 23 s of on-board power runs out (BP-29 p.24)", () => {
    const { m } = fly(SOVIET_AAM.R60M, 40);
    expect(m.alive).toBe(false);
    expect(m.state.reason).toBe("self-destruct");
    expect(m.state.timeS).toBeCloseTo(23, 0);
  });
  it("the motor accelerates the missile supersonic, then drag slows it in the coast", () => {
    const { trace } = fly(SOVIET_AAM.R27R, 30);
    const peak = Math.max(...trace.map((x) => x.mach));
    expect(peak).toBeGreaterThan(2.5);
    expect(trace[trace.length - 1]!.mach).toBeLessThan(peak);
  });
  it("inertial navigation error grows with flight time (gyro drift and accelerometer bias)", () => {
    const { trace } = fly(SOVIET_AAM.R27R, 40, [0, 40000, 8000]);
    const at = (t: number) => trace.find((x) => x.t >= t)!.nav;
    expect(at(30)).toBeGreaterThan(at(10) * 3);
    expect(at(30)).toBeGreaterThan(20);
  });
  it("the fuze does not arm inside the safe-separation distance", () => {
    const m = new Missile("f", SOVIET_AAM.R27R, [0, 0, 8000], [0, 250, 0], () => ({ illumination: null, targetEstimate: null }));
    m.step(new AirTargetWorld([], flat), 0.02, () => 0);
    expect(m.fuze(1)).toBe(false);
  });
  it("turning flies at an angle of attack (6-DoF body), not as a point mass", () => {
    const { trace } = fly(SOVIET_AAM.R73A, 6, [3000, 4000, 8000]);
    expect(Math.max(...trace.map((x) => x.alpha))).toBeGreaterThan(2 * DEG);
  });
});
