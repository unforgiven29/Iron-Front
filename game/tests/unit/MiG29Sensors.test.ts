/**
 * Radar / IRST physics and the MiG-29 sensor installation, validated against BP-29 (MiG-29 combat
 * employment manual). Each fitted value is fitted to ONE figure; the other figures here are
 * independent checks of the shared physics.
 */
import { describe, expect, it } from "vitest";
import type { Vector3 } from "../../src/core/coordinates/CoordinateFrames.js";
import { antennaPattern } from "../../src/physics/radar/Aperture.js";
import { radarEquationSnr } from "../../src/physics/radar/RadarPhysics.js";
import { EMPTY_SENSOR_SCENE } from "../../src/physics/sensing/SensorScene.js";
import { KOLS_PROFILE } from "../../src/platforms/aircraft/mig29/avionics/KolsProfile.js";
import { MiG29WeaponControl } from "../../src/platforms/aircraft/mig29/avionics/MiG29WeaponControl.js";
import { N019_PROFILE } from "../../src/platforms/aircraft/mig29/avionics/N019Profile.js";
import { F16FireControl } from "../../src/platforms/aircraft/f16c-block50/avionics/F16FireControl.js";
import { DEG, type RasterPattern, type SensorOwnship } from "../../src/sensors/common/ScanGeometry.js";
import { ScanningIrst } from "../../src/sensors/irst/ScanningIrst.js";
import { deriveHardware, PulseDopplerRadar } from "../../src/sensors/radar/PulseDopplerRadar.js";
import { AirTargetWorld, SIGNATURES, type AirTargetSpec } from "../../src/world/targets/AirTargets.js";
import type { AircraftSnapshot } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";

const NORTH_LEVEL = [0.7071068, 0.7071068, 0, 0] as const;
const flat = { heightAt: () => 0 };
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] as number; };

function own(t: number, y: number, alt: number, v: number): SensorOwnship {
  return { timeS: t, positionEnuM: [0, y, alt], velocityEnuMps: [0, v, 0], bodyToWorld: NORTH_LEVEL, headingRad: 0, pitchRad: 0, rollRad: 0 };
}

const searchV: RasterPattern = { frame: "stabilized", center: { az: 0, el: 0 }, widthRad: 50 * DEG, bars: 4, barSpacingRad: 3 * DEG, orientation: "horizontal" };

/** Fly the ownship north at speed v and return the target range at the first true radar plot (km), or −1. */
function firstRadarDetection(seed: number, target: AirTargetSpec, alt: number, v: number, wf: "HPRF" | "MPRF", maxS = 400): number {
  const r = new PulseDopplerRadar(N019_PROFILE, seed);
  r.setPower(true);
  r.setSearch({ pattern: { ...searchV, center: { az: 0, el: Math.atan2(target.positionEnuM[2] - alt, target.positionEnuM[1]) } }, waveformIds: [wf], tws: false, plotPersistenceS: 10, rangeScaleM: 150000 });
  const w = new AirTargetWorld([target], flat);
  let y = 0;
  for (let t = 0.02; t < maxS; t += 0.02) {
    y += v * 0.02; w.step(0.02);
    r.step(own(t, y, alt, v), w, 0.02);
    if (r.recentPlots.some((p) => !p.falseAlarm)) return ((w.states()[0] as { positionEnuM: Vector3 }).positionEnuM[1] - y) / 1000;
  }
  return -1;
}

describe("antenna physics (derived from the dish, not entered)", () => {
  const p = antennaPattern({ diameterM: 0.7, taperExponent: 2, farSidelobeFloorDb: 38 }, 0.03);
  it("the N019's assumed 0.7 m dish at 3 cm gives the 3.5° beam BP-29 p.8 states", () => {
    expect(p.halfPowerBeamwidthRad / DEG).toBeGreaterThan(3.3);
    expect(p.halfPowerBeamwidthRad / DEG).toBeLessThan(3.8);
  });
  it("taper p=2 has its theoretical first sidelobe (−30.6 dB) and efficiency 5/9", () => {
    expect(p.firstSidelobeDb).toBeGreaterThan(-31.5);
    expect(p.firstSidelobeDb).toBeLessThan(-29.5);
    expect(p.taperEfficiency).toBeCloseTo(5 / 9, 6);
    expect(p.peakGainLinear).toBeCloseTo((5 / 9) * (Math.PI * 0.7 / 0.03) ** 2, 3);
  });
  it("frequency changes the beam: half the wavelength halves the beamwidth", () => {
    const q = antennaPattern({ diameterM: 0.7, taperExponent: 2, farSidelobeFloorDb: 38 }, 0.015);
    expect(q.halfPowerBeamwidthRad / p.halfPowerBeamwidthRad).toBeCloseTo(0.5, 2);
  });
  it("the pattern has nulls and sidelobes, not a Gaussian", () => {
    const g = (deg: number) => p.gain(deg * DEG);
    expect(g(0)).toBe(1);
    expect(g(1.8)).toBeGreaterThan(0.45);
    expect(g(1.8)).toBeLessThan(0.55);
    const samples = Array.from({ length: 200 }, (_, i) => g(3 + i * 0.03));
    expect(Math.min(...samples)).toBeLessThan(2e-4); // a null (down to the far-sidelobe floor)
  });
});

