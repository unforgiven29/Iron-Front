/**
 * СПО-15ЛМ radar warning station — channelized analog processor (MiG-29 package).
 *
 * Source for the behaviour: DCS MiG-29A Early Access Manual (Eagle Dynamics), "RHAW. SPO-15LM",
 * pp. 105–112 — a simulator manual describing that product's model, used here as the best available
 * description; numbers it does not give are ESTIMATED and marked so.
 *
 * Implemented as described there:
 *  - 10 physical azimuth channels: front feeds peaking at ±10/30/50/70° (20° half-power beamwidth,
 *    60° in elevation, Luneburg lens) with the 50° and 70° feeds merged into one logical channel;
 *    rear spiral antennas left/right. Beamwidth widens at lower frequency (directivity ∝ frequency),
 *    so low-frequency / high-power signals light several sectors, up to "blinding" every channel.
 *  - Overlapping sectors give double detections; the 90° lamp is virtual = rear + 50° on one side.
 *  - Elevation coverage ±30°; separate, low-efficiency elevation channels (В/Н, mutually exclusive)
 *    that respond only at high power.
 *  - Power level over threshold in 2 dB steps from a less sensitive sum channel; pulsed signals are
 *    shown only from level 1, CW from level 0.
 *  - Type recognition from pulse width and PRF only (6 types; unknown → no type lamp). HPRF signals
 *    are first picked up by the more sensitive CW circuit as a flashing Х (6–14 dB earlier, frequency
 *    dependent); once an HPRF type is recognized, the CW circuit is shut down.
 *  - Two pulse radars on one azimuth: recognized only if the strongest is ≥ 6 dB above the others;
 *    otherwise none is recognized.
 *  - Track mode = detection event longer than 125–250 ms; it marks the whole azimuth channel as
 *    tracking for 2–4 s (other emitters in that channel inherit it). Side lobes of a strong search
 *    radar can therefore read as track.
 *  - Main threat priority (Table 2) with the type priority rows and the azimuth criterion; the main
 *    threat is remembered 8–12 s (search) / 2–4 s (track).
 *  - Search filter switch: when off, only track-mode emitters are shown.
 *  - The whole forward hemisphere is disabled while the own fire-control radar radiates.
 * Not modelled: Nike-Hercules launch detection (also N/I in the source), CW + type С → false П
 * merging (no CW emitters exist in this world), PRF jitter/stagger (no such emitters), BIT.
 */
import type { Quaternion, Vector3 } from "../../../../core/coordinates/CoordinateFrames.js";
import { createScopedRandom, type SeededRandom } from "../../../../core/random/SeededRandom.js";
import type { RfIntercept } from "../../../../physics/radar/RfEmission.js";
import type { SensorScene } from "../../../../physics/sensing/SensorScene.js";
import { rotateVector } from "../../../../physics/rigidbody/RigidBody.js";

const D = Math.PI / 180;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const dbm = (w: number) => 10 * Math.log10(Math.max(1e-30, w)) + 30;

export type SpoType = "П" | "З" | "Х" | "Н" | "F" | "С";
/** Display sectors, left to right (90° are virtual). */
export type SpoSector = "RL" | "L90" | "L50" | "L30" | "L10" | "R10" | "R30" | "R50" | "R90" | "RR";
export const SPO_SECTORS: readonly SpoSector[] = ["RL", "L90", "L50", "L30", "L10", "R10", "R30", "R50", "R90", "RR"];
/** Sector bearing used for the main-threat azimuth criterion, rad. */
const SECTOR_AZ: Record<SpoSector, number> = { RL: -135 * D, L90: -90 * D, L50: -50 * D, L30: -30 * D, L10: -10 * D, R10: 10 * D, R30: 30 * D, R50: 50 * D, R90: 90 * D, RR: 135 * D };

interface Channel { readonly id: string; readonly sector: Exclude<SpoSector, "L90" | "R90">; readonly azRad: number; readonly peakDbi: number; readonly bw10GHzRad: number; readonly floorDb: number; readonly front: boolean }

/** Physical channels (feeds). ESTIMATED gains/floors; beamwidths and peaks from the source. */
const CHANNELS: readonly Channel[] = [
  ...[10, 30, 50, 70].flatMap((a) => [
    { id: `L${a}`, sector: (a >= 50 ? "L50" : `L${a}`) as Channel["sector"], azRad: -a * D, peakDbi: 12, bw10GHzRad: 20 * D, floorDb: -22, front: true },
    { id: `R${a}`, sector: (a >= 50 ? "R50" : `R${a}`) as Channel["sector"], azRad: a * D, peakDbi: 12, bw10GHzRad: 20 * D, floorDb: -22, front: true }
  ]),
  { id: "RL", sector: "RL", azRad: -135 * D, peakDbi: 3, bw10GHzRad: 90 * D, floorDb: -18, front: false },
  { id: "RR", sector: "RR", azRad: 135 * D, peakDbi: 3, bw10GHzRad: 90 * D, floorDb: -18, front: false }
];

