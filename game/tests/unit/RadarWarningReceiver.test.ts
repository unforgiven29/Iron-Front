import { describe, expect, it } from "vitest";
import type { Quaternion, Vector3 } from "../../src/core/coordinates/CoordinateFrames.js";
import { friisPowerW, rfInterceptsAt, type RfEmitter } from "../../src/physics/radar/RfEmission.js";
import { EMPTY_SENSOR_SCENE, type SensorScene } from "../../src/physics/sensing/SensorScene.js";
import { amplitudeBearing, RadarWarningReceiver, type RwrProfile } from "../../src/sensors/rwr/RadarWarningReceiver.js";
import { ALR56M_PROFILE, alr56mDisplay } from "../../src/platforms/aircraft/f16c-block50/avionics/ALR56M.js";
import { HostileFighter, NOTIONAL_FIGHTER_RADAR } from "../../src/world/combat/HostileFighters.js";
import { NotionalMissileWorld } from "../../src/world/weapons/NotionalMissiles.js";
import { NOTIONAL_AAM } from "../../src/weapons/catalog/NotionalAirToAir.js";
import { SIGNATURES } from "../../src/world/targets/AirTargets.js";

const D = Math.PI / 180;
/** Level flight heading north: body x (forward) = north, y (right) = east, z = down. Quaternion [x,y,z,w] body→ENU. */
const NORTH: Quaternion = (() => {
  // Rotation taking FRD (1,0,0)→(0,1,0), (0,1,0)→(1,0,0), (0,0,1)→(0,0,−1): 180° about (1,1,0)/√2.
  const s = Math.SQRT1_2;
  return [s, s, 0, 0];
})();
const own = (t: number, p: Vector3 = [0, 0, 5000]) => ({ timeS: t, positionEnuM: p, bodyToWorld: NORTH, headingRad: 0 });

function emitter(p: Vector3, look: Vector3, over: Partial<RfEmitter> = {}): RfEmitter {
  const r = NOTIONAL_FIGHTER_RADAR;
  return { positionEnuM: p, boresightStartEnu: look, boresightEndEnu: look, pattern: r.pattern, carrierHz: 9.8e9, peakPowerW: r.track.peakPowerW, cw: false, prfHz: r.track.prfHz, pulseWidthS: r.track.pulseWidthS, radiating: true, ...over };
}
const sceneOf = (list: () => RfEmitter[]): SensorScene => ({ ...EMPTY_SENSOR_SCENE, rf: (q) => rfInterceptsAt(q, list()) });
const toward = (a: Vector3, b: Vector3): Vector3 => { const d: Vector3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const n = Math.hypot(...d); return [d[0] / n, d[1] / n, d[2] / n]; };
function run(rwr: RadarWarningReceiver, scene: SensorScene, seconds: number, t0 = 0) { let t = t0; for (let i = 0; i < seconds * 50; i++) { t += 0.02; rwr.step(own(t), scene, 0.02); } return t; }

describe("direct-path RF interception", () => {
  it("falls with range squared and with the antenna pointed away; silent emitters are absent", () => {
    const rx: Vector3 = [0, 0, 5000];
    const near = rfInterceptsAt({ positionEnuM: rx, timeS: 0, dtS: 0.02 }, [emitter([0, 10000, 5000], toward([0, 10000, 5000], rx))])[0]!;
    const far = rfInterceptsAt({ positionEnuM: rx, timeS: 0, dtS: 0.02 }, [emitter([0, 20000, 5000], toward([0, 20000, 5000], rx))])[0]!;
    expect(near.isotropicPowerW / far.isotropicPowerW).toBeCloseTo(4, 3);
    const away = rfInterceptsAt({ positionEnuM: rx, timeS: 0, dtS: 0.02 }, [emitter([0, 10000, 5000], [0, 1, 0])])[0]!;
    expect(10 * Math.log10(near.isotropicPowerW / away.isotropicPowerW)).toBeCloseTo(30, 1); // sidelobe floor
    expect(rfInterceptsAt({ positionEnuM: rx, timeS: 0, dtS: 0.02 }, [emitter([0, 10000, 5000], [0, -1, 0], { radiating: false })])).toEqual([]);
    expect(friisPowerW(1, 1, 299_792_458, 1)).toBeCloseTo((1 / (4 * Math.PI)) ** 2, 9);
  });

  it("is masked by terrain between emitter and receiver", () => {
    const ridge = { heightAt: (_x: number, y: number) => (Math.abs(y - 5000) < 500 ? 9000 : 0) };
    expect(rfInterceptsAt({ positionEnuM: [0, 0, 5000], timeS: 0, dtS: 0.02 }, [emitter([0, 10000, 5000], [0, -1, 0])], ridge)).toEqual([]);
  });

  it("a beam sweeping across the receiver inside one tick is seen at main-lobe level", () => {
    const rx: Vector3 = [0, 0, 5000], tx: Vector3 = [0, 30000, 5000];
    const sweep = { ...emitter(tx, [0.2, -1, 0]), boresightEndEnu: [-0.2, -1, 0] as Vector3 };
    const steady = emitter(tx, toward(tx, rx));
    const a = rfInterceptsAt({ positionEnuM: rx, timeS: 0, dtS: 0.02 }, [sweep])[0]!.isotropicPowerW;
    const b = rfInterceptsAt({ positionEnuM: rx, timeS: 0, dtS: 0.02 }, [steady])[0]!.isotropicPowerW;
    expect(10 * Math.log10(b / a)).toBeLessThan(1);
  });
});

