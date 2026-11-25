/**
 * Mechanically scanned coherent pulse-Doppler fire-control radar (owner: sensors/radar).
 *
 * One implementation for any such radar; every number that changes behaviour comes from the
 * equipment profile (a package file). The chain:
 *
 *   antenna   pattern shape from dish diameter, taper and wavelength; TX/RX gains measured or ideal
 *   scan      raster bars at the pattern's rate, stabilised in roll/pitch within limits, gimbal-clipped;
 *             time on target = beamwidth / scan rate
 *   timing    the dwell is split into processing tacts (e.g. N019: 10.24 ms search tacts with 4.48 ms
 *             of coherent integration each, 20.48 ms track tacts); the PRF changes tact to tact
 *   transmit  the waveform's average power; Doppler filter bandwidth = 1 / coherent time
 *   clutter   ground patches through the full pattern, folded by the tact's PRF into the target's
 *             Doppler filter and (range-gated waveforms) its ambiguous range cell
 *   process   main-lobe-clutter rejection, eclipsing per PRF, one target fluctuation draw per dwell
 *             (Swerling), per-tact threshold from Pfa (North's approximation), detection on any tact
 *             confirmed by one of the following measurement tacts
 *   measure   range (FM ranging / pulse resolution), angle and closure with SNR-driven errors capped
 *             at the equipment's specified accuracy
 *   track     track-while-scan file with the profile's gates and drop rule; designation → slew →
 *             acquisition box → angle pull-in → range lock → single-target track (α–β filters) with
 *             memory, gimbal, minimum-range and LOS-rate loss
 *
 * The radar sees only what `SensorScene` returns for its own beam. It never sees target lists.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { createScopedRandom, type SeededRandom } from "../../core/random/SeededRandom.js";
import { antennaPattern, type AntennaPattern, type ApertureSpec } from "../../physics/radar/Aperture.js";
import { clutterInCell, type ClutterPatch, type RadarEcho, type RadarLook } from "../../physics/radar/RadarPhysics.js";
import type { SensorScene } from "../../physics/sensing/SensorScene.js";
import { angleBetween, dot, norm, scale, sub } from "../../physics/sensing/SweepGeometry.js";
import { AlphaBetaTrack } from "../common/TrackFilter.js";
import {
  anglesIn, bodyAngles, clipToGimbal, RasterScan, slew, stabilizedAngles, withinGimbal, worldDirection,
  type GimbalLimits, type LookAngles, type RasterPattern, type ScanFrame, type SensorOwnship
} from "../common/ScanGeometry.js";

const C = 299792458;

/** A sourced or estimated value. Every hardware number in a profile carries one. */
export interface Sourced<T> { readonly value: T; readonly source: string; readonly status: "published" | "derived" | "estimated" | "fitted" }

export interface WaveformSpec {
  readonly id: string;
  readonly label: string;
  /** PRFs cycled tact by tact, Hz. */
  readonly prfsHz: Sourced<readonly number[]>;
  readonly pulseWidthS: Sourced<number>;
  /** Average transmitted power, W. */
  readonly averagePowerW: Sourced<number>;
  /** Half-width of the main-lobe clutter rejection filter, expressed as target radial speed, m/s. */
  readonly mainlobeNotchMps: Sourced<number>;
  /** Range error (1σ) of a search detection, m: FM ranging (HPRF) or pulse/PRF resolution (MPRF). */
  readonly searchRangeSigmaM: Sourced<number>;
  /** Range-gated processing (clutter competes only from the same ambiguous range cell). */
  readonly rangeGated: boolean;
  /**
   * Receiver coverage per tact. Range gates: `count` gates of `widthPulses` pulse widths placed after
   * the transmit pulse (a target whose ambiguous delay falls outside them is not seen on that PRF).
   * Doppler: the analysed band, Hz, starting at the clutter-notch edge on the closing side.
   * Omitted = full coverage.
   */
  readonly coverage?: Sourced<{ readonly rangeGates?: { readonly count: number; readonly widthPulses: number }; readonly dopplerBandHz?: number }>;
  /**
   * Published receiver sensitivity in this waveform (echo power at the detection threshold), dBW.
   * When given it sets the receiver's effective noise floor (replacing k·Ts/T_coh), so real
   * processing losses of the waveform — wider effective bandwidth, gate straddle, A/D — are included.
   */
  readonly sensitivityDbw?: Sourced<number>;
  /** Track-while-scan range gate, ± m. */
  readonly twsRangeGateM: Sourced<number>;
  /** Documented closure gates of this waveform's processing (e.g. a minimum closure in tail chase). */
  readonly closureGates?: Sourced<readonly { readonly maxRangeM: number; readonly minClosureMps: number }[]>;
}