describe("radar equation", () => {
  const hw = deriveHardware(N019_PROFILE);
  const look = { antenna: hw.antenna, peakPowerW: 1000, dutyCycle: 0.2, systemNoiseTempK: 1000, lossesDb: 6 };
  it("SNR falls as R⁻⁴ and rises linearly with peak power, duty, dwell and RCS", () => {
    const a = radarEquationSnr(look, 0.05, 3, 20000, 0);
    expect(radarEquationSnr(look, 0.05, 3, 40000, 0)).toBeCloseTo(a / 16, 10);
    expect(radarEquationSnr({ ...look, peakPowerW: 2000 }, 0.05, 3, 20000, 0)).toBeCloseTo(2 * a, 8);
    expect(radarEquationSnr({ ...look, dutyCycle: 0.1 }, 0.05, 3, 20000, 0)).toBeCloseTo(a / 2, 8);
    expect(radarEquationSnr(look, 0.1, 6, 20000, 0)).toBeCloseTo(4 * a, 8);
  });
  it("a target off the beam axis returns through the pattern", () => {
    expect(radarEquationSnr(look, 0.05, 3, 20000, hw.antenna.halfPowerBeamwidthRad / 2) / radarEquationSnr(look, 0.05, 3, 20000, 0)).toBeCloseTo(0.25, 1);
  });
});

describe("N019 against BP-29 (peak power fitted to table 1 only)", () => {
  const headOn = (alt: number): AirTargetSpec => ({ id: "t", label: "t", signature: SIGNATURES.fighter, positionEnuM: [0, 110000, alt], headingRad: Math.PI, speedMps: 250, throttle: 0.8 });
  it("table 1: head-on, H > 3000 m, σ = 3 m², mode В (HPRF): detection 50–70 km", () => {
    const r = [0, 1, 2, 3, 4, 5].map((s) => firstRadarDetection(s, headOn(6000), 6000, 250, "HPRF"));
    expect(median(r)).toBeGreaterThan(50);
    expect(median(r)).toBeLessThan(72);
  });
  it("table 1 check: below 3000 m the range stays inside 40–70 km (look-down clutter is computed, not assumed)", () => {
    const r = [0, 1, 2, 3].map((s) => firstRadarDetection(s, headOn(1500), 1500, 250, "HPRF"));
    expect(median(r)).toBeGreaterThan(40);
    expect(median(r)).toBeLessThan(72);
  });
  it("table 4 check: tail chase in mode Д (MPRF, low duty) gives 20–40 km (manual 25–35) — from duty cycle alone", () => {
    const tail: AirTargetSpec = { id: "t", label: "t", signature: SIGNATURES.fighter, positionEnuM: [0, 45000, 6000], headingRad: 0, speedMps: 180, throttle: 0.8 };
    const r = [0, 1, 2, 3].map((s) => firstRadarDetection(s, tail, 6000, 250, "MPRF", 300));
    expect(median(r)).toBeGreaterThan(20);
    expect(median(r)).toBeLessThan(40);
  });
  it("fig. 2: a beam-aspect target (ракурс 4/4) is never detected — main-lobe clutter notch", () => {
    const beam: AirTargetSpec = { id: "t", label: "t", signature: SIGNATURES.fighter, positionEnuM: [0, 30000, 3000], headingRad: Math.PI / 2, speedMps: 250, throttle: 0.8 };
    const r = new PulseDopplerRadar(N019_PROFILE, 3);
    r.setPower(true);
    r.setSearch({ pattern: { ...searchV, widthRad: 70 * DEG }, waveformIds: ["HPRF"], tws: false, plotPersistenceS: 30, rangeScaleM: 100000 });
    const w = new AirTargetWorld([beam], flat);
    // Ownship stationary in the scan sense: keep it parked so the target stays at the beam aspect for 20 s.
    for (let t = 0.02; t < 20; t += 0.02) { w.step(0.02); r.step(own(t, t * 0.001, 3000, 0.001), w, 0.02); }
    expect(r.recentPlots.filter((p) => !p.falseAlarm && p.rangeM < 40000).length).toBe(0);
  });
  it("with nothing in the world the radar reports no targets (no hidden-truth path)", () => {
    const r = new PulseDopplerRadar(N019_PROFILE, 1);
    r.setPower(true);
    r.setSearch({ pattern: searchV, waveformIds: ["HPRF"], tws: true, plotPersistenceS: 5, rangeScaleM: 150000 });
    for (let t = 0.02; t < 20; t += 0.02) r.step(own(t, 0, 6000, 250), EMPTY_SENSOR_SCENE, 0.02);
    expect(r.recentPlots.filter((p) => !p.falseAlarm).length).toBe(0);
    expect(r.tracks(own(20, 0, 6000, 250))).toHaveLength(0);
  });
  it("is deterministic for a seed", () => {
    const t = headOn(6000);
    expect(firstRadarDetection(9, t, 6000, 250, "HPRF")).toBe(firstRadarDetection(9, t, 6000, 250, "HPRF"));
  });
});

