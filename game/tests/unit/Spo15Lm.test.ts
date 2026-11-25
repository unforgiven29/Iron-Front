import { describe, expect, it } from "vitest";
import type { Quaternion, Vector3 } from "../../src/core/coordinates/CoordinateFrames.js";
import { rfInterceptsAt, type RfEmitter } from "../../src/physics/radar/RfEmission.js";
import { EMPTY_SENSOR_SCENE, type SensorScene } from "../../src/physics/sensing/SensorScene.js";
import { recognizeType, Spo15Lm } from "../../src/platforms/aircraft/mig29/avionics/Spo15Lm.js";
import { spo15Display } from "../../src/platforms/aircraft/mig29/avionics/Spo15.js";

const D = Math.PI / 180;
const NORTH: Quaternion = [Math.SQRT1_2, Math.SQRT1_2, 0, 0];
const RX: Vector3 = [0, 0, 5000];
const toward = (a: Vector3, b: Vector3): Vector3 => { const d: Vector3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const n = Math.hypot(...d); return [d[0] / n, d[1] / n, d[2] / n]; };
/** Fighter radar at a bearing (deg, + right) and range; held on the receiver unless `look` given. */
function radar(bearingDeg: number, rangeM: number, over: Partial<RfEmitter> = {}): RfEmitter {
  const p: Vector3 = [rangeM * Math.sin(bearingDeg * D), rangeM * Math.cos(bearingDeg * D), 5000];
  const look = toward(p, RX);
  return { positionEnuM: p, boresightStartEnu: look, boresightEndEnu: look, pattern: { peakGainDbi: 33, beamwidthRad: 3.5 * D, sidelobeDb: -30 }, carrierHz: 9.8e9, peakPowerW: 4500, cw: false, prfHz: 160e3, pulseWidthS: 1.3e-6, radiating: true, ...over };
}
const sceneOf = (list: () => RfEmitter[]): SensorScene => ({ ...EMPTY_SENSOR_SCENE, rf: (q) => rfInterceptsAt(q, list()) });
function run(spo: Spo15Lm, scene: SensorScene, seconds: number, radiating = false, t0 = 0) { let t = t0; for (let i = 0; i < Math.round(seconds * 50); i++) { t += 0.02; spo.step({ timeS: t, positionEnuM: RX, bodyToWorld: NORTH }, scene, 0.02, radiating); } return t; }

describe("SPO-15LM (DCS MiG-29A manual, pp.105–112)", () => {
  it("held beam: track warning, type F, main threat sector and power level", () => {
    const spo = new Spo15Lm();
    run(spo, sceneOf(() => [radar(30, 30000)]), 1);
    const s = spo.state;
    expect(s.trackWarning).toBe(true);
    expect(s.main?.type).toBe("F");
    expect(s.main?.sector).toBe("R30");
    expect(s.main!.level).toBeGreaterThanOrEqual(1);
  });

  it("short main-lobe flashes of a scanning radar read as search, not track", () => {
    const spo = new Spo15Lm();
    let on = 0;
    const scene = sceneOf(() => [radar(0, 40000, { prfHz: 12e3, pulseWidthS: 1.1e-6, peakPowerW: 19e3, radiating: (on++ % 100) < 3 })]);
    run(spo, scene, 6);
    expect(spo.state.trackWarning).toBe(false);
    expect(spo.state.main).not.toBeNull(); // remembered between flashes (8–12 s in search)
  });

  it("main threat is remembered 2–4 s after a track ends, 8–12 s after search", () => {
    const spo = new Spo15Lm();
    let live = true;
    const t = run(spo, sceneOf(() => [radar(0, 30000, { radiating: live })]), 1);
    live = false;
    const t2 = run(spo, sceneOf(() => [radar(0, 30000, { radiating: live })]), 2, false, t);
    expect(spo.state.main).not.toBeNull();
    run(spo, sceneOf(() => [radar(0, 30000, { radiating: live })]), 2, false, t2);
    expect(spo.state.main).toBeNull();
  });

  it("the forward hemisphere is blind while the own radar radiates; the rear still works", () => {
    const front = new Spo15Lm();
    run(front, sceneOf(() => [radar(0, 30000)]), 1, true);
    expect(front.state.main).toBeNull();
    const rear = new Spo15Lm();
    run(rear, sceneOf(() => [radar(170, 15000)]), 1, true);
    expect(rear.state.main?.sector).toBe("RR");
  });

  it("two pulse radars on one azimuth within 6 dB: neither is recognized", () => {
    const spo = new Spo15Lm();
    run(spo, sceneOf(() => [radar(10, 30000), radar(12, 31000, { carrierHz: 9.7e9 })]), 1);
    expect(spo.state.main?.type ?? null).toBeNull();
    const one = new Spo15Lm();
    run(one, sceneOf(() => [radar(10, 30000), radar(12, 90000, { carrierHz: 9.7e9 })]), 1);
    expect(one.state.main?.type).toBe("F");
  });

  it("HPRF is first seen as a flashing (ambiguous) Х at low power, before pulse recognition", () => {
    const spo = new Spo15Lm();
    // Find a range where only the CW circuit responds.
    let found = false;
    for (const r of [400e3, 300e3, 250e3, 200e3, 170e3, 150e3, 130e3, 110e3, 95e3, 80e3]) {
      spo.reset();
      run(spo, sceneOf(() => [radar(0, r)]), 0.4);
      if (spo.state.flashingX && !spo.state.types.has("F")) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  it("search filter off shows only track-mode emitters", () => {
    const spo = new Spo15Lm();
    spo.setSearchAllowed(false);
    let on = 0;
    run(spo, sceneOf(() => [radar(0, 40000, { prfHz: 12e3, pulseWidthS: 1.1e-6, peakPowerW: 19e3, radiating: (on++ % 100) < 3 })]), 4);
    expect(spo.state.main).toBeNull();
    expect(spo.state.litSectors.size).toBe(0);
  });

  it("a very strong low-frequency signal lights several sectors (blinding tendency)", () => {
    const spo = new Spo15Lm();
    run(spo, sceneOf(() => [radar(0, 3000, { carrierHz: 3e9, peakPowerW: 1e6 })]), 0.2);
    expect(spo.state.litSectors.size).toBeGreaterThan(4);
  });

  it("type recognition uses PRF and pulse width only; unknown gives no type", () => {
    expect(recognizeType(160e3, 1.3e-6, false)).toBe("F");
    expect(recognizeType(3e3, 1e-6, false)).toBe("С");
    expect(recognizeType(0, 0, true)).toBe("Х");
    expect(recognizeType(500, 1e-6, false)).toBeNull();
  });

  it("display draws the indicator", () => {
    const spo = new Spo15Lm();
    run(spo, sceneOf(() => [radar(-30, 30000)]), 1);
    expect(spo15Display(spo.state, true).length).toBeGreaterThan(40);
  });
});