export interface RadarProfile {
  readonly id: string;
  readonly designation: string;
  readonly frequencyHz: Sourced<number>;
  readonly aperture: Sourced<ApertureSpec>;
  readonly noiseFigureDb: Sourced<number>;
  readonly antennaTemperatureK: Sourced<number>;
  /** Itemised losses, dB. Summed into the radar equation. */
  readonly lossesDb: Sourced<Readonly<Record<string, number>>>;
  readonly falseAlarmProbability: Sourced<number>;
  /**
   * Transmitter/receiver/LO phase-noise (and A/D) floor relative to the total clutter power, dBc per
   * Doppler filter: strong main-lobe clutter leaks into every filter at this level. This, not the
   * clear-region geometry, is what limits a 1980s HPRF radar looking down at low altitude.
   */
  readonly clutterSpreadDbc: Sourced<number>;
  readonly timing: Sourced<{ readonly searchTactS: number; readonly searchCoherentS: number; readonly trackTactS: number; readonly trackCoherentS: number; readonly confirmTacts: number }>;
  readonly scanRateRadS: Sourced<number>;
  readonly barTurnaroundS: Sourced<number>;
  readonly slewRateRadS: Sourced<number>;
  readonly searchGimbal: Sourced<GimbalLimits>;
  readonly trackGimbal: Sourced<GimbalLimits>;
  readonly stabilization: Sourced<{ readonly rollMaxRad: number; readonly pitchMaxRad: number }>;
  readonly minTrackRangeM: Sourced<number>;
  readonly instrumentedRangeM: Sourced<number>;
  readonly acquisition: Sourced<{
    /** Antenna first goes this far left (−az) and up of the designation, rad. */
    readonly offsetAzRad: number; readonly offsetElRad: number;
    /** "Box" search: two horizontal lines this wide/spaced at this rate; give up after `periods` boxes. */
    readonly boxWidthRad: number; readonly boxSpacingRad: number; readonly boxRateRadS: number; readonly periods: number;
    /** Angle pull-in before range lock, s; failed attempts before returning to search. */
    readonly pullInS: number; readonly attempts: number;
  }>;
  readonly trackMemoryS: Sourced<number>;
  readonly maxTrackLosRateRadS: Sourced<number>;
  /** Specified track accuracy (1σ upper bounds). */
  readonly trackAccuracy: Sourced<{ readonly rangeM: number; readonly angleRad: number; readonly speedMps: number }>;
  /** Range-tracking α–β gains per track tact. */
  readonly rangeFilter: Sourced<{ readonly alpha: number; readonly beta: number }>;
  readonly waveforms: Readonly<Record<string, WaveformSpec>>;
  readonly tws: Sourced<{ readonly capacity: number; readonly dropAfterS: number; readonly gateAzRad: number; readonly gateElRad: number }>;
  readonly warmUpS: Sourced<number>;
}

/** Derived hardware: everything the profile's physical description implies. */
export interface RadarHardware {
  readonly wavelengthM: number;
  readonly antenna: AntennaPattern;
  readonly systemNoiseTempK: number;
  readonly totalLossesDb: number;
  readonly timeOnTargetS: number;
}

export function deriveHardware(p: RadarProfile): RadarHardware {
  const wavelengthM = C / p.frequencyHz.value;
  const antenna = antennaPattern(p.aperture.value, wavelengthM);
  const F = 10 ** (p.noiseFigureDb.value / 10);
  return {
    wavelengthM, antenna,
    systemNoiseTempK: p.antennaTemperatureK.value + 290 * (F - 1) + 290,
    totalLossesDb: Object.values(p.lossesDb.value).reduce((a, b) => a + b, 0),
    timeOnTargetS: antenna.halfPowerBeamwidthRad / p.scanRateRadS.value
  };
}

/** Receiver sensitivity: the echo power at the detection threshold in one coherent filter, dBW. */
export function receiverSensitivityDbw(p: RadarProfile, coherentS: number): number {
  const hw = deriveHardware(p);
  const threshold = -Math.log(p.falseAlarmProbability.value);
  return 10 * Math.log10(1.380649e-23 * hw.systemNoiseTempK * (1 / coherentS) * threshold);
}

export interface RadarPlot {
  readonly timeS: number;
  readonly rangeM: number;
  /** Measured closure (range rate toward us), m/s; NaN when not measured. */
  readonly closureMps: number;
  /** Measured line of sight, stabilised frame (az from heading, el from horizon). */
  readonly look: LookAngles;
  readonly losEnu: Vector3;
  readonly snrDb: number;
  readonly waveformId: string;
  readonly falseAlarm?: boolean;
}

export interface RadarTrackReport {
  readonly id: number;
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  readonly rangeM: number;
  readonly closureMps: number;
  readonly look: LookAngles;
  readonly lookBody: LookAngles;
  readonly lastUpdateS: number;
  readonly hits: number;
}

export type RadarStatus = "off" | "warmup" | "standby" | "search" | "acquire" | "track" | "memory";

export interface AcquisitionRequest {
  /** Designated direction, in `frame`. */
  readonly look: LookAngles;
  readonly frame: ScanFrame;
  readonly rangeM: number;
  /** Accept a return within ± this range of `rangeM`. */
  readonly rangeWindowM: number;
  readonly minRangeM?: number;
  readonly maxRangeM?: number;
  /** Skip the box search and stare (target already in the beam, e.g. close-combat auto-lock). */
  readonly stare?: boolean;
}

export interface RadarSearchCommand {
  readonly pattern: RasterPattern;
  /** Waveforms interleaved bar by bar (e.g. ["HPRF", "MPRF"]). */
  readonly waveformIds: readonly string[];
  readonly tws: boolean;
  /** Plots kept for display, s. */
  readonly plotPersistenceS: number;
  /** Maximum displayed/processed range, m. */
  readonly rangeScaleM: number;
  /** Close-combat auto-acquisition: lock the nearest plot inside this range window. */
  readonly autoAcquire?: { readonly minRangeM: number; readonly maxRangeM: number };
}

