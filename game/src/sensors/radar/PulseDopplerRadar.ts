/**
 * Mechanically scanned coherent pulse-Doppler fire-control radar (owner: sensors/radar).
 *
 * One implementation for any such radar; every number that changes behaviour comes from the
 * equipment profile (a package file). The chain each tick:
 *
 *   antenna   pattern, gain and beamwidth derived from dish diameter, taper and wavelength
 *   scan      raster bars at the profile's scan rate, stabilised in roll/pitch within limits,
 *             clipped by the gimbal; time on target = beamwidth / scan rate
 *   transmit  peak power × duty (pulse width × PRF) = average power, split over the PRF set
 *   receive   noise floor k·T0·F; radar-equation SNR from the physics layer
 *   clutter   ground patches through the real pattern, folded by each PRF into the target's
 *             Doppler filter (width 1/T) and, for range-gated waveforms, its ambiguous range cell
 *   process   main-lobe-clutter rejection filter, eclipsing (echo arriving while transmitting),
 *             Swerling fluctuation, CFAR threshold from Pfa, M-of-N over the PRF set
 *   measure   range (resolution/FM-ranging error), angle (σ ∝ beamwidth/√(2·SNR)), closure
 *   track     TWS track file (alpha–beta) and single-target track with acquisition, memory,
 *             gimbal and minimum-range loss
 *
 * The radar sees only what `SensorScene` returns for its own beam. It never sees target lists.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { createScopedRandom, type SeededRandom } from "../../core/random/SeededRandom.js";
import { antennaPattern, type AntennaPattern, type ApertureSpec } from "../../physics/radar/Aperture.js";
import { clutterInCell, type ClutterPatch, type RadarEcho, type RadarLook } from "../../physics/radar/RadarPhysics.js";
import type { SensorScene } from "../../physics/sensing/SensorScene.js";
import { angleBetween, dot, norm, scale, sub, unit } from "../../physics/sensing/SweepGeometry.js";
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
  /** PRF set cycled within one look, Hz. */
  readonly prfsHz: Sourced<readonly number[]>;
  readonly pulseWidthS: Sourced<number>;
  /** Detections required out of the PRF set (M of N) to declare a target. */
  readonly requiredPrfs: number;
  /** Half-width of the main-lobe clutter rejection filter, expressed as target radial speed, m/s. */
  readonly mainlobeNotchMps: Sourced<number>;
  /** Range measurement: "pulse" = resolved by the pulse/PRF set; "fm" = FM ranging in velocity search. */
  readonly ranging: { readonly kind: "pulse" } | { readonly kind: "fm"; readonly fractionalError: Sourced<number> };
  /** Range-gated processing (clutter competes only from the same ambiguous range cell). */
  readonly rangeGated: boolean;
  /** Extra documented closure gates of this waveform's processing (e.g. a minimum closure in tail chase). */
  readonly closureGates?: Sourced<readonly { readonly maxRangeM: number; readonly minClosureMps: number }[]>;
}

export interface RadarProfile {
  readonly id: string;
  readonly designation: string;
  readonly frequencyHz: Sourced<number>;
  readonly aperture: Sourced<ApertureSpec>;
  readonly peakPowerW: Sourced<number>;
  readonly noiseFigureDb: Sourced<number>;
  readonly antennaTemperatureK: Sourced<number>;
  /** Itemised losses, dB. Summed into the radar equation. */
  readonly lossesDb: Sourced<Readonly<Record<string, number>>>;
  readonly falseAlarmProbability: Sourced<number>;
  readonly scanRateRadS: Sourced<number>;
  readonly barTurnaroundS: Sourced<number>;
  readonly slewRateRadS: Sourced<number>;
  readonly searchGimbal: Sourced<GimbalLimits>;
  readonly trackGimbal: Sourced<GimbalLimits>;
  readonly stabilization: Sourced<{ readonly rollMaxRad: number; readonly pitchMaxRad: number }>;
  readonly minTrackRangeM: Sourced<number>;
  readonly instrumentedRangeM: Sourced<number>;
  readonly acquisitionTimeS: Sourced<number>;
  readonly trackMemoryS: Sourced<number>;
  readonly maxTrackLosRateRadS: Sourced<number>;
  readonly waveforms: Readonly<Record<string, WaveformSpec>>;
  readonly twsCapacity: Sourced<number>;
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
  /** Acquisition search pattern around the designation (small raster), defaults to 2 bars ±1 beamwidth. */
  readonly pattern?: { readonly widthRad: number; readonly bars: number };
  readonly timeoutS: number;
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
  /** Close-combat auto-acquisition: lock the first plot inside this range window. */
  readonly autoAcquire?: { readonly minRangeM: number; readonly maxRangeM: number };
}