/** MiG-29 СУВ flown kinematically against one target; returns the suite. */
function flyWcs(target: AirTargetSpec, keys: (t: number, w: MiG29WeaponControl) => void, seconds: number, heading = 0): { wcs: MiG29WeaponControl; world: AirTargetWorld } {
  const wcs = new MiG29WeaponControl(5);
  const world = new AirTargetWorld([target], flat);
  let y = 0;
  for (let t = 0.02; t < seconds; t += 0.02) {
    y += 230 * 0.02; world.step(0.02);
    keys(t, wcs);
    const o = own(t, y, 6000, 230);
    wcs.step({ own: { ...o, headingRad: heading }, snapshot: {} as AircraftSnapshot, scene: world, head: { az: 0, el: 0 } }, 0.02);
  }
  return { wcs, world };
}

describe("MiG-29 weapon-control system", () => {
  const bandit: AirTargetSpec = { id: "b", label: "b", signature: SIGNATURES.fighter, positionEnuM: [500, 45000, 6000], headingRad: Math.PI, speedMps: 230, throttle: 0.8 };
  it("controls are package-defined: mode switches cycle as on the RLPK panel", () => {
    const w = new MiG29WeaponControl();
    expect(w.key("-", true)).toBe(true);
    expect(w.state.radarMode).toBe("Д");
    w.key("-", false); w.key("=", true);
    expect(w.state.master).toBe("ТП");
    expect(w.key("w", true)).toBe(false);
  });
  it("search → strobe → МРК.ЗАХВ: the radar acquires and tracks the target, measuring range and closure", () => {
    let pressed = false;
    const { wcs, world } = flyWcs(bandit, (t, w) => {
      if (t > 30 && !pressed && w.radar.recentPlots.some((p) => !p.falseAlarm)) {
        const p = w.radar.recentPlots.filter((q) => !q.falseAlarm).at(-1)!;
        (w as unknown as { s: { strobeKm: number; strobeAzDeg: number } }).s.strobeKm = p.rangeM / 1000;
        (w as unknown as { s: { strobeKm: number; strobeAzDeg: number } }).s.strobeAzDeg = p.look.az / DEG;
        w.key("t", true); w.key("t", false); pressed = true;
      }
    }, 45);
    expect(pressed).toBe(true);
    const o = own(45, 230 * 45, 6000, 230);
    const lock = wcs.radar.lock(o);
    expect(lock).not.toBeNull();
    const truth = world.states()[0]!.positionEnuM;
    const trueRange = Math.hypot(truth[0] - o.positionEnuM[0], truth[1] - o.positionEnuM[1], truth[2] - o.positionEnuM[2]);
    expect(Math.abs(lock!.rangeM - trueRange)).toBeLessThan(300);
    expect(lock!.closureMps).toBeGreaterThan(400);
    expect(lock!.closureMps).toBeLessThan(520);
  });
  it("a locked target that turns to the beam is lost in the notch (BP-29 fig.2)", () => {
    const turning: AirTargetSpec = { ...bandit, positionEnuM: [500, 30000, 6000], script: [{ kind: "straight", durationS: 12 }, { kind: "turn", rateDegS: 9, durationS: 10 }, { kind: "straight", durationS: 100 }] };
    const wcs = new MiG29WeaponControl(7);
    const world = new AirTargetWorld([turning], flat);
    const r = wcs.radar;
    let lostReason = "";
    for (let t = 0.02; t < 40; t += 0.02) {
      world.step(0.02);
      // Parked ownship (slow) so geometry is the target's alone.
      const o = own(t, 0, 6000, 1);
      if (t > 1 && t < 1.05) r.designate({ look: { az: 0.5 / 30000, el: 0 }, frame: "stabilized", rangeM: world.states()[0]!.positionEnuM[1], rangeWindowM: 3000, timeoutS: 3 });
      wcs.step({ own: o, snapshot: {} as AircraftSnapshot, scene: world, head: { az: 0, el: 0 } }, 0.02);
      if (r.lossEvent && r.lossEvent.timeS > 5 && !lostReason) lostReason = r.lossEvent.reason;
    }
    expect(lostReason).toMatch(/notch|lost/);
  });
});