export interface ProcessResult { readonly detected: boolean; readonly snr: number; readonly reason: "ok" | "notch" | "clutter" | "eclipse" | "fade" | "gate" }

type Acq = { req: AcquisitionRequest; t: number; phase: "slew" | "box" | "pull-in"; scan: RasterScan; boxes: number; attempts: number; f?: AlphaBetaTrack; hits: number; pullT: number };

export class PulseDopplerRadar {
  public readonly hw: RadarHardware;
  private rng: SeededRandom;
  private status: RadarStatus = "off";
  private powered = false;
  private radiate = true;
  private warmTimer = 0;
  private readonly scan: RasterScan;
  private look: LookAngles = { az: 0, el: 0 };
  private lookFrame: ScanFrame = "stabilized";
  private search: RadarSearchCommand | null = null;
  private plots: RadarPlot[] = [];
  private tws: { id: number; pos: Vector3; vel: Vector3; t: number; hits: number }[] = [];
  private nextTrackId = 1;
  private acq: Acq | null = null;
  private stt: { f: AlphaBetaTrack; closure: number; closureRate: number; lastDetectS: number; since: number; lastReason: string; snrDb: number; lastLos: Vector3 | null } | null = null;
  private lastLoss: { reason: string; timeS: number } | null = null;
  private clutterCache: { key: string; patches: readonly ClutterPatch[]; t: number } | null = null;
  private bars = 0;
  private time = 0;
  private tactPhase = 0;

  public constructor(public readonly profile: RadarProfile, seed: number, startWarm = true) {
    this.hw = deriveHardware(profile);
    this.rng = createScopedRandom(seed, "radar", profile.id);
    this.scan = new RasterScan(profile.scanRateRadS.value, profile.barTurnaroundS.value);
    this.warmTimer = startWarm ? profile.warmUpS.value : 0;
  }

  // ---------------- commands ----------------
  public setPower(on: boolean): void {
    if (on === this.powered) return;
    this.powered = on;
    if (!on) { this.status = "off"; this.warmTimer = 0; this.dropAll("power off"); }
  }
  public setRadiate(on: boolean): void { if (this.radiate && !on) this.dropAll("emission off"); this.radiate = on; }
  public setSearch(cmd: RadarSearchCommand): void {
    const prev = this.search?.pattern;
    const changed = !prev || prev.bars !== cmd.pattern.bars || prev.orientation !== cmd.pattern.orientation || prev.frame !== cmd.pattern.frame;
    this.search = cmd;
    if (changed) this.scan.reset();
  }
  public designate(req: AcquisitionRequest): void {
    if (this.status === "track" || this.status === "memory" || this.acq) return;
    const a = this.profile.acquisition.value;
    this.acq = { req, t: 0, phase: req.stare ? "pull-in" : "slew", scan: new RasterScan(a.boxRateRadS, 0.05), boxes: 0, attempts: 0, hits: 0, pullT: 0 };
  }
  /** Break lock / abort acquisition, back to search. */
  public breakLock(reason = "pilot"): void {
    if (this.stt || this.acq) this.lastLoss = { reason, timeS: this.time };
    this.stt = null; this.acq = null;
  }

  // ---------------- outputs ----------------
  public get state(): RadarStatus { return this.status; }
  public get beam(): { readonly look: LookAngles; readonly frame: ScanFrame } { return { look: this.look, frame: this.lookFrame }; }
  public get recentPlots(): readonly RadarPlot[] { return this.plots; }
  public get lossEvent(): { readonly reason: string; readonly timeS: number } | null { return this.lastLoss; }
  public get barCount(): number { return this.bars; }
  public get frameCount(): number { return this.scan.frameCount; }
  public get acquisitionPhase(): string | null { return this.acq?.phase ?? null; }
  public get searchCommand(): RadarSearchCommand | null { return this.search; }

  public tracks(own: SensorOwnship): RadarTrackReport[] {
    return this.tws.filter((t) => t.hits >= 2).map((t) => {
      const p: Vector3 = [t.pos[0] + t.vel[0] * (own.timeS - t.t), t.pos[1] + t.vel[1] * (own.timeS - t.t), t.pos[2] + t.vel[2] * (own.timeS - t.t)];
      return this.report(t.id, p, t.vel, t.t, t.hits, own);
    });
  }

  /** The single-target track (lock), if any. */
  public lock(own: SensorOwnship): (RadarTrackReport & { readonly memory: boolean; readonly lockedForS: number; readonly snrDb: number }) | null {
    if (!this.stt) return null;
    const s = this.stt;
    const r = this.report(0, s.f.predict(own.timeS), s.f.velocity, s.f.lastUpdateS, s.f.updateCount, own);
    return { ...r, closureMps: s.closure, memory: this.status === "memory", lockedForS: this.time - s.since, snrDb: s.snrDb };
  }

  private report(id: number, p: Vector3, v: Vector3, lastUpdateS: number, hits: number, own: SensorOwnship): RadarTrackReport {
    const r = sub(p, own.positionEnuM);
    const range = norm(r);
    const los = scale(r, 1 / Math.max(1, range));
    return { id, positionEnuM: p, velocityEnuMps: v, rangeM: range, closureMps: -dot(sub(v, own.velocityEnuMps), los), look: stabilizedAngles(own, los), lookBody: bodyAngles(own, los), lastUpdateS, hits };
  }