export interface Spo15LmConfig {
  readonly bandHz: readonly [number, number];
  /** Azimuth-channel detection threshold at the antenna port, dBm (ESTIMATED). */
  readonly azimuthThresholdDbm: number;
  /** Sum channel power level 0 threshold, dBm (ESTIMATED; "much less sensitive" than azimuth channels). */
  readonly sumThresholdDbm: number;
  /** Elevation channels respond from this power level (ESTIMATED; "well within the WEZ"). */
  readonly elevationMinLevel: number;
  /** Track-mode detection event length, s (source: 125–250 ms). */
  readonly trackEventS: number;
  /** Channel stays marked tracking, s (source: 2–4 s). */
  readonly trackHoldS: number;
  /** Main threat memory in search / track, s (source: 8–12 s / 2–4 s). */
  readonly mainMemorySearchS: number;
  readonly mainMemoryTrackS: number;
  /** Minimum lamp flash per detection, s (source: ≥ 125 ms). */
  readonly flashS: number;
  /** Amplitude noise per channel, dB (ESTIMATED). */
  readonly noiseDb: number;
}

export const SPO15LM_CONFIG: Spo15LmConfig = {
  bandHz: [1.2e9, 18e9], azimuthThresholdDbm: -58, sumThresholdDbm: -50, elevationMinLevel: 9,
  trackEventS: 0.19, trackHoldS: 3, mainMemorySearchS: 10, mainMemoryTrackS: 3, flashS: 0.125, noiseDb: 1
};

/** Type recognition from PRF and pulse width (Table 1 rules; parameter windows ESTIMATED). */
export function recognizeType(prfHz: number, pulseWidthS: number, cw: boolean): SpoType | null {
  if (cw) return "Х";
  if (prfHz >= 8e3 && pulseWidthS >= 0.2e-6 && pulseWidthS <= 2.5e-6) return "F"; // 4th-gen (HPRF/MPRF) fighter radar
  if (prfHz >= 1e3 && prfHz < 8e3 && pulseWidthS <= 3e-6) return "С"; // LPRF fighter / other fire control
  if (prfHz >= 2e3 && pulseWidthS > 3e-6) return "З";
  if (prfHz < 1e3 && pulseWidthS > 5e-6) return "Н";
  return null;
}

const ROW_HIGH: readonly SpoType[] = ["П", "З", "Х", "Н", "F", "С"];
const ROW_LOW: readonly SpoType[] = ["Х", "Н", "F", "П", "З", "С"];
/** Azimuth-altitude criterion (source p.109–110): is this type/azimuth a high-priority threat? */
function highPriority(type: SpoType, azRad: number): boolean {
  const a = Math.abs(azRad) / D;
  const abeam = a > 60 && a < 120;
  switch (type) {
    case "П": case "F": return !abeam;
    case "З": case "Х": return a < 90;
    case "Н": return a < 30 || abeam;
    case "С": return a < 30 || !abeam;
  }
}

export interface SpoEmitterReport {
  readonly sectors: readonly SpoSector[];
  readonly level: number;
  readonly type: SpoType | null;
  /** Low-power Х from the CW circuit catching an HPRF signal (shown flashing). */
  readonly ambiguousX: boolean;
  readonly track: boolean;
  readonly elevation: "В" | "Н" | null;
}

export interface Spo15LmState {
  readonly powered: boolean;
  readonly ready: boolean;
  readonly searchAllowed: boolean;
  readonly frontBlanked: boolean;
  /** Lamps lit this frame (with the minimum flash). */
  readonly litSectors: ReadonlySet<SpoSector>;
  readonly main: (SpoEmitterReport & { readonly sector: SpoSector }) | null;
  readonly trackWarning: boolean;
  /** Type lamps of every recognized emitter (main threat's marked separately). */
  readonly types: ReadonlySet<SpoType>;
  readonly flashingX: boolean;
  /** Count of detection events this tick (low tone per detection). */
  readonly detections: number;
}

interface Run { startS: number; lastS: number }

export class Spo15Lm {
  private rng: SeededRandom;
  private powered = true;
  private search = true;
  private time = 0;
  private flashUntil = new Map<SpoSector, number>();
  private trackUntil = new Map<SpoSector, number>();
  /** Continuous-detection runs per emitter-signature key (carrier bin + PRF bin + sector). */
  private runs = new Map<string, Run>();
  private cwShutdown = false;
  private mainMem: { report: SpoEmitterReport & { sector: SpoSector }; until: number } | null = null;
  private last: Spo15LmState;