describe("KOLS IRST against BP-29 (effective D* fitted to the sky figure only)", () => {
  function firstIr(seed: number, alt: number, tAlt: number, tail: boolean): number {
    const s = new ScanningIrst(KOLS_PROFILE, seed);
    s.setPower(true);
    s.setScan({ frame: "body", center: { az: 0, el: (tAlt >= alt ? 0 : -8) * DEG }, widthRad: 60 * DEG, bars: tAlt >= alt ? 3 : 5, barSpacingRad: 3.5 * DEG, orientation: "horizontal" });
    const w = new AirTargetWorld([{ id: "t", label: "t", signature: SIGNATURES.fighter, positionEnuM: [400, 40000, tAlt], headingRad: tail ? 0 : Math.PI, speedMps: 220, throttle: 1 }], flat);
    let y = 0; const v = tail ? 300 : 220;
    for (let t = 0.02; t < 600; t += 0.02) {
      y += v * 0.02; w.step(0.02);
      s.step(own(t, y, alt, v), w, 0.02);
      if (s.recentPlots.length) return (w.states()[0]!.positionEnuM[1] - y) / 1000;
    }
    return -1;
  }
  it("p.18: fighter at max power, tail, clear sky above 5 km → 12–18 km", () => {
    const r = [0, 1, 2, 3].map((i) => firstIr(i, 6000, 6000, true));
    expect(median(r)).toBeGreaterThan(11);
    expect(median(r)).toBeLessThan(19);
  });
  it("p.18 check: against the ground background the range shrinks toward 6–10 km (physics, not a factor)", () => {
    const r = [0, 1, 2].map((i) => firstIr(i, 3000, 500, true));
    expect(median(r)).toBeGreaterThan(5);
    expect(median(r)).toBeLessThan(11.5);
  });
  it("head-on the plume is hidden and the range is far shorter than from the tail", () => {
    const r = [0, 1].map((i) => firstIr(i, 6000, 6000, false));
    expect(median(r)).toBeLessThan(6);
  });
});

describe("F-16 on the same engine (different package, different controls)", () => {
  it("detects and locks a head-on target with its own TMS/cursor controls", () => {
    const fc = new F16FireControl(3);
    expect(fc.controls.find((c) => c.key === "t")?.label).toMatch(/TMS/);
    const world = new AirTargetWorld([{ id: "b", label: "b", signature: SIGNATURES.fighter, positionEnuM: [0, 50000, 6000], headingRad: Math.PI, speedMps: 230, throttle: 0.8 }], flat);
    let y = 0, locked = false;
    for (let t = 0.02; t < 90 && !locked; t += 0.02) {
      y += 230 * 0.02; world.step(0.02);
      const o = own(t, y, 6000, 230);
      const p = fc.radar.recentPlots.find((q) => !q.falseAlarm);
      if (p && !fc.radar.lock(o) && fc.radar.state === "search") {
        (fc as unknown as { cursor: { x: number; rNm: number } }).cursor = { x: p.look.az / (60 * DEG), rNm: p.rangeM / 1852 };
        fc.key("t", true); fc.key("t", false);
      }
      fc.step({ own: o, snapshot: {} as AircraftSnapshot, scene: world, head: { az: 0, el: 0 } }, 0.02);
      locked = !!fc.radar.lock(o);
    }
    expect(locked).toBe(true);
  });
});