export interface ProcessResult { readonly detected: boolean; readonly snr: number; readonly scnrDb: number; readonly reason: "ok" | "notch" | "clutter" | "eclipse" | "fade" | "gate" }

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
  private tws: { id: number; f: AlphaBetaTrack; hits: number; misses: number }[] = [];
  private nextTrackId = 1;
  private acq: { req: AcquisitionRequest; t: number; phase: "slew" | "search" | "confirm"; scan: RasterScan; hits: number; f?: AlphaBetaTrack } | null = null;
  private stt: { f: AlphaBetaTrack; lastDetectS: number; since: number; lastReason: string; snrDb: number; lastLos: Vector3 | null } | null = null;
  private lastLoss: { reason: string; timeS: number } | null = null;
  private clutterCache: { key: string; patches: readonly ClutterPatch[]; t: number } | null = null;
  private bars = 0;
  private time = 0;

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
  public setRadiate(on: boolean): void { this.radiate = on; if (!on) this.dropAll("emission off"); }
  public setSearch(cmd: RadarSearchCommand): void {
    const changed = !this.search || this.search.pattern.bars !== cmd.pattern.bars || this.search.pattern.orientation !== cmd.pattern.orientation;
    this.search = cmd;
    if (changed) this.scan.reset();
  }
  public designate(req: AcquisitionRequest): void {
    if (this.status === "track" || this.status === "memory") return;
    this.acq = { req, t: 0, phase: "slew", scan: new RasterScan(this.profile.scanRateRadS.value, 0.05), hits: 0 };
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

  public tracks(own: SensorOwnship): RadarTrackReport[] {
    return this.tws.filter((t) => t.hits >= 2).map((t) => this.report(t.id, t.f, t.hits, own));
  }

  /** The single-target track (lock), if any. */
  public lock(own: SensorOwnship): (RadarTrackReport & { readonly memory: boolean; readonly lockedForS: number; readonly snrDb: number }) | null {
    if (!this.stt) return null;
    return { ...this.report(0, this.stt.f, this.stt.f.updateCount, own), memory: this.status === "memory", lockedForS: this.time - this.stt.since, snrDb: this.stt.snrDb };
  }

  private report(id: number, f: AlphaBetaTrack, hits: number, own: SensorOwnship): RadarTrackReport {
    const p = f.predict(own.timeS);
    const r = sub(p, own.positionEnuM);
    const range = norm(r);
    const los = scale(r, 1 / Math.max(1, range));
    return { id, positionEnuM: p, velocityEnuMps: f.velocity, rangeM: range, closureMps: -dot(sub(f.velocity, own.velocityEnuMps), los), look: stabilizedAngles(own, los), lookBody: bodyAngles(own, los), lastUpdateS: f.lastUpdateS, hits };
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

  private lookFor(wf: WaveformSpec, integrationTimeS: number): { look: RadarLook; perPrfTime: number } {
    const prfs = wf.prfsHz.value;
    const duty = wf.pulseWidthS.value * (prfs.reduce((a, b) => a + b, 0) / prfs.length);
    return {
      look: { antenna: this.hw.antenna, peakPowerW: this.profile.peakPowerW.value, dutyCycle: duty, systemNoiseTempK: this.hw.systemNoiseTempK, lossesDb: this.hw.totalLossesDb },
      perPrfTime: integrationTimeS / prfs.length
    };
  }

  private clutter(own: SensorOwnship, scene: SensorScene, beam: Vector3, look: RadarLook, tint: number, key: string): readonly ClutterPatch[] {
    // Recompute when the beam moved more than half a beamwidth or 0.25 s passed.
    const k = `${key}|${Math.round(Math.atan2(beam[0], beam[1]) / (this.hw.antenna.halfPowerBeamwidthRad / 2))}|${Math.round(Math.asin(beam[2]) / (this.hw.antenna.halfPowerBeamwidthRad / 2))}`;
    if (this.clutterCache && this.clutterCache.key === k && own.timeS - this.clutterCache.t < 0.25) return this.clutterCache.patches;
    const patches = scene.radarClutter({ originEnuM: own.positionEnuM, ownVelocityEnuMps: own.velocityEnuMps, beamDirection: beam, look, integrationTimeS: tint, maxRangeM: this.profile.instrumentedRangeM.value });
    this.clutterCache = { key: k, patches, t: own.timeS };
    return patches;
  }

  /**
   * Signal processing of one echo for one look. Splits the integration over the PRF set; for each
   * PRF checks eclipsing, adds the clutter folded into the target's Doppler cell, draws Swerling
   * fluctuation and compares with the CFAR threshold; declares a detection on M of N.
   */
  public process(echo: RadarEcho, wf: WaveformSpec, beam: Vector3, own: SensorOwnship, integrationTimeS: number, clutter: readonly ClutterPatch[]): ProcessResult {
    const lambda = this.hw.wavelengthM;
    // Doppler of the target relative to the main-lobe clutter line.
    const relDopplerHz = (2 * (echo.closureMps - dot(own.velocityEnuMps, beam))) / lambda;
    const notchHz = (2 * wf.mainlobeNotchMps.value) / lambda;
    if (Math.abs(relDopplerHz) < notchHz) return { detected: false, snr: echo.meanSnr, scnrDb: -99, reason: "notch" };
    for (const g of wf.closureGates?.value ?? []) {
      if (echo.rangeM <= g.maxRangeM && echo.closureMps < g.minClosureMps) return { detected: false, snr: echo.meanSnr, scnrDb: -99, reason: "gate" };
    }
    const prfs = wf.prfsHz.value;
    const perPrf = integrationTimeS / prfs.length;
    const filterHz = 1 / Math.max(1e-4, perPrf);
    const pfa = this.profile.falseAlarmProbability.value;
    let hits = 0, eclipsed = 0, clutterLimited = 0, bestScnr = -99;
    for (const prf of prfs) {
      const pri = 1 / prf;
      const delay = ((2 * echo.rangeM) / C) % pri;
      // Echo overlaps the transmitted pulse (receiver blanked) → eclipsed for this PRF.
      if (delay < wf.pulseWidthS.value || delay > pri - wf.pulseWidthS.value * 0.5) { eclipsed++; continue; }
      const snr = echo.meanSnr / prfs.length;
      const cnr = clutterInCell(clutter, relDopplerHz, prf, filterHz, echo.rangeM, wf.rangeGated ? (C * wf.pulseWidthS.value) / 2 : 0) / prfs.length;
      const scnr = snr / (1 + cnr);
      bestScnr = Math.max(bestScnr, 10 * Math.log10(Math.max(1e-12, scnr)));
      if (cnr > snr) clutterLimited++;
      // Square-law detector, CFAR threshold T = −ln Pfa against noise + clutter.
      // Swerling 1: Pd = Pfa^(1/(1+S)) exactly (DiFranco & Rubin). Swerling 3: Pd = (1 + 2T/(S(2+S))... ) form below.
      const T = -Math.log(pfa);
      const pd = echo.swerling === 1 ? Math.exp(-T / (1 + scnr)) : (1 + (2 * T * scnr) / (2 + scnr) ** 2) * Math.exp((-2 * T) / (2 + scnr));
      if (this.rng.nextFloat() < Math.min(1, pd)) hits++;
    }
    const detected = hits >= Math.min(wf.requiredPrfs, prfs.length);
    const reason = detected ? "ok" : eclipsed > prfs.length - wf.requiredPrfs ? "eclipse" : clutterLimited > prfs.length / 2 ? "clutter" : "fade";
    return { detected, snr: echo.meanSnr, scnrDb: bestScnr, reason };
  }

  private measure(echo: RadarEcho, wf: WaveformSpec, snr: number, own: SensorOwnship, tracking: boolean): { rangeM: number; los: Vector3 } {
    const g = () => Math.sqrt(-2 * Math.log(1 - this.rng.nextFloat() + 1e-12)) * Math.cos(2 * Math.PI * this.rng.nextFloat());
    const bw = this.hw.antenna.halfPowerBeamwidthRad;
    const sigA = bw / (1.6 * Math.sqrt(2 * Math.max(1, snr))) + 1e-4;
    let sigR: number;
    if (tracking) sigR = (C * wf.pulseWidthS.value) / 2 / Math.sqrt(2 * Math.max(1, snr)) + 3;
    else if (wf.ranging.kind === "fm") sigR = wf.ranging.fractionalError.value * echo.rangeM;
    else sigR = (C * wf.pulseWidthS.value) / 2 / Math.sqrt(12);
    const st = stabilizedAngles(own, echo.losEnu);
    const look = { az: st.az + g() * sigA, el: st.el + g() * sigA };
    return { rangeM: Math.max(10, echo.rangeM + g() * sigR), los: worldDirection("stabilized", own, look) };
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
    const tint = this.hw.timeOnTargetS;
    const { look } = this.lookFor(wf, tint);
    const echoes = scene.radar({ originEnuM: own.positionEnuM, ownVelocityEnuMps: own.velocityEnuMps, beamFrom: from, beamTo: to, look, integrationTimeS: tint, reportFloorSnr: 0.05, maxRangeM: Math.min(cmd.rangeScaleM, this.profile.instrumentedRangeM.value) });
    const clutter = echoes.length ? this.clutter(own, scene, to, look, tint / wf.prfsHz.value.length, wf.id) : [];
    for (const e of echoes) {
      const r = this.process(e, wf, to, own, tint, clutter);
      if (!r.detected) continue;
      const m = this.measure(e, wf, r.snr, own, false);
      this.addPlot({ timeS: own.timeS, rangeM: m.rangeM, closureMps: e.closureMps + (this.rng.nextFloat() - 0.5) * 4, look: stabilizedAngles(own, m.los), losEnu: m.los, snrDb: 10 * Math.log10(r.snr), waveformId: wf.id }, own);
    }
    // Noise false alarms: range-Doppler cells per look × Pfa (cells = range bins × Doppler filters).
    const cells = (Math.min(cmd.rangeScaleM, this.profile.instrumentedRangeM.value) / ((C * wf.pulseWidthS.value) / 2)) * Math.max(1, Math.round(tint * (wf.prfsHz.value[0] as number) / wf.prfsHz.value.length));
    const lookFraction = dt * this.profile.scanRateRadS.value / this.hw.antenna.halfPowerBeamwidthRad;
    const pfaAfterMofN = this.profile.falseAlarmProbability.value ** Math.min(wf.requiredPrfs, wf.prfsHz.value.length) * binomial(wf.prfsHz.value.length, wf.requiredPrfs);
    if (this.rng.nextFloat() < cells * pfaAfterMofN * lookFraction) {
      const range = this.rng.nextFloat() * cmd.rangeScaleM;
      this.addPlot({ timeS: own.timeS, rangeM: range, closureMps: Number.NaN, look: stabilizedAngles(own, to), losEnu: to, snrDb: 13, waveformId: wf.id, falseAlarm: true }, own);
    }
    if (cmd.tws) this.updateTws(own);
  }

  private addPlot(p: RadarPlot, own: SensorOwnship): void {
    this.plots.push(p);
    const auto = this.search?.autoAcquire;
    if (auto && !this.acq && p.rangeM >= auto.minRangeM && p.rangeM <= auto.maxRangeM) {
      this.designate({ look: bodyAngles(own, p.losEnu), frame: "body", rangeM: p.rangeM, rangeWindowM: 600, timeoutS: 2, pattern: { widthRad: this.hw.antenna.halfPowerBeamwidthRad, bars: 1 } });
    }
  }

  private updateTws(own: SensorOwnship): void {
    const fresh = this.plots.filter((p) => p.timeS === own.timeS && !p.falseAlarm);
    for (const p of fresh) {
      const pos: Vector3 = [own.positionEnuM[0] + p.losEnu[0] * p.rangeM, own.positionEnuM[1] + p.losEnu[1] * p.rangeM, own.positionEnuM[2] + p.losEnu[2] * p.rangeM];
      // Gate: 3σ-ish window growing with time since update.
      let best: (typeof this.tws)[number] | null = null, bestD = Infinity;
      for (const t of this.tws) {
        const pred = t.f.predict(own.timeS);
        const d = norm(sub(pred, pos));
        const gate = 500 + 0.04 * p.rangeM + 150 * (own.timeS - t.f.lastUpdateS);
        if (d < gate && d < bestD) { best = t; bestD = d; }
      }
      if (best) { best.f.update(own.timeS, pos, 0.4, 0.15); best.hits++; best.misses = 0; }
      else if (this.tws.length < this.profile.twsCapacity.value) this.tws.push({ id: this.nextTrackId++, f: new AlphaBetaTrack(pos, own.timeS), hits: 1, misses: 0 });
    }
    const frameS = this.frameTimeS();
    this.tws = this.tws.filter((t) => own.timeS - t.f.lastUpdateS < 2.2 * frameS + 1);
  }

  /** Time for one full frame of the current search pattern, s. */
  public frameTimeS(): number {
    const p = this.search?.pattern;
    if (!p) return 0;
    return p.bars * (p.widthRad / this.profile.scanRateRadS.value + this.profile.barTurnaroundS.value);
  }

  private stepAcquire(own: SensorOwnship, scene: SensorScene, dt: number): void {
    const a = this.acq!;
    a.t += dt;
    this.status = "acquire";
    if (a.t > a.req.timeoutS + (a.phase === "slew" ? 1.5 : 0)) { this.lastLoss = { reason: "no acquisition", timeS: own.timeS }; this.acq = null; return; }
    const target = anglesIn(this.lookFrame, own, worldDirection(a.req.frame, own, a.req.look));
    if (a.phase === "slew") {
      this.look = slew(this.look, target, this.profile.slewRateRadS.value, dt);
      if (Math.hypot(this.look.az - target.az, this.look.el - target.el) < 1e-3) a.phase = "search";
      return;
    }
    const bw = this.hw.antenna.halfPowerBeamwidthRad;
    const pat: RasterPattern = { frame: a.req.frame, center: a.req.look, widthRad: a.req.pattern?.widthRad ?? 2 * bw, bars: a.req.pattern?.bars ?? 2, barSpacingRad: bw * 0.8, orientation: "horizontal" };
    const from = this.pointing(own, pat.frame, a.scan.look(pat), this.profile.trackGimbal.value);
    if (a.phase === "search") a.scan.advance(pat, dt);
    const to = a.phase === "search" ? this.pointing(own, pat.frame, a.scan.look(pat), this.profile.trackGimbal.value) : this.pointing(own, "stabilized", stabilizedAngles(own, unit(sub(a.f!.predict(own.timeS), own.positionEnuM))), this.profile.trackGimbal.value);
    this.look = anglesIn(this.lookFrame, own, to);
    const wf = this.trackWaveform(own, to);
    const tint = a.phase === "search" ? this.hw.timeOnTargetS : dt;
    const { look } = this.lookFor(wf, tint);
    const echoes = scene.radar({ originEnuM: own.positionEnuM, ownVelocityEnuMps: own.velocityEnuMps, beamFrom: a.phase === "search" ? from : to, beamTo: to, look, integrationTimeS: tint, reportFloorSnr: 0.05, maxRangeM: this.profile.instrumentedRangeM.value });
    const clutter = echoes.length ? this.clutter(own, scene, to, look, tint / wf.prfsHz.value.length, `acq${wf.id}`) : [];
    let got = false;
    for (const e of echoes) {
      if (Math.abs(e.rangeM - (a.f ? norm(sub(a.f.predict(own.timeS), own.positionEnuM)) : a.req.rangeM)) > (a.f ? 400 : a.req.rangeWindowM)) continue;
      if (e.rangeM < (a.req.minRangeM ?? this.profile.minTrackRangeM.value) || e.rangeM > (a.req.maxRangeM ?? Infinity)) continue;
      const r = this.process(e, wf, to, own, tint, clutter);
      if (!r.detected) continue;
      const m = this.measure(e, wf, r.snr, own, true);
      const pos: Vector3 = [own.positionEnuM[0] + m.los[0] * m.rangeM, own.positionEnuM[1] + m.los[1] * m.rangeM, own.positionEnuM[2] + m.los[2] * m.rangeM];
      if (!a.f) a.f = new AlphaBetaTrack(pos, own.timeS); else a.f.update(own.timeS, pos, 0.5, 0.2);
      a.phase = "confirm";
      a.hits++;
      got = true;
      break;
    }
    if (a.phase === "confirm" && !got && a.f) a.f.coast(own.timeS);
    if (a.phase === "confirm" && a.f && a.t >= this.profile.acquisitionTimeS.value && a.hits >= 3) {
      this.stt = { f: a.f, lastDetectS: own.timeS, since: own.timeS, lastReason: "ok", snrDb: 0, lastLos: null };
      this.acq = null;
      this.status = "track";
    }
  }

  private trackWaveform(own: SensorOwnship, los: Vector3): WaveformSpec {
    // Use the high-duty waveform when the target can be clear of sidelobe clutter, else the range-gated one.
    const wfs = Object.values(this.profile.waveforms);
    const ownSpeed = norm(own.velocityEnuMps);
    const closure = this.stt ? -dot(sub(this.stt.f.velocity, own.velocityEnuMps), los) : ownSpeed * 2;
    const high = wfs.find((w) => !w.rangeGated);
    const med = wfs.find((w) => w.rangeGated);
    return (closure > ownSpeed * (1 + 0) ? high : med) ?? high ?? (wfs[0] as WaveformSpec);
  }

  private stepTrack(own: SensorOwnship, scene: SensorScene, dt: number): void {
    const s = this.stt!;
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
    const { look } = this.lookFor(wf, dt);
    const echoes = scene.radar({ originEnuM: own.positionEnuM, ownVelocityEnuMps: own.velocityEnuMps, beamFrom: los, beamTo: los, look, integrationTimeS: dt, reportFloorSnr: 0.01, maxRangeM: this.profile.instrumentedRangeM.value });
    // Range gate: the echo nearest the predicted range inside the gate.
    const gate = 150 + 60 * (own.timeS - s.lastDetectS) + 0.01 * range;
    const cand = echoes.filter((e) => Math.abs(e.rangeM - range) < gate).sort((a, b) => Math.abs(a.rangeM - range) - Math.abs(b.rangeM - range))[0];
    let detected = false;
    if (cand) {
      const clutter = this.clutter(own, scene, los, look, dt / wf.prfsHz.value.length, `trk${wf.id}`);
      const p = this.process(cand, wf, los, own, dt, clutter);
      s.lastReason = p.reason;
      if (p.detected) {
        const m = this.measure(cand, wf, p.snr, own, true);
        s.f.update(own.timeS, [own.positionEnuM[0] + m.los[0] * m.rangeM, own.positionEnuM[1] + m.los[1] * m.rangeM, own.positionEnuM[2] + m.los[2] * m.rangeM], 0.35, 0.08);
        s.lastDetectS = own.timeS;
        s.snrDb = 10 * Math.log10(p.snr);
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

function binomial(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