  // ---------------- step ----------------
  public step(own: SensorOwnship, scene: SensorScene, dt: number): void {
    this.time = own.timeS;
    if (!this.powered) { this.status = "off"; return; }
    if (this.warmTimer < this.profile.warmUpS.value) { this.warmTimer += dt; this.status = "warmup"; return; }
    if (!this.radiate || !this.search) { this.status = "standby"; this.look = { az: 0, el: 0 }; return; }
    this.plots = this.plots.filter((p) => own.timeS - p.timeS <= this.search!.plotPersistenceS);
    if (this.stt) { this.stepTrack(own, scene, dt); return; }
    if (this.acq) { this.stepAcquire(own, scene, dt); return; }
    this.stepSearch(own, scene, dt);
  }

  private stabilized(own: SensorOwnship): boolean {
    const s = this.profile.stabilization.value;
    return Math.abs(own.rollRad) <= s.rollMaxRad && Math.abs(own.pitchRad) <= s.pitchMaxRad;
  }

  /** Point the antenna: convert to body, clip to the gimbal, return the world direction actually achieved. */
  private pointing(own: SensorOwnship, frame: ScanFrame, a: LookAngles, gimbal: GimbalLimits): Vector3 {
    const f: ScanFrame = frame === "stabilized" && !this.stabilized(own) ? "body" : frame;
    const body = bodyAngles(own, worldDirection(f, own, a));
    return worldDirection("body", own, clipToGimbal(gimbal, body));
  }

  private lookFor(wf: WaveformSpec): RadarLook {
    return { antenna: this.hw.antenna, averagePowerW: wf.averagePowerW.value, systemNoiseTempK: this.hw.systemNoiseTempK, lossesDb: this.hw.totalLossesDb };
  }

  private clutter(own: SensorOwnship, scene: SensorScene, beam: Vector3, look: RadarLook, tcoh: number, key: string): readonly ClutterPatch[] {
    // Recompute when the beam moved more than half a beamwidth or 0.25 s passed.
    const hb = this.hw.antenna.halfPowerBeamwidthRad / 2;
    const k = `${key}|${Math.round(Math.atan2(beam[0], beam[1]) / hb)}|${Math.round(Math.asin(Math.max(-1, Math.min(1, beam[2]))) / hb)}`;
    if (this.clutterCache && this.clutterCache.key === k && own.timeS - this.clutterCache.t < 0.25) return this.clutterCache.patches;
    const patches = scene.radarClutter({ originEnuM: own.positionEnuM, ownVelocityEnuMps: own.velocityEnuMps, beamDirection: beam, look, integrationTimeS: tcoh, maxRangeM: this.profile.instrumentedRangeM.value });
    this.clutterCache = { key: k, patches, t: own.timeS };
    return patches;
  }

  private gauss(): number { return Math.sqrt(-2 * Math.log(1 - this.rng.nextFloat() + 1e-12)) * Math.cos(2 * Math.PI * this.rng.nextFloat()); }
  private expo(): number { return -Math.log(1 - this.rng.nextFloat() + 1e-12); }

