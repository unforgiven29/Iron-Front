/**
 * Scanning infrared search-and-track set with a laser rangefinder (owner: sensors/irst).
 *
 * Physics of detection: the scene returns contrast irradiance E at the aperture (target radiant
 * intensity × path transmission / R², minus the background it hides). The sensor's noise is
 *   detector:  NEI_d = √(A_d·Δf) / (D*·A_o·τ_o),  A_d = (f·IFOV)², Δf = 1/(2·t_dwell)
 *   clutter:   NEI_c = c·L_bg·Ω_pixel   (residual background structure after spatial filtering)
 * SNR = E / √(NEI_d² + NEI_c²); detection by Gaussian threshold from Pfa. Scanning dwell is the
 * pixel's time on target (IFOV / scan rate); a track stares (dwell = tick), so tracking reaches
 * further than search, as on real sets. A passive sensor measures angles only; range comes from
 * the laser rangefinder or another sensor.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { createScopedRandom, type SeededRandom } from "../../core/random/SeededRandom.js";
import { type IrPoint } from "../../physics/infrared/InfraredPhysics.js";
import type { SensorScene } from "../../physics/sensing/SensorScene.js";
import { angleBetween, unit } from "../../physics/sensing/SweepGeometry.js";
import { AlphaBetaTrack } from "../common/TrackFilter.js";
import { anglesIn, bodyAngles, RasterScan, slew, stabilizedAngles, withinGimbal, worldDirection, type GimbalLimits, type LookAngles, type RasterPattern, type ScanFrame, type SensorOwnship } from "../common/ScanGeometry.js";
import type { Sourced } from "../radar/PulseDopplerRadar.js";

export interface IrstProfile {
  readonly id: string;
  readonly designation: string;
  readonly apertureDiameterM: Sourced<number>;
  readonly opticsTransmission: Sourced<number>;
  readonly detectorDStar: Sourced<number>;
  readonly pixelIfovRad: Sourced<number>;
  readonly pixelPitchM: Sourced<number>;
  /** Height of the scanned swath (detector column), rad. */
  readonly swathRad: Sourced<number>;
  readonly scanRateRadS: Sourced<number>;
  readonly barTurnaroundS: Sourced<number>;
  readonly slewRateRadS: Sourced<number>;
  readonly clutterContrastFraction: Sourced<number>;
  readonly falseAlarmProbability: Sourced<number>;
  readonly trackGimbal: Sourced<GimbalLimits>;
  readonly maxTrackRateRadS: Sourced<number>;
  readonly sunExclusionRad: Sourced<number>;
  readonly acquisitionTimeS: Sourced<number>;
  readonly trackMemoryS: Sourced<number>;
  readonly laser: Sourced<{ readonly minRangeM: number; readonly maxRangeM: number; readonly sigmaM: number }>;
}

export interface IrstPlot { readonly timeS: number; readonly look: LookAngles; readonly losEnu: Vector3; readonly snr: number }

export interface IrstLock {
  readonly losEnu: Vector3;
  readonly look: LookAngles;
  readonly lookBody: LookAngles;
  readonly losRateRadS: number;
  readonly snr: number;
  /** Laser range when lasing and in range, else NaN. */
  readonly laserRangeM: number;
  readonly memory: boolean;
  readonly lockedForS: number;
}

export type IrstStatus = "off" | "search" | "acquire" | "track" | "memory" | "slaved";

/** Q-function and its inverse for Gaussian thresholds. */
function erfc(x: number): number {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
const qfunc = (x: number) => 0.5 * erfc(x / Math.SQRT2);
function qinv(p: number): number { let lo = -10, hi = 10; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (qfunc(m) > p) lo = m; else hi = m; } return (lo + hi) / 2; }

export class ScanningIrst {
  private rng: SeededRandom;
  private on = false;
  private status: IrstStatus = "off";
  private readonly scan: RasterScan;
  private pattern: RasterPattern | null = null;
  private look: LookAngles = { az: 0, el: 0 };
  private frame: ScanFrame = "body";
  private plots: IrstPlot[] = [];
  private acq: { look: LookAngles; frame: ScanFrame; windowAz: number; windowEl: number; t: number; hits: number; f?: AlphaBetaTrack; los?: Vector3 } | null = null;
  private autoAcquire = false;
  private slave: { look: LookAngles; frame: ScanFrame } | null = null;
  private trk: { los: Vector3; rate: Vector3; lastDetectS: number; since: number; snr: number; laserM: number } | null = null;
  private lasing = false;
  private lastLoss: { reason: string; timeS: number } | null = null;
  private time = 0;
  private readonly threshold: number;

  public constructor(public readonly profile: IrstProfile, seed: number) {
    this.rng = createScopedRandom(seed, "irst", profile.id);
    this.scan = new RasterScan(profile.scanRateRadS.value, profile.barTurnaroundS.value);
    this.threshold = qinv(profile.falseAlarmProbability.value);
  }

