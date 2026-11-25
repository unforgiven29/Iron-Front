/**
 * Shared radar-warning-receiver engine (owner: sensors/rwr). Aircraft packages supply the installed
 * fit (antennas, band, sensitivity, direction finding, threat library) as an RwrProfile and draw
 * their own cockpit display from the contacts this engine reports.
 *
 * Causal chain: SensorScene.rf() direct-path intercepts → per-antenna received power (installed
 * antenna pattern in the aircraft body frame + amplitude noise) → detection against sensitivity →
 * measured bearing from amplitude comparison of the two strongest antennas (or quantized to the
 * fit's sectors), measured carrier / PRF / pulse width with errors → association into emitter
 * tracks by measured parameters and bearing → library matching with ambiguity → evidence-based
 * assessments: "steady illumination" (an unscanned beam held on this aircraft, inferred from a
 * continuous, flat amplitude history) and "missile seeker" (library category). No range is ever
 * reported, and nothing is read from emitters' private state.
 */
import type { Quaternion, Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { createScopedRandom, type SeededRandom } from "../../core/random/SeededRandom.js";
import type { RfIntercept } from "../../physics/radar/RfEmission.js";
import type { SensorScene } from "../../physics/sensing/SensorScene.js";
import { rotateVector } from "../../physics/rigidbody/RigidBody.js";

export interface RwrAntenna {
  readonly id: string;
  /** Boresight azimuth in the body frame, rad (+ = right of the nose). */
  readonly azimuthRad: number;
  readonly peakGainDbi: number;
  /** Half-power full beamwidth in azimuth, rad. */
  readonly beamwidthRad: number;
  /** Floor of the pattern relative to peak (back lobe), dB (negative). */
  readonly floorDb: number;
}

export type RwrCategory = "airborne-radar" | "missile-seeker" | "ground-radar";

export interface RwrLibraryEntry {
  readonly id: string;
  /** Display symbol (package decides how to draw it). */
  readonly symbol: string;
  readonly category: RwrCategory;
  readonly bandHz: readonly [number, number];
  /** PRF windows the entry accepts (any of them); empty = CW only. */
  readonly prfHz: readonly (readonly [number, number])[];
  readonly pulseWidthS: readonly [number, number];
  /** Priority weight for display ordering (higher = more dangerous). */
  readonly lethality: number;
}

export interface RwrProfile {
  readonly id: string;
  readonly designation: string;
  /** One line per value group: where it comes from (most are ESTIMATED; no public exact data). */
  readonly provenance: readonly string[];
  readonly bandHz: readonly [number, number];
  /** Minimum detectable signal at an antenna port, dBm. */
  readonly sensitivityDbm: number;
  /** 1-σ amplitude measurement noise per antenna, dB (drives the direction-finding error). */
  readonly amplitudeNoiseDb: number;
  readonly antennas: readonly RwrAntenna[];
  /** "continuous": amplitude-comparison bearing; "sectors": bearing reported as the centre of the lit sector. Sector edges in rad, ascending, covering −π…π. */
  readonly directionFinding: { readonly kind: "continuous" } | { readonly kind: "sectors"; readonly edgesRad: readonly number[] };
  /** 1-σ frequency measurement error, Hz (a crystal-video receiver measures only the band: use a large value). */
  readonly frequencySigmaHz: number;
  readonly prfRelativeSigma: number;
  readonly pulseWidthSigmaS: number;
  /** Time a new emitter takes to be processed and displayed, s. */
  readonly processingDelayS: number;
  /** A track is dropped after this long without an intercept, s. */
  readonly dropAfterS: number;
  /** Steady-illumination inference: continuous intercepts for at least `minS` with an amplitude standard deviation ≤ `maxStdDb`. */
  readonly steady: { readonly minS: number; readonly maxStdDb: number };
  readonly maxTracks: number;
  readonly library: readonly RwrLibraryEntry[];
}

export interface RwrOwnship {
  readonly timeS: number;
  readonly positionEnuM: Vector3;
  readonly bodyToWorld: Quaternion;
  readonly headingRad: number;
}

export interface RwrContact {
  readonly id: number;
  /** Measured bearing relative to the nose (body azimuth), rad, + = right. */
  readonly bearingRad: number;
  /** Measured bearing in the world (true azimuth from north), rad. */
  readonly trueBearingRad: number;
  /** Peak received level over the last second, dBm. */
  readonly levelDbm: number;
  /** Library match: symbol and category, or null when unknown. */
  readonly match: { readonly entry: RwrLibraryEntry; readonly confidence: number } | null;
  /** Several entries fit the measurements equally. */
  readonly ambiguous: boolean;
  readonly steadyIllumination: boolean;
  readonly isNew: boolean;
  readonly ageS: number;
  readonly lastSeenS: number;
  readonly measured: { readonly carrierHz: number; readonly prfHz: number; readonly pulseWidthS: number; readonly cw: boolean };
}

interface Track {
  id: number;
  createdS: number;
  lastS: number;
  /** World azimuth as a unit vector (smoothed). */
  az: [number, number];
  carrierHz: number;
  prfHz: number;
  pulseWidthS: number;
  cw: boolean;
  /** (time, level dBm) of recent intercepts. */
  history: { t: number; dbm: number }[];
  /** Start of the current run of uninterrupted intercepts. */
  runStartS: number;
  lastDbm: number;
}

const TAU = Math.PI * 2;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const toDbm = (w: number) => 10 * Math.log10(Math.max(1e-30, w)) + 30;

/** Installed antenna gain toward a body azimuth, dBi (Gaussian beam on a floor). */
export function antennaGainDb(a: RwrAntenna, bodyAzRad: number): number {
  const off = wrap(bodyAzRad - a.azimuthRad);
  return Math.max(a.peakGainDbi - 12 * (off / a.beamwidthRad) ** 2, a.peakGainDbi + a.floorDb);
}

/**
 * Amplitude-comparison bearing from the two strongest antennas (levels in dB). For Gaussian beams
 * of equal width the level difference is linear in angle: θ = (θa+θb)/2 + ΔdB·bw² / (24·(θa−θb)).
 */
export function amplitudeBearing(antennas: readonly RwrAntenna[], levelsDb: readonly number[]): number {
  const order = levelsDb.map((l, i) => ({ l, i })).sort((x, y) => y.l - x.l);
  const a = antennas[order[0]!.i]!, b = antennas[order[1]!.i]!;
  const da = levelsDb[order[0]!.i]!, db = levelsDb[order[1]!.i]!;
  const sep = wrap(a.azimuthRad - b.azimuthRad);
  if (Math.abs(sep) < 1e-6) return a.azimuthRad;
  const bw = (a.beamwidthRad + b.beamwidthRad) / 2;
  const mid = b.azimuthRad + sep / 2;
  const theta = mid + ((da - db) * bw * bw) / (24 * sep);
  // Never beyond the strongest antenna's side of the pair by more than half the spacing.
  const lim = Math.abs(sep) / 2 + Math.abs(sep) * 0.5;
  const rel = Math.max(-lim, Math.min(lim, wrap(theta - mid)));
  return wrap(mid + rel);
}

export class RadarWarningReceiver {
  private tracks: Track[] = [];
  private n = 0;
  private rng: SeededRandom;
  private powered = true;
  private own: RwrOwnship | null = null;
  /** Diagnostics for the last step. */
  public lastStep = { intercepts: 0, outOfBand: 0, belowSensitivity: 0, detections: 0 };

  public constructor(public readonly profile: RwrProfile, private readonly seed = 56) {
    this.rng = createScopedRandom(seed, "rwr", profile.id);
  }

  public reset(): void { this.tracks = []; this.n = 0; this.rng = createScopedRandom(this.seed, "rwr", this.profile.id); }
  public setPower(on: boolean): void { this.powered = on; if (!on) this.tracks = []; }
  public get isPowered(): boolean { return this.powered; }

  private gauss(): number {
    const u = Math.max(1e-12, this.rng.nextFloat()), v = this.rng.nextFloat();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  public step(own: RwrOwnship, scene: SensorScene, dt: number): void {
    this.own = own;
    if (!this.powered) return;
    const p = this.profile;
    const intercepts: readonly RfIntercept[] = scene.rf?.({ positionEnuM: own.positionEnuM, timeS: own.timeS, dtS: dt }) ?? [];
    const diag = { intercepts: intercepts.length, outOfBand: 0, belowSensitivity: 0, detections: 0 };
    for (const x of intercepts) {
      if (x.carrierHz < p.bandHz[0] || x.carrierHz > p.bandHz[1]) { diag.outOfBand++; continue; }
      // Direction of arrival in the body frame (the airframe is the antenna platform).
      const b = rotateVector([-own.bodyToWorld[0], -own.bodyToWorld[1], -own.bodyToWorld[2], own.bodyToWorld[3]], x.arrivalEnu);
      const bodyAz = Math.atan2(b[1], b[0]);
      const base = toDbm(x.isotropicPowerW);
      const levels = p.antennas.map((a) => base + antennaGainDb(a, bodyAz) + p.amplitudeNoiseDb * this.gauss());
      const peak = Math.max(...levels);
      if (peak < p.sensitivityDbm) { diag.belowSensitivity++; continue; }
      diag.detections++;
      let az = amplitudeBearing(p.antennas, levels);
      if (p.directionFinding.kind === "sectors") az = sectorCentre(p.directionFinding.edgesRad, az);
      // Body azimuth → world azimuth (level-plane approximation using the INS heading).
      const worldAz = wrap(own.headingRad + az);
      const m = {
        carrierHz: x.carrierHz + p.frequencySigmaHz * this.gauss(),
        prfHz: x.cw ? 0 : x.prfHz * (1 + p.prfRelativeSigma * this.gauss()),
        pulseWidthS: x.cw ? 0 : Math.max(1e-8, x.pulseWidthS + p.pulseWidthSigmaS * this.gauss()),
        cw: x.cw
      };
      this.associate(own.timeS, worldAz, peak, m, dt);
    }
    this.lastStep = diag;
    // Lifecycle: drop stale tracks; break runs that missed a tick.
    this.tracks = this.tracks.filter((t) => own.timeS - t.lastS <= p.dropAfterS);
    for (const t of this.tracks) {
      if (own.timeS - t.lastS > 1.5 * dt + 1e-6) t.runStartS = Number.NaN;
      t.history = t.history.filter((h) => own.timeS - h.t <= Math.max(1.5, p.steady.minS + 0.5));
    }
  }

  private associate(t: number, worldAz: number, dbm: number, m: { carrierHz: number; prfHz: number; pulseWidthS: number; cw: boolean }, dt: number): void {
    const p = this.profile;
    const azGate = p.directionFinding.kind === "sectors" ? 50 * Math.PI / 180 : 45 * Math.PI / 180;
    const fGate = Math.max(300e6, 4 * p.frequencySigmaHz);
    // A receiver that measures the carrier finely (≤ 20 MHz 1-σ) keeps an emitter through a PRF/mode
    // change when carrier and bearing still agree; a coarse receiver can only use PRF.
    const fineCarrier = p.frequencySigmaHz <= 20e6;
    const fits = (k: Track) => k.cw === m.cw && Math.abs(k.carrierHz - m.carrierHz) < fGate
      && Math.abs(wrap(Math.atan2(k.az[1], k.az[0]) - worldAz)) < azGate
      && (m.cw || Math.abs(m.prfHz / k.prfHz - 1) < 0.06 + 4 * p.prfRelativeSigma || (fineCarrier && Math.abs(k.carrierHz - m.carrierHz) < 5 * p.frequencySigmaHz));
    const match = this.tracks.filter(fits).sort((a, b) => Math.abs(a.carrierHz - m.carrierHz) - Math.abs(b.carrierHz - m.carrierHz))[0];
    if (match) {
      // Sector DF reports the lit sector as is; continuous DF is smoothed.
      const k = p.directionFinding.kind === "sectors" ? 1 : 0.25;
      match.az = [match.az[0] * (1 - k) + Math.cos(worldAz) * k, match.az[1] * (1 - k) + Math.sin(worldAz) * k];
      match.carrierHz += 0.2 * (m.carrierHz - match.carrierHz);
      const modeChange = !m.cw && Math.abs(m.prfHz / match.prfHz - 1) > 0.06 + 4 * p.prfRelativeSigma;
      match.prfHz = m.cw ? 0 : modeChange ? m.prfHz : match.prfHz + 0.2 * (m.prfHz - match.prfHz);
      match.pulseWidthS = m.cw ? 0 : modeChange ? m.pulseWidthS : match.pulseWidthS + 0.2 * (m.pulseWidthS - match.pulseWidthS);
      if (modeChange) { match.runStartS = Number.NaN; match.history = []; }
      if (!Number.isFinite(match.runStartS) || t - match.lastS > 1.5 * dt + 1e-6) match.runStartS = t;
      match.lastS = t;
      match.lastDbm = dbm;
      match.history.push({ t, dbm });
      return;
    }
    if (this.tracks.length >= p.maxTracks) {
      // Channel/track capacity: the weakest track gives way only to a stronger signal.
      const weakest = [...this.tracks].sort((a, b) => level(a) - level(b))[0];
      if (!weakest || level(weakest) >= dbm) return;
      this.tracks = this.tracks.filter((x) => x !== weakest);
    }
    this.tracks.push({ id: ++this.n, createdS: t, lastS: t, az: [Math.cos(worldAz), Math.sin(worldAz)], carrierHz: m.carrierHz, prfHz: m.prfHz, pulseWidthS: m.pulseWidthS, cw: m.cw, history: [{ t, dbm }], runStartS: t, lastDbm: dbm });
  }

  private classify(k: Track): { match: RwrContact["match"]; ambiguous: boolean } {
    const fits = this.profile.library.filter((e) => k.carrierHz >= e.bandHz[0] && k.carrierHz <= e.bandHz[1]
      && (k.cw ? e.prfHz.length === 0 : e.prfHz.some(([a, b]) => k.prfHz >= a && k.prfHz <= b) && k.pulseWidthS >= e.pulseWidthS[0] && k.pulseWidthS <= e.pulseWidthS[1]));
    if (fits.length === 0) return { match: null, ambiguous: false };
    const best = [...fits].sort((a, b) => b.lethality - a.lethality)[0]!;
    return { match: { entry: best, confidence: 1 / fits.length }, ambiguous: fits.length > 1 };
  }

  /** Displayable contacts (processing delay applied), most dangerous first. */
  public contacts(): RwrContact[] {
    const own = this.own;
    if (!own || !this.powered) return [];
    const p = this.profile;
    const out: RwrContact[] = [];
    for (const k of this.tracks) {
      if (own.timeS - k.createdS < p.processingDelayS) continue;
      const worldAz = Math.atan2(k.az[1], k.az[0]);
      const recent = k.history.filter((h) => own.timeS - h.t <= 1);
      const lvl = recent.length ? Math.max(...recent.map((h) => h.dbm)) : k.lastDbm;
      const run = k.history.filter((h) => Number.isFinite(k.runStartS) && h.t >= k.runStartS);
      const mean = run.reduce((a, h) => a + h.dbm, 0) / Math.max(1, run.length);
      const std = run.length > 1 ? Math.sqrt(run.reduce((a, h) => a + (h.dbm - mean) ** 2, 0) / (run.length - 1)) : Infinity;
      const steady = Number.isFinite(k.runStartS) && own.timeS - k.runStartS >= p.steady.minS && std <= p.steady.maxStdDb && own.timeS - k.lastS < 0.1;
      const { match, ambiguous } = this.classify(k);
      out.push({ id: k.id, bearingRad: wrap(worldAz - own.headingRad), trueBearingRad: worldAz, levelDbm: lvl, match, ambiguous, steadyIllumination: steady,
        isNew: own.timeS - k.createdS < p.processingDelayS + 2, ageS: own.timeS - k.createdS, lastSeenS: k.lastS,
        measured: { carrierHz: k.carrierHz, prfHz: k.prfHz, pulseWidthS: k.pulseWidthS, cw: k.cw } });
    }
    return out.sort((a, b) => threatScore(b) - threatScore(a));
  }
}

function level(k: Track): number { return k.history.length ? Math.max(...k.history.map((h) => h.dbm)) : k.lastDbm; }

export function threatScore(c: RwrContact): number {
  return (c.match?.entry.category === "missile-seeker" ? 1000 : 0) + (c.steadyIllumination ? 500 : 0) + (c.match?.entry.lethality ?? 0) * 10 + c.levelDbm;
}

/** Centre of the sector containing a bearing (edges ascending in −π…π). */
export function sectorCentre(edges: readonly number[], az: number): number {
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i]!, b = edges[i + 1]!;
    if (az >= a && az < b) return (a + b) / 2;
  }
  // Wrap-around sector (last edge → first edge through ±π).
  const a = edges[edges.length - 1]!, b = edges[0]! + TAU;
  return wrap((a + b) / 2);
}