  /**
   * Signal processing of one echo over `tacts` processing tacts of `coherentS` each (meanSnr is per
   * tact). One fluctuation draw for the whole dwell (scan-to-scan Swerling); per tact the PRF changes,
   * eclipsing and clutter are evaluated and the threshold applied (North's approximation for a steady
   * target in Gaussian noise). Detection on any tact, confirmed by one of the next `confirmTacts`.
   */
  public process(echo: RadarEcho, wf: WaveformSpec, beam: Vector3, own: SensorOwnship, tacts: number, coherentS: number, clutter: readonly ClutterPatch[], confirm = true): ProcessResult {
    const lambda = this.hw.wavelengthM;
    const relDopplerHz = (2 * (echo.closureMps - dot(own.velocityEnuMps, beam))) / lambda;
    if (Math.abs(relDopplerHz) < (2 * wf.mainlobeNotchMps.value) / lambda) return { detected: false, snr: echo.meanSnr, reason: "notch" };
    for (const g of wf.closureGates?.value ?? []) {
      if (echo.rangeM <= g.maxRangeM && echo.closureMps < g.minClosureMps) return { detected: false, snr: echo.meanSnr, reason: "gate" };
    }
    const prfs = wf.prfsHz.value;
    const filterHz = 1 / coherentS;
    const pfa = this.profile.falseAlarmProbability.value;
    const k = Math.sqrt(-Math.log(pfa));
    // Published receiver sensitivity → effective noise floor of this waveform.
    const sensScale = wf.sensitivityDbw ? 10 ** ((receiverSensitivityDbw(this.profile, coherentS) - wf.sensitivityDbw.value) / 10) : 1;
    echo = { ...echo, meanSnr: echo.meanSnr * sensScale };
    // Phase-noise floor: a fraction of all clutter power appears in every Doppler filter.
    let total = 0;
    for (const c of clutter) total += c.cnr;
    total *= sensScale;
    const spread = total * 10 ** (this.profile.clutterSpreadDbc.value / 10);
    const fluct = echo.swerling === 1 ? this.expo() : (this.expo() + this.expo()) / 2;
    const confirmN = confirm ? this.profile.timing.value.confirmTacts : 0;
    let eclipsed = 0, clutterLimited = 0, uncovered = 0;
    const tactDetect = (i: number): boolean => {
      const prf = prfs[(this.tactPhase + i) % prfs.length] as number;
      const pri = 1 / prf;
      const delay = ((2 * echo.rangeM) / C) % pri;
      if (delay < wf.pulseWidthS.value || delay > pri - wf.pulseWidthS.value * 0.5) { eclipsed++; return false; }
      const cov = wf.coverage?.value;
      if (cov?.rangeGates) {
        const tau = wf.pulseWidthS.value;
        if (delay > tau + cov.rangeGates.count * cov.rangeGates.widthPulses * tau) { uncovered++; return false; }
      }
      if (cov?.dopplerBandHz !== undefined) {
        const notchHz = (2 * wf.mainlobeNotchMps.value) / lambda;
        const folded = ((relDopplerHz % prf) + prf) % prf;
        if (folded < notchHz || folded > notchHz + cov.dopplerBandHz) { uncovered++; return false; }
      }
      const cnr = sensScale * clutterInCell(clutter, relDopplerHz, prf, filterHz, echo.rangeM, wf.rangeGated ? (C * wf.pulseWidthS.value) / 2 : 0) + spread * (wf.rangeGated ? gatedFraction(wf, prf) : 1);
      const scnr = (echo.meanSnr * fluct) / (1 + cnr);
      if (cnr > echo.meanSnr) clutterLimited++;
      const pd = 0.5 * erfc(k - Math.sqrt(scnr + 0.5));
      return this.rng.nextFloat() < pd;
    };
    let detected = false;
    for (let i = 0; i < Math.max(1, tacts) && !detected; i++) {
      if (!tactDetect(i)) continue;
      if (confirmN === 0) { detected = true; break; }
      for (let j = 1; j <= confirmN && !detected; j++) if (tactDetect(i + j)) detected = true;
      break; // a failed confirmation ends this dwell's chance
    }
    this.tactPhase = (this.tactPhase + Math.max(1, tacts)) % 1024;
    const reason = detected ? "ok" : eclipsed + uncovered >= Math.max(1, tacts) ? "eclipse" : clutterLimited > 0 ? "clutter" : "fade";
    return { detected, snr: echo.meanSnr * fluct, reason };
  }

  private measureSearch(echo: RadarEcho, wf: WaveformSpec, snr: number, own: SensorOwnship): { rangeM: number; los: Vector3; closure: number } {
    const bw = this.hw.antenna.halfPowerBeamwidthRad;
    const sigA = bw / (1.6 * Math.sqrt(2 * Math.max(1, snr)));
    const st = stabilizedAngles(own, echo.losEnu);
    const look = { az: st.az + this.gauss() * sigA, el: st.el + this.gauss() * sigA };
    const dopplerRes = this.hw.wavelengthM / (2 * this.profile.timing.value.searchCoherentS);
    return { rangeM: Math.max(10, echo.rangeM + this.gauss() * wf.searchRangeSigmaM.value), los: worldDirection("stabilized", own, look), closure: echo.closureMps + this.gauss() * dopplerRes / 2 };
  }

  private measureTrack(echo: RadarEcho, wf: WaveformSpec, snr: number, own: SensorOwnship): { rangeM: number; los: Vector3; closure: number } {
    const acc = this.profile.trackAccuracy.value;
    const bw = this.hw.antenna.halfPowerBeamwidthRad;
    const sigA = Math.min(acc.angleRad, bw / (1.6 * Math.sqrt(2 * Math.max(1, snr))));
    const sigR = Math.min(acc.rangeM, (C * wf.pulseWidthS.value) / 2 / Math.sqrt(2 * Math.max(1, snr)));
    const sigV = Math.min(acc.speedMps, this.hw.wavelengthM / (2 * this.profile.timing.value.trackCoherentS) / Math.sqrt(2 * Math.max(1, snr)));
    const st = stabilizedAngles(own, echo.losEnu);
    const look = { az: st.az + this.gauss() * sigA, el: st.el + this.gauss() * sigA };
    return { rangeM: Math.max(10, echo.rangeM + this.gauss() * sigR), los: worldDirection("stabilized", own, look), closure: echo.closureMps + this.gauss() * sigV };
  }