  public setPower(on: boolean): void { this.on = on; if (!on) this.breakLock("power off"); }
  public setScan(pattern: RasterPattern | null, autoAcquire = false): void {
    if (pattern && (!this.pattern || this.pattern.bars !== pattern.bars || this.pattern.orientation !== pattern.orientation)) this.scan.reset();
    this.pattern = pattern; this.autoAcquire = autoAcquire;
  }
  /** Point the head at a direction (helmet sight, radar cue) without scanning. */
  public setSlave(look: LookAngles | null, frame: ScanFrame = "body"): void { this.slave = look ? { look, frame } : null; }
  /** Lock the strongest source inside a strobe window around `look`. */
  public designate(look: LookAngles, frame: ScanFrame, windowAz: number, windowEl: number): void {
    if (this.trk) return;
    this.acq = { look, frame, windowAz, windowEl, t: 0, hits: 0 };
  }
  public setLaser(on: boolean): void { this.lasing = on; }
  public breakLock(reason = "pilot"): void { if (this.trk || this.acq) this.lastLoss = { reason, timeS: this.time }; this.trk = null; this.acq = null; }

  public get state(): IrstStatus { return this.status; }
  public get head(): { readonly look: LookAngles; readonly frame: ScanFrame } { return { look: this.look, frame: this.frame }; }
  public get recentPlots(): readonly IrstPlot[] { return this.plots; }
  public get lossEvent(): { readonly reason: string; readonly timeS: number } | null { return this.lastLoss; }

  public lock(own: SensorOwnship): IrstLock | null {
    if (!this.trk) return null;
    const dt = own.timeS - this.trk.lastDetectS;
    const los = unit([this.trk.los[0] + this.trk.rate[0] * dt, this.trk.los[1] + this.trk.rate[1] * dt, this.trk.los[2] + this.trk.rate[2] * dt]);
    return { losEnu: los, look: stabilizedAngles(own, los), lookBody: bodyAngles(own, los), losRateRadS: Math.hypot(...this.trk.rate), snr: this.trk.snr, laserRangeM: this.trk.laserM, memory: this.status === "memory", lockedForS: own.timeS - this.trk.since };
  }

  /** Noise-equivalent irradiance for a dwell and background, W/m². */
  public nei(dwellS: number, backgroundWm2sr: number): number {
    const p = this.profile;
    const ad = (p.pixelPitchM.value * 100) ** 2; // cm²
    const df = 1 / (2 * Math.max(1e-5, dwellS));
    const ao = Math.PI * (p.apertureDiameterM.value / 2) ** 2;
    const nepW = Math.sqrt(ad * df) / p.detectorDStar.value;
    const detector = nepW / (ao * p.opticsTransmission.value);
    const clutter = p.clutterContrastFraction.value * backgroundWm2sr * p.pixelIfovRad.value ** 2;
    return Math.hypot(detector, clutter);
  }

  private snrOf(pt: IrPoint, dwellS: number, sensorAltM: number): number {
    void sensorAltM;
    // A negative contrast (target colder than its background) is detected by its magnitude.
    return Math.abs(pt.irradianceWm2) / this.nei(dwellS, pt.backgroundWm2sr);
  }

  private detect(snr: number): boolean { return this.rng.nextFloat() < qfunc(this.threshold - snr); }

  private noisy(own: SensorOwnship, los: Vector3, snr: number): Vector3 {
    const g = () => Math.sqrt(-2 * Math.log(1 - this.rng.nextFloat() + 1e-12)) * Math.cos(2 * Math.PI * this.rng.nextFloat());
    const s = this.profile.pixelIfovRad.value / Math.max(1, snr) + 0.1e-3;
    const a = stabilizedAngles(own, los);
    return worldDirection("stabilized", own, { az: a.az + g() * s, el: a.el + g() * s });
  }

  public step(own: SensorOwnship, scene: SensorScene, dt: number): void {
    this.time = own.timeS;
    if (!this.on) { this.status = "off"; return; }
    this.plots = this.plots.filter((p) => own.timeS - p.timeS < 3);
    if (this.trk) return this.stepTrack(own, scene, dt);
    if (this.acq) return this.stepAcquire(own, scene, dt);
    if (this.slave) {
      this.frame = this.slave.frame;
      this.look = slew(this.look, this.slave.look, this.profile.slewRateRadS.value, dt);
      this.status = "slaved";
      return;
    }
    if (!this.pattern) { this.status = "off"; return; }
    this.status = "search";
    const p = this.pattern;
    this.frame = p.frame;
    const from = worldDirection(p.frame, own, this.scan.look(p));
    this.scan.advance(p, dt);
    this.look = this.scan.look(p);
    if (this.scan.turning) return;
    const to = worldDirection(p.frame, own, this.look);
    const dwell = this.profile.pixelIfovRad.value / this.profile.scanRateRadS.value;
    for (const pt of scene.infrared({ originEnuM: own.positionEnuM, fieldFrom: from, fieldTo: to, fieldHalfRad: this.profile.swathRad.value / 2, maxRangeM: 60000 })) {
      if (pt.sunAngleRad < this.profile.sunExclusionRad.value) continue;
      const snr = this.snrOf(pt, dwell, own.positionEnuM[2]);
      if (!this.detect(snr)) continue;
      const los = this.noisy(own, pt.losEnu, snr);
      this.plots.push({ timeS: own.timeS, look: anglesIn(p.frame, own, los), losEnu: los, snr });
      if (this.autoAcquire && !this.acq) this.acq = { look: bodyAngles(own, los), frame: "body", windowAz: this.profile.pixelIfovRad.value * 20, windowEl: this.profile.pixelIfovRad.value * 20, t: 0, hits: 0 };
    }
  }