describe("RWR engine", () => {
  it("amplitude comparison recovers the bearing between two antennas", () => {
    const ants = ALR56M_PROFILE.antennas;
    const gain = (a: (typeof ants)[number], az: number) => a.peakGainDbi - 12 * (Math.atan2(Math.sin(az - a.azimuthRad), Math.cos(az - a.azimuthRad)) / a.beamwidthRad) ** 2;
    for (const deg of [0, 20, 70, -100, 170]) expect(amplitudeBearing(ants, ants.map((a) => gain(a, deg * D))) / D).toBeCloseTo(deg, 0);
  });

  it("detects a head-on emitter with a bearing error of a few degrees, no range, and the right symbol", () => {
    const rwr = new RadarWarningReceiver(ALR56M_PROFILE, 1);
    const tx: Vector3 = [8000, 40000, 6000];
    run(rwr, sceneOf(() => [emitter(tx, toward(tx, [0, 0, 5000]), { prfHz: 12e3, pulseWidthS: 1.1e-6, peakPowerW: 19e3 })]), 2);
    const c = rwr.contacts();
    expect(c).toHaveLength(1);
    expect(Math.abs(c[0]!.bearingRad / D - Math.atan2(8000, 40000) / D)).toBeLessThan(8);
    expect(c[0]!.match?.entry.symbol).toBe("16");
    expect(Object.keys(c[0]!)).not.toContain("rangeM");
  });

  it("is silent with no emitters, out-of-band emitters, emitters below sensitivity and when unpowered", () => {
    const rwr = new RadarWarningReceiver(ALR56M_PROFILE, 2);
    run(rwr, sceneOf(() => []), 1);
    expect(rwr.contacts()).toEqual([]);
    run(rwr, sceneOf(() => [emitter([0, 5000, 5000], [0, -1, 0], { carrierHz: 35e9 })]), 1);
    expect(rwr.contacts()).toEqual([]);
    expect(rwr.lastStep.outOfBand).toBe(1);
    // Low-power emitter pointed away at long range: below sensitivity.
    run(rwr, sceneOf(() => [emitter([0, 150000, 5000], [0, 1, 0], { peakPowerW: 10 })]), 1);
    expect(rwr.contacts()).toEqual([]);
    rwr.setPower(false);
    run(rwr, sceneOf(() => [emitter([0, 5000, 5000], [0, -1, 0])]), 1);
    expect(rwr.contacts()).toEqual([]);
  });

  it("infers steady illumination from a held beam, not from a scanning one", () => {
    const tx: Vector3 = [0, 30000, 6000];
    const held = new RadarWarningReceiver(ALR56M_PROFILE, 3);
    run(held, sceneOf(() => [emitter(tx, toward(tx, [0, 0, 5000]))]), 2);
    expect(held.contacts()[0]?.steadyIllumination).toBe(true);
    // Scanning ±60° at 60°/s: intermittent main-lobe hits.
    const scan = new RadarWarningReceiver(ALR56M_PROFILE, 3);
    let t = 0, prev: Vector3 = [0, -1, 0];
    for (let i = 0; i < 8 * 50; i++) {
      t += 0.02;
      const ph = (t % 4) / 4, az = Math.PI + (ph < 0.5 ? -1 + 4 * ph : 3 - 4 * ph) * 60 * D;
      const now: Vector3 = [Math.sin(az), Math.cos(az), 0];
      const e = { ...emitter(tx, prev, { prfHz: 12e3, pulseWidthS: 1.1e-6, peakPowerW: 19e3 }), boresightEndEnu: now };
      prev = now;
      scan.step(own(t), sceneOf(() => [e]), 0.02);
    }
    expect(scan.contacts().length).toBe(1);
    expect(scan.contacts()[0]!.steadyIllumination).toBe(false);
  });

  it("an unknown emitter stays unknown; overlapping library entries are flagged ambiguous", () => {
    const rwr = new RadarWarningReceiver(ALR56M_PROFILE, 4);
    run(rwr, sceneOf(() => [emitter([0, 20000, 5000], [0, -1, 0], { carrierHz: 5.5e9, prfHz: 2000 })]), 1);
    expect(rwr.contacts()[0]?.match).toBeNull();
    const twin: RwrProfile = { ...ALR56M_PROFILE, library: [...ALR56M_PROFILE.library, { ...ALR56M_PROFILE.library[0]!, id: "copy", symbol: "X" }] };
    const amb = new RadarWarningReceiver(twin, 4);
    run(amb, sceneOf(() => [emitter([0, 20000, 5000], [0, -1, 0])]), 1);
    expect(amb.contacts()[0]?.ambiguous).toBe(true);
    expect(amb.contacts()[0]?.match?.confidence).toBeCloseTo(0.5, 6);
  });

  it("tracks coast and drop after the emitter falls silent", () => {
    const rwr = new RadarWarningReceiver(ALR56M_PROFILE, 5);
    let on = true;
    const scene = sceneOf(() => [emitter([0, 20000, 5000], [0, -1, 0], { radiating: on })]);
    let t = run(rwr, scene, 1);
    on = false;
    t = run(rwr, scene, 3, t);
    expect(rwr.contacts()).toHaveLength(1);
    run(rwr, scene, 4, t);
    expect(rwr.contacts()).toHaveLength(0);
  });

  it("is repeatable for a given seed", () => {
    const a = new RadarWarningReceiver(ALR56M_PROFILE, 9), b = new RadarWarningReceiver(ALR56M_PROFILE, 9);
    const s = sceneOf(() => [emitter([12000, 25000, 5000], toward([12000, 25000, 5000], [0, 0, 5000]))]);
    run(a, s, 1); run(b, s, 1);
    expect(a.contacts()[0]!.bearingRad).toBe(b.contacts()[0]!.bearingRad);
  });
});