  private stepSearch(own: SensorOwnship, scene: SensorScene, dt: number): void {
    const cmd = this.search!;
    const pat = cmd.pattern;
    const barBefore = this.scan.barIndex + this.scan.frameCount * 1000;
    const wf = this.profile.waveforms[cmd.waveformIds[this.bars % Math.max(1, cmd.waveformIds.length)] as string];
    if (!wf) { this.status = "standby"; return; }
    const from = this.pointing(own, pat.frame, this.scan.look(pat), this.profile.searchGimbal.value);
    this.scan.advance(pat, dt);
    if (this.scan.barIndex + this.scan.frameCount * 1000 !== barBefore) this.bars++;
    this.look = this.scan.look(pat);
    this.lookFrame = pat.frame;
    this.status = "search";
    if (this.scan.turning) return;
    const to = this.pointing(own, pat.frame, this.look, this.profile.searchGimbal.value);
    const T = this.profile.timing.value;
    const rate = pat.rateRadS ?? this.profile.scanRateRadS.value;
    const tacts = Math.max(1, Math.round(this.hw.antenna.halfPowerBeamwidthRad / rate / T.searchTactS));
    const look = this.lookFor(wf);
    const echoes = scene.radar({ originEnuM: own.positionEnuM, ownVelocityEnuMps: own.velocityEnuMps, beamFrom: from, beamTo: to, look, integrationTimeS: T.searchCoherentS, reportFloorSnr: 0.05, maxRangeM: Math.min(cmd.rangeScaleM, this.profile.instrumentedRangeM.value) });
    const clutter = echoes.length ? this.clutter(own, scene, to, look, T.searchCoherentS, wf.id) : [];
    for (const e of echoes) {
      const r = this.process(e, wf, to, own, tacts, T.searchCoherentS, clutter);
      if (!r.detected) continue;
      const m = this.measureSearch(e, wf, r.snr, own);
      this.addPlot({ timeS: own.timeS, rangeM: m.rangeM, closureMps: m.closure, look: stabilizedAngles(own, m.los), losEnu: m.los, snrDb: 10 * Math.log10(r.snr), waveformId: wf.id }, own);
    }
    // Noise false alarms: range–Doppler cells per look × Pfa, confirmed by the measurement tacts.
    const cells = (Math.min(cmd.rangeScaleM, this.profile.instrumentedRangeM.value) / ((C * wf.pulseWidthS.value) / 2)) * Math.max(1, Math.round((wf.prfsHz.value[0] as number) * T.searchCoherentS / 8));
    const looksThisTick = (dt * rate) / this.hw.antenna.halfPowerBeamwidthRad * tacts;
    const pfaConfirmed = this.profile.falseAlarmProbability.value * (1 - (1 - this.profile.falseAlarmProbability.value) ** T.confirmTacts);
    if (this.rng.nextFloat() < cells * pfaConfirmed * looksThisTick) {
      this.addPlot({ timeS: own.timeS, rangeM: this.rng.nextFloat() * cmd.rangeScaleM, closureMps: Number.NaN, look: stabilizedAngles(own, to), losEnu: to, snrDb: 12, waveformId: wf.id, falseAlarm: true }, own);
    }
    if (cmd.tws) this.updateTws(own, wf);
  }

  private addPlot(p: RadarPlot, own: SensorOwnship): void {
    this.plots.push(p);
    const auto = this.search?.autoAcquire;
    if (auto && !this.acq && !p.falseAlarm && p.rangeM >= auto.minRangeM && p.rangeM <= auto.maxRangeM) {
      this.designate({ look: bodyAngles(own, p.losEnu), frame: "body", rangeM: p.rangeM, rangeWindowM: 800, stare: true });
    }
  }

  /** TWS per the profile: gate on range/az/el, new estimate = the measurement (no smoothing), velocity from successive contacts. */
  private updateTws(own: SensorOwnship, wf: WaveformSpec): void {
    const g = this.profile.tws.value;
    const fresh = this.plots.filter((p) => p.timeS === own.timeS && !p.falseAlarm);
    for (const p of fresh) {
      const pos: Vector3 = [own.positionEnuM[0] + p.losEnu[0] * p.rangeM, own.positionEnuM[1] + p.losEnu[1] * p.rangeM, own.positionEnuM[2] + p.losEnu[2] * p.rangeM];
      let best: (typeof this.tws)[number] | null = null, bestD = Infinity;
      for (const t of this.tws) {
        const pred: Vector3 = [t.pos[0] + t.vel[0] * (own.timeS - t.t), t.pos[1] + t.vel[1] * (own.timeS - t.t), t.pos[2] + t.vel[2] * (own.timeS - t.t)];
        const r = norm(sub(pred, own.positionEnuM));
        const a = stabilizedAngles(own, scale(sub(pred, own.positionEnuM), 1 / Math.max(1, r)));
        const dR = Math.abs(r - p.rangeM), dAz = Math.abs(a.az - p.look.az), dEl = Math.abs(a.el - p.look.el);
        if (dR <= wf.twsRangeGateM.value && dAz <= g.gateAzRad && dEl <= g.gateElRad && dR < bestD) { best = t; bestD = dR; }
      }
      if (best) {
        const dtc = own.timeS - best.t;
        if (dtc > 0.2) best.vel = [(pos[0] - best.pos[0]) / dtc, (pos[1] - best.pos[1]) / dtc, (pos[2] - best.pos[2]) / dtc];
        best.pos = pos; best.t = own.timeS; best.hits++;
      } else if (this.tws.length < g.capacity) this.tws.push({ id: this.nextTrackId++, pos, vel: [0, 0, 0], t: own.timeS, hits: 1 });
    }
    this.tws = this.tws.filter((t) => own.timeS - t.t < g.dropAfterS);
  }

  /** Time for one full frame of the current search pattern, s. */
  public frameTimeS(): number {
    const p = this.search?.pattern;
    if (!p) return 0;
    return p.bars * (p.widthRad / (p.rateRadS ?? this.profile.scanRateRadS.value) + (p.turnaroundS ?? this.profile.barTurnaroundS.value));
  }