  public constructor(private readonly cfg: Spo15LmConfig = SPO15LM_CONFIG, seed = 15) {
    this.rng = createScopedRandom(seed, "spo15lm");
    this.last = this.empty(false);
  }

  private empty(frontBlanked: boolean): Spo15LmState {
    return { powered: this.powered, ready: this.powered, searchAllowed: this.search, frontBlanked, litSectors: new Set(), main: null, trackWarning: false, types: new Set(), flashingX: false, detections: 0 };
  }

  public setPower(on: boolean): void { this.powered = on; if (!on) this.reset(); }
  public setSearchAllowed(on: boolean): void { this.search = on; }
  public get searchAllowed(): boolean { return this.search; }
  public reset(): void { this.flashUntil.clear(); this.trackUntil.clear(); this.runs.clear(); this.mainMem = null; this.cwShutdown = false; this.rng = createScopedRandom(15, "spo15lm"); this.last = this.empty(false); }
  public get state(): Spo15LmState { return this.last; }

  private noise(): number { const u = Math.max(1e-12, this.rng.nextFloat()), v = this.rng.nextFloat(); return this.cfg.noiseDb * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /** Channel gain toward a body direction, dB. Beamwidth ∝ 1/frequency; ±30° elevation coverage. */
  private gain(c: Channel, az: number, el: number, f: number): number {
    const bw = c.bw10GHzRad * Math.min(3, 10e9 / f);
    const off = wrap(az - c.azRad);
    const elLoss = Math.abs(el) <= 30 * D ? 12 * (el / (60 * D)) ** 2 : 3 + 40 * (Math.abs(el) / D - 30) / 30;
    return Math.max(c.peakDbi - 12 * (off / bw) ** 2, c.peakDbi + c.floorDb) - elLoss;
  }

  public step(own: { timeS: number; positionEnuM: Vector3; bodyToWorld: Quaternion }, scene: SensorScene, dt: number, ownRadarRadiating: boolean): void {
    this.time = own.timeS;
    if (!this.powered) { this.last = this.empty(false); return; }
    const cfg = this.cfg;
    const q = own.bodyToWorld;
    const all: readonly RfIntercept[] = scene.rf?.({ positionEnuM: own.positionEnuM, timeS: own.timeS, dtS: dt }) ?? [];
    interface Sig { key: string; sectors: Set<Exclude<SpoSector, "L90" | "R90">>; level: number; sumDbm: number; type: SpoType | null; ambiguousX: boolean; cw: boolean; prf: number; el: number; peakSector: Exclude<SpoSector, "L90" | "R90">; az: number }
    const sigs: Sig[] = [];
    let detections = 0;
    for (const x of all) {
      if (x.carrierHz < cfg.bandHz[0] || x.carrierHz > cfg.bandHz[1]) continue;
      const b = rotateVector([-q[0], -q[1], -q[2], q[3]], x.arrivalEnu);
      const az = Math.atan2(b[1], b[0]), el = Math.asin(Math.max(-1, Math.min(1, -b[2])));
      const p = dbm(x.isotropicPowerW);
      const lit = new Set<Exclude<SpoSector, "L90" | "R90">>();
      let best = -Infinity, peakSector: Sig["peakSector"] = "L10";
      for (const c of CHANNELS) {
        if (c.front && ownRadarRadiating) continue; // forward hemisphere disabled while the FCR radiates
        const lvl = p + this.gain(c, az, el, x.carrierHz) + this.noise();
        if (lvl >= cfg.azimuthThresholdDbm) lit.add(c.sector);
        if (lvl > best) { best = lvl; peakSector = c.sector; }
      }
      if (lit.size === 0) continue;
      // Sum channel: power over threshold in 2 dB steps (0..15). Pulsed signals need level ≥ 1.
      const sum = best - 8; // ESTIMATED sum-channel efficiency relative to the best azimuth feed
      const level = Math.max(-1, Math.min(15, Math.floor((sum - cfg.sumThresholdDbm) / 2)));
      let type: SpoType | null = null, ambiguousX = false;
      if (x.cw) { if (level < 0 || this.cwShutdown) continue; type = "Х"; }
      else {
        const t = recognizeType(x.prfHz, x.pulseWidthS, false);
        const hprf = x.prfHz >= 50e3;
        if (level < 1) {
          // CW circuit picks up HPRF 6–14 dB before the pulse circuit (frequency dependent).
          const margin = 6 + 8 * Math.min(1, Math.max(0, (x.carrierHz - cfg.bandHz[0]) / (cfg.bandHz[1] - cfg.bandHz[0])));
          if (!hprf || this.cwShutdown || sum + margin < cfg.sumThresholdDbm + 2) continue;
          type = "Х"; ambiguousX = true;
        } else type = t;
      }
      detections++;
      const key = `${Math.round(x.carrierHz / 50e6)}:${Math.round(Math.log(Math.max(1, x.prfHz)) * 20)}`;
      sigs.push({ key, sectors: lit, level: Math.max(0, level), sumDbm: sum, type, ambiguousX, cw: x.cw, prf: x.prfHz, el, peakSector, az });
    }
    // Two or more pulse radars on one azimuth: only one ≥ 6 dB above the rest is recognized.
    for (const s of sigs) {
      if (s.cw) continue;
      const rivals = sigs.filter((o) => o !== s && !o.cw && o.peakSector === s.peakSector);
      if (rivals.length && !rivals.every((o) => s.sumDbm - o.sumDbm >= 6)) { s.type = null; s.ambiguousX = false; }
    }
    if (sigs.some((s) => s.type === "F" && !s.ambiguousX && s.prf >= 50e3)) this.cwShutdown = true;
    // Detection events and track mode (per azimuth channel).
    const seen = new Set<string>();
    for (const s of sigs) {
      // Event length is measured per azimuth channel (each channel is processed on its own).
      for (const sec of s.sectors) {
        const key = `${s.key}@${sec}`;
        seen.add(key);
        const r = this.runs.get(key);
        if (r && own.timeS - r.lastS <= dt * 1.5 + 1e-6) r.lastS = own.timeS; else this.runs.set(key, { startS: own.timeS - dt, lastS: own.timeS });
        if (own.timeS - this.runs.get(key)!.startS > cfg.trackEventS) this.trackUntil.set(sec, own.timeS + cfg.trackHoldS);
        this.flashUntil.set(sec, Math.max(this.flashUntil.get(sec) ?? 0, own.timeS + cfg.flashS));
      }
    }
    for (const [k, r] of this.runs) if (!seen.has(k) && own.timeS - r.lastS > 1) this.runs.delete(k);
    const tracking = (sec: SpoSector) => (this.trackUntil.get(sec) ?? 0) > own.timeS;
    // Reports (track inherited by everything in a tracking channel); search filter.
    const reports = sigs.map((s) => ({ s, track: [...s.sectors].some(tracking) })).filter((r) => this.search || r.track);
    // Lamps: physical sectors plus the virtual 90° (rear + 50° on one side).
    const lit = new Set<SpoSector>();
    for (const [sec, until] of this.flashUntil) if (until > own.timeS && (this.search || tracking(sec))) lit.add(sec);
    if (lit.has("RL") && lit.has("L50")) lit.add("L90");
    if (lit.has("RR") && lit.has("R50")) lit.add("R90");
    // Main threat (Table 2): track > type priority row (azimuth criterion) > PRF > 781 Hz > power.
    const score = (r: (typeof reports)[number]) => {
      const t = r.s.type;
      const az = SECTOR_AZ[r.s.peakSector];
      const row = t ? (highPriority(t, az) ? ROW_HIGH : ROW_LOW) : null;
      const rowRank = t && row ? (row === ROW_HIGH ? 20 : 10) + (6 - row.indexOf(t)) : 0;
      return (r.track ? 1000 : 0) + rowRank * 10 + (r.s.prf > 781 ? 5 : 0) + r.s.level * 0.1;
    };
    const best = [...reports].sort((a, b) => score(b) - score(a))[0];
    if (best) {
      const side = best.s.peakSector[0] === "L" || best.s.peakSector === "RL" ? "L" : "R";
      const virtual90 = best.s.sectors.has(side === "L" ? "RL" : "RR") && best.s.sectors.has(side === "L" ? "L50" : "R50");
      const sector: SpoSector = virtual90 ? (side === "L" ? "L90" : "R90") : best.s.peakSector;
      const elevation = best.s.level >= cfg.elevationMinLevel ? (best.s.el >= 0 ? "В" : "Н") : null;
      const report = { sectors: [...best.s.sectors], level: best.s.level, type: best.s.type, ambiguousX: best.s.ambiguousX, track: best.track, elevation, sector } as const;
      const prev = this.mainMem;
      if (!prev || prev.until <= own.timeS || score(best) >= 0) this.mainMem = { report, until: own.timeS + (best.track ? cfg.mainMemoryTrackS : cfg.mainMemorySearchS) };
    } else if (this.mainMem && this.mainMem.until <= own.timeS) this.mainMem = null;
    const types = new Set<SpoType>();
    for (const r of reports) if (r.s.type && !r.s.ambiguousX) types.add(r.s.type);
    this.last = {
      powered: true, ready: true, searchAllowed: this.search, frontBlanked: ownRadarRadiating, litSectors: lit,
      main: this.mainMem?.report ?? null, trackWarning: reports.some((r) => r.track), types,
      flashingX: reports.some((r) => r.s.ambiguousX), detections
    };
  }
}