describe("installed fits", () => {
  it("an active AIM-120-class seeker shows as a missile on the ALR-56M", () => {
    const seeker = () => [emitter([0, 2500, 5000], [0, -1, 0], { carrierHz: 15.5e9, prfHz: 120e3, pulseWidthS: 0.6e-6, peakPowerW: 500, pattern: { peakGainDbi: 24, beamwidthRad: 9 * D, sidelobeDb: -20 } })];
    const alr = new RadarWarningReceiver(ALR56M_PROFILE, 7);
    run(alr, sceneOf(seeker), 1);
    expect(alr.contacts()[0]?.match?.entry.category).toBe("missile-seeker");
  });

  it("displays draw contacts and an OFF state", () => {
    const rwr = new RadarWarningReceiver(ALR56M_PROFILE, 8);
    run(rwr, sceneOf(() => [emitter([0, 20000, 5000], [0, -1, 0])]), 2);
    expect(alr56mDisplay(rwr.contacts(), true, true).some((p) => p.kind === "text" && p.text === "16")).toBe(true);
    expect(alr56mDisplay([], false, true).some((p) => p.kind === "text" && p.text === "OFF")).toBe(true);
  });
});

describe("emitters in the world", () => {
  it("a hostile fighter scans when it has no contact and holds its beam on a contact it sees", () => {
    const env = (seen: boolean) => ({ opponents: () => (seen ? [{ id: "p", side: "blue" as const, positionEnuM: [0, 30000, 5000] as Vector3, velocityEnuMps: [0, 0, 0] as Vector3 }] : []), threats: () => [], groundHeightAt: () => 0, fire: () => undefined, missileInFlight: () => false });
    const spec = { id: "h", label: "h", modelId: "x", signature: SIGNATURES.fighter, side: "red" as const, positionEnuM: [0, 0, 5000] as Vector3, headingRad: 0, speedMps: 250, loadout: [], radar: NOTIONAL_FIGHTER_RADAR };
    const scanning = new HostileFighter(spec, env(false));
    const dirs = new Set<number>();
    for (let i = 0; i < 100; i++) { scanning.update(0.02); dirs.add(Math.round(Math.atan2(scanning.emitters()[0]!.boresightEndEnu[0], scanning.emitters()[0]!.boresightEndEnu[1]) / D)); }
    expect(dirs.size).toBeGreaterThan(20);
    const tracking = new HostileFighter(spec, env(true));
    tracking.update(0.02);
    expect(tracking.radarTracking).toBe(true);
    expect(tracking.emitters()[0]!.prfHz).toBe(NOTIONAL_FIGHTER_RADAR.track.prfHz);
    const silent = new HostileFighter({ ...spec, radar: undefined as never }, env(true));
    expect(silent.emitters()).toEqual([]);
  });

  it("an AIM-120's seeker radiates only in the terminal phase", () => {
    const target = { id: "p", side: "blue" as const, positionEnuM: [0, 30000, 5000] as Vector3, velocityEnuMps: [0, -250, 0] as Vector3 };
    const w = new NotionalMissileWorld(() => [target], () => undefined);
    w.launch(NOTIONAL_AAM.AIM120, "red", "h", [0, 0, 5000], [0, 250, 0], () => ({ positionEnuM: target.positionEnuM, velocityEnuMps: target.velocityEnuMps }));
    w.step(0.02);
    expect(w.emitters()).toEqual([]);
    for (let i = 0; i < 50 * 25 && w.emitters().length === 0; i++) { target.positionEnuM = [0, target.positionEnuM[1] - 5, 5000]; w.step(0.02); }
    expect(w.emitters()).toHaveLength(1);
    const m = w.states()[0]!;
    expect(Math.hypot(m.positionEnuM[0] - target.positionEnuM[0], m.positionEnuM[1] - target.positionEnuM[1])).toBeLessThanOrEqual(NOTIONAL_AAM.AIM120.seekerRangeM + 100);
  });
});