  private stepAcquire(own: SensorOwnship, scene: SensorScene, dt: number): void {
    const a = this.acq!;
    const A = this.profile.acquisition.value;
    const T = this.profile.timing.value;
    a.t += dt;
    this.status = "acquire";
    const designated = anglesIn(a.req.frame, own, worldDirection(a.req.frame, own, a.req.look));
    const boxCentre = designated;
    if (a.phase === "slew") {
      // Fastest path to the point 4° left / 2° above the designation (start of the box), N019 practice.
      const start = { az: boxCentre.az + A.offsetAzRad, el: boxCentre.el + A.offsetElRad };
      const cur = anglesIn(a.req.frame, own, this.pointing(own, this.lookFrame, this.look, this.profile.trackGimbal.value));
      const next = slew(cur, start, this.profile.slewRateRadS.value, dt);
      this.lookFrame = a.req.frame;
      this.look = next;
      if (Math.hypot(next.az - start.az, next.el - start.el) < 1e-4) { a.phase = "box"; a.scan.reset(); }
      return;
    }
    const wf = this.trackWaveform(own, worldDirection(a.req.frame, own, designated));
    const look = this.lookFor(wf);
    if (a.phase === "box") {
      const pat: RasterPattern = { frame: a.req.frame, center: boxCentre, widthRad: A.boxWidthRad, bars: 2, barSpacingRad: A.boxSpacingRad, orientation: "horizontal", rateRadS: A.boxRateRadS, turnaroundS: 0.05 };
      const frames = a.scan.frameCount;
      const from = this.pointing(own, pat.frame, a.scan.look(pat), this.profile.trackGimbal.value);
      a.scan.advance(pat, dt);
      this.look = a.scan.look(pat);
      this.lookFrame = pat.frame;
      if (a.scan.frameCount > frames) a.boxes++;
      if (a.boxes >= A.periods) { this.lastLoss = { reason: "no target in box", timeS: own.timeS }; this.acq = null; return; }
      const to = this.pointing(own, pat.frame, this.look, this.profile.trackGimbal.value);
      const tacts = Math.max(1, Math.round(this.hw.antenna.halfPowerBeamwidthRad / A.boxRateRadS / T.searchTactS));
      const echoes = scene.radar({ originEnuM: own.positionEnuM, ownVelocityEnuMps: own.velocityEnuMps, beamFrom: from, beamTo: to, look, integrationTimeS: T.searchCoherentS, reportFloorSnr: 0.05, maxRangeM: this.profile.instrumentedRangeM.value });
      const clutter = echoes.length ? this.clutter(own, scene, to, look, T.searchCoherentS, `acq${wf.id}`) : [];
      for (const e of echoes) {
        if (Math.abs(e.rangeM - a.req.rangeM) > a.req.rangeWindowM) continue;
        if (e.rangeM < (a.req.minRangeM ?? this.profile.minTrackRangeM.value) || e.rangeM > (a.req.maxRangeM ?? Infinity)) continue;
        const r = this.process(e, wf, to, own, tacts, T.searchCoherentS, clutter);
        if (!r.detected) continue;
        const m = this.measureSearch(e, wf, r.snr, own);
        a.f = new AlphaBetaTrack([own.positionEnuM[0] + m.los[0] * m.rangeM, own.positionEnuM[1] + m.los[1] * m.rangeM, own.positionEnuM[2] + m.los[2] * m.rangeM], own.timeS);
        a.phase = "pull-in"; a.pullT = 0; a.hits = 0;
        break;
      }
      return;
    }
    // Pull-in (Н.ПЕЛ): stop searching, stare at the target, doubled tact, angle then range lock.
    if (!a.f) {
      const d = worldDirection(a.req.frame, own, a.req.look);
      a.f = new AlphaBetaTrack([own.positionEnuM[0] + d[0] * a.req.rangeM, own.positionEnuM[1] + d[1] * a.req.rangeM, own.positionEnuM[2] + d[2] * a.req.rangeM], own.timeS);
    }
    a.pullT += dt;
    const pred = a.f.predict(own.timeS);
    const los = scale(sub(pred, own.positionEnuM), 1 / Math.max(1, norm(sub(pred, own.positionEnuM))));
    this.look = anglesIn(this.lookFrame, own, los);
    const echoes = scene.radar({ originEnuM: own.positionEnuM, ownVelocityEnuMps: own.velocityEnuMps, beamFrom: los, beamTo: los, look, integrationTimeS: T.trackCoherentS, reportFloorSnr: 0.01, maxRangeM: this.profile.instrumentedRangeM.value });
    const predR = norm(sub(pred, own.positionEnuM));
    const cand = echoes.filter((e) => Math.abs(e.rangeM - predR) < (a.hits ? 600 : a.req.rangeWindowM)).sort((x, y) => Math.abs(x.rangeM - predR) - Math.abs(y.rangeM - predR))[0];
    if (cand) {
      const clutter = this.clutter(own, scene, los, look, T.trackCoherentS, `trk${wf.id}`);
      const r = this.process(cand, wf, los, own, Math.max(1, Math.round(dt / T.trackTactS)), T.trackCoherentS, clutter, false);
      if (r.detected) {
        const m = this.measureTrack(cand, wf, r.snr, own);
        a.f.update(own.timeS, [own.positionEnuM[0] + m.los[0] * m.rangeM, own.positionEnuM[1] + m.los[1] * m.rangeM, own.positionEnuM[2] + m.los[2] * m.rangeM], 0.5, 0.02);
        // Speed channel: target velocity along the line of sight from the measured closure.
        a.f.setLineOfSightVelocity(m.los, dot(own.velocityEnuMps, m.los) - m.closure);
        a.hits++;
      } else a.f.coast(own.timeS);
    } else a.f.coast(own.timeS);
    if (a.pullT >= A.pullInS) {
      if (a.hits >= Math.max(3, Math.round(A.pullInS / T.trackTactS / 3))) {
        this.stt = { f: a.f, closure: dot(own.velocityEnuMps, los) - dot(a.f.velocity, los), closureRate: 0, lastDetectS: own.timeS, since: own.timeS, lastReason: "ok", snrDb: 0, lastLos: null };
        this.acq = null;
        this.status = "track";
      } else if (++a.attempts >= A.attempts) { this.lastLoss = { reason: "lock attempts failed", timeS: own.timeS }; this.acq = null; }
      else { a.pullT = 0; a.hits = 0; }
    }
  }