  private stareAt(own: SensorOwnship, scene: SensorScene, los: Vector3, dt: number, half: number): { pt: IrPoint; snr: number } | null {
    let best: { pt: IrPoint; snr: number } | null = null;
    for (const pt of scene.infrared({ originEnuM: own.positionEnuM, fieldFrom: los, fieldTo: los, fieldHalfRad: half, maxRangeM: 60000 })) {
      const snr = this.snrOf(pt, dt, own.positionEnuM[2]);
      if (!best || snr > best.snr) best = { pt, snr };
    }
    return best;
  }

  private stepAcquire(own: SensorOwnship, scene: SensorScene, dt: number): void {
    const a = this.acq!;
    a.t += dt;
    this.status = "acquire";
    this.frame = a.frame;
    const center = worldDirection(a.frame, own, a.look);
    this.look = a.look;
    if (a.t > this.profile.acquisitionTimeS.value + 2) { this.lastLoss = { reason: "no acquisition", timeS: own.timeS }; this.acq = null; return; }
    const half = Math.hypot(a.windowAz, a.windowEl) / 2;
    const look = a.los ?? center;
    const hit = this.stareAt(own, scene, look, dt, a.los ? this.profile.pixelIfovRad.value * 6 : half);
    if (hit && hit.pt.sunAngleRad > this.profile.sunExclusionRad.value && this.detect(hit.snr)) {
      const off = anglesIn(a.frame, own, hit.pt.losEnu);
      if (a.los || (Math.abs(off.az - a.look.az) <= a.windowAz / 2 && Math.abs(off.el - a.look.el) <= a.windowEl / 2)) { a.los = this.noisy(own, hit.pt.losEnu, hit.snr); a.hits++; }
    }
    if (a.los && a.t >= this.profile.acquisitionTimeS.value && a.hits >= 3) {
      this.trk = { los: a.los, rate: [0, 0, 0], lastDetectS: own.timeS, since: own.timeS, snr: hit?.snr ?? 0, laserM: Number.NaN };
      this.acq = null;
      this.status = "track";
    }
  }

  private stepTrack(own: SensorOwnship, scene: SensorScene, dt: number): void {
    const t = this.trk!;
    const age = own.timeS - t.lastDetectS;
    const pred = unit([t.los[0] + t.rate[0] * age, t.los[1] + t.rate[1] * age, t.los[2] + t.rate[2] * age]);
    const body = bodyAngles(own, pred);
    if (!withinGimbal(this.profile.trackGimbal.value, body)) return this.breakLock("gimbal limit");
    if (angleBetween(pred, scene.sunDirectionEnu) < this.profile.sunExclusionRad.value) return this.breakLock("sun");
    this.frame = "body";
    this.look = body;
    const hit = this.stareAt(own, scene, pred, dt, this.profile.pixelIfovRad.value * 4);
    if (hit && this.detect(hit.snr)) {
      const m = this.noisy(own, hit.pt.losEnu, hit.snr);
      const k = 0.35;
      const dtu = Math.max(dt, own.timeS - t.lastDetectS);
      const newLos = unit([pred[0] + k * (m[0] - pred[0]), pred[1] + k * (m[1] - pred[1]), pred[2] + k * (m[2] - pred[2])]);
      const inst: Vector3 = [(newLos[0] - t.los[0]) / dtu, (newLos[1] - t.los[1]) / dtu, (newLos[2] - t.los[2]) / dtu];
      t.rate = [t.rate[0] * 0.8 + inst[0] * 0.2, t.rate[1] * 0.8 + inst[1] * 0.2, t.rate[2] * 0.8 + inst[2] * 0.2];
      t.los = newLos; t.lastDetectS = own.timeS; t.snr = hit.snr;
      const L = this.profile.laser.value;
      t.laserM = this.lasing && hit.pt.rangeM >= L.minRangeM && hit.pt.rangeM <= L.maxRangeM ? hit.pt.rangeM + L.sigmaM * (this.rng.nextFloat() * 2 - 1) : Number.NaN;
    }
    // Angular-rate limit of the tracker (relative to the aircraft: own rotation counts).
    if (Math.hypot(...t.rate) > this.profile.maxTrackRateRadS.value) return this.breakLock("angular rate");
    if (own.timeS - t.lastDetectS > this.profile.trackMemoryS.value) return this.breakLock("track lost");
    this.status = own.timeS - t.lastDetectS < 0.3 ? "track" : "memory";
  }
}

export { AlphaBetaTrack };