  private trackWaveform(own: SensorOwnship, los: Vector3): WaveformSpec {
    // High-duty waveform when the target can be clear of sidelobe clutter, else the range-gated one.
    const wfs = Object.values(this.profile.waveforms);
    const ownSpeed = norm(own.velocityEnuMps);
    const closure = this.stt ? this.stt.closure : ownSpeed * 2;
    const high = wfs.find((w) => !w.rangeGated);
    const med = wfs.find((w) => w.rangeGated);
    void los;
    return (closure > ownSpeed ? high : med) ?? high ?? (wfs[0] as WaveformSpec);
  }

  private stepTrack(own: SensorOwnship, scene: SensorScene, dt: number): void {
    const s = this.stt!;
    const T = this.profile.timing.value;
    const pred = s.f.predict(own.timeS);
    const r = sub(pred, own.positionEnuM);
    const range = norm(r);
    const los = scale(r, 1 / Math.max(1, range));
    const body = bodyAngles(own, los);
    if (!withinGimbal(this.profile.trackGimbal.value, body)) { this.breakLock("gimbal limit"); return; }
    if (range < this.profile.minTrackRangeM.value) { this.breakLock("minimum range"); return; }
    if (s.lastLos && angleBetween(s.lastLos, los) / dt > this.profile.maxTrackLosRateRadS.value) { this.breakLock("angle rate"); return; }
    s.lastLos = los;
    this.look = anglesIn(this.lookFrame, own, los);
    const wf = this.trackWaveform(own, los);
    const look = this.lookFor(wf);
    const echoes = scene.radar({ originEnuM: own.positionEnuM, ownVelocityEnuMps: own.velocityEnuMps, beamFrom: los, beamTo: los, look, integrationTimeS: T.trackCoherentS, reportFloorSnr: 0.01, maxRangeM: this.profile.instrumentedRangeM.value });
    const gate = 150 + 60 * (own.timeS - s.lastDetectS) + 0.005 * range;
    const cand = echoes.filter((e) => Math.abs(e.rangeM - range) < gate).sort((a, b) => Math.abs(a.rangeM - range) - Math.abs(b.rangeM - range))[0];
    let detected = false;
    if (cand) {
      const clutter = this.clutter(own, scene, los, look, T.trackCoherentS, `trk${wf.id}`);
      const p = this.process(cand, wf, los, own, Math.max(1, Math.round(dt / T.trackTactS)), T.trackCoherentS, clutter, false);
      s.lastReason = p.reason;
      if (p.detected) {
        const m = this.measureTrack(cand, wf, p.snr, own);
        const F = this.profile.rangeFilter.value;
        s.f.update(own.timeS, [own.positionEnuM[0] + m.los[0] * m.rangeM, own.positionEnuM[1] + m.los[1] * m.rangeM, own.positionEnuM[2] + m.los[2] * m.rangeM], F.alpha, F.beta);
        // Speed channel (Doppler): α–β on closure; it sets the target's velocity along the line of sight.
        const dtc = Math.max(dt, own.timeS - s.lastDetectS);
        const pc = s.closure + s.closureRate * dtc;
        const e = m.closure - pc;
        s.closure = pc + 0.4 * e;
        s.closureRate += (0.05 * e) / dtc;
        s.f.setLineOfSightVelocity(m.los, dot(own.velocityEnuMps, m.los) - s.closure);
        s.lastDetectS = own.timeS;
        s.snrDb = 10 * Math.log10(Math.max(1e-6, p.snr));
        detected = true;
      }
    } else s.lastReason = "no return in gate";
    if (!detected) s.f.coast(own.timeS);
    if (own.timeS - s.lastDetectS > this.profile.trackMemoryS.value) { this.breakLock(`track lost (${s.lastReason})`); return; }
    this.status = detected || own.timeS - s.lastDetectS < 0.3 ? "track" : "memory";
  }

  private dropAll(reason: string): void {
    if (this.stt || this.acq) this.lastLoss = { reason, timeS: this.time };
    this.stt = null; this.acq = null; this.plots = []; this.tws = [];
  }
}

/** Fraction of all-range clutter that competes in one range gate of a range-gated waveform (gate / unambiguous interval). */
function gatedFraction(wf: WaveformSpec, prf: number): number {
  return Math.min(1, (wf.pulseWidthS.value * prf));
}

export function erfc(x: number): number {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
