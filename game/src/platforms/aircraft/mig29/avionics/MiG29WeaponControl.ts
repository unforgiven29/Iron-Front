/**
 * MiG-29 weapon-control system (СУВ-29): RLPK-29 radar + OEPrNK-29 (KOLS) mode logic, the pilot's
 * panel controls and the ИЛС (HUD) / head-down picture.
 *
 * Sources: BP-29 (MiG-29 combat employment manual, 2nd ed.) for modes and HUD formats (figs 13, 15,
 * 16, 19–23, 55); RLPK (Voitchuk, «Fighter radar sighting complex», 2012) for the control panels
 * ПУР-31 / ПСР-31 / С-31 (slide 61), search zones №4/№5 (slide 39) and the leading-channel rules
 * of the radar–OEPS interaction (slide 65).
 *
 * Not modelled (stated): ground-controlled ("приборное") guidance and datalink commands; КОМПЕНС
 * (sidelobe compensation channel) and АП/АПК anti-jam modes; IFF (СВОЙ/ЧУЖОЙ); weapons — launch
 * zones are an approximation of BP-29 figs 17–18 for display only; gun modes (НО) need the gun.
 * The helmet sight (ШЛЕМ) is the pilot's view direction.
 */
import type { Vector3 } from "../../../../core/coordinates/CoordinateFrames.js";
import type { DisplayList, DisplayPrimitive } from "../../../../rendering/instruments/DisplayList.js";
import { norm, sub, unit } from "../../../../physics/sensing/SweepGeometry.js";
import { bodyAngles, DEG, type LookAngles, type RasterPattern, type SensorOwnship } from "../../../../sensors/common/ScanGeometry.js";
import { ScanningIrst } from "../../../../sensors/irst/ScanningIrst.js";
import { PulseDopplerRadar, type RadarTrackReport } from "../../../../sensors/radar/PulseDopplerRadar.js";
import { decodeStores, type AudioCues, type AvionicsContext, type AvionicsControl, type AvionicsSuite } from "../../common/Avionics.js";
import { MIG29_STORES } from "../MiG29Stores.js";
import { spo15Display } from "./Spo15.js";
import { Spo15Lm } from "./Spo15Lm.js";
import { KOLS_PROFILE } from "./KolsProfile.js";
import { SOVIET_AAM } from "../../../../weapons/catalog/SovietAirToAir.js";
import { launchZone, type LauncherLink, type MissileSpec } from "../../../../weapons/missiles/Missile.js";
import { add, scale } from "../../../../physics/sensing/SweepGeometry.js";
import { N019_PROFILE } from "./N019Profile.js";

/** РЕЖ.СУВ selector positions used here (RLPK slide 61: КБР, НВГ, РЛС, СТРОБ/ТП, Б.БОЙ, ШЛЕМ, ОПТ, φ0). */
export type Master = "НВГ" | "РЛС" | "ТП" | "ББ" | "ШЛЕМ" | "ОПТ" | "БРСТ";
export type RadarMode = "В" | "Д" | "АВТ" | "БЛ.БОЙ";
export type Emission = "ИЗЛ" | "ЭКВ" | "ОТКЛ";
export type Snp = "ОТКЛ" | "ППС" | "ЗПС";

const MASTERS: readonly Master[] = ["НВГ", "РЛС", "ТП", "ББ", "ШЛЕМ", "ОПТ", "БРСТ"];
/** English names shown on the ИЛС and in the controls list. */
export const MASTER_EN: Record<Master, string> = { "НВГ": "NAV", "РЛС": "RDR", "ТП": "IRST", "ББ": "CC", "ШЛЕМ": "HMS", "ОПТ": "OPT", "БРСТ": "BRST" };
/** English equivalents of the Cyrillic ИЛС legends (menu option). */
const EN: Record<string, string> = {
  "РЛ": "RL", "ТП": "IR", "А": "A", "ПР": "LA", "ППС": "HEAD", "ЗПС": "TAIL", "ЗАХВ": "ACQ", "СРЫВ": "BREAK", "Б.Б": "CC", "ШЛЕМ": "HMS", "ОПТ": "OPT", "ВИЗ": "BRST", "НВГ": "NAV",
  "УСИЛ": "GAIN", "ΔН": "dH", "Д": "R", "Ṽ": "Vc", "ПОРАЖ": "KILL", "ПРОМАХ": "MISS", "НЕТ": "NONE", "27Р": "R27R", "27ЭР": "R27ER", "27Т": "R27T", "27ЭТ": "R27ET", "60М": "R60M", "73": "R73",
  "ИЗЛ": "TX", "ЭКВ": "STBY", "ОТКЛ": "OFF", "ТОРМ": "COOP", "СНП": "TWS", "БЕЗ": "NO", "КОМП": "GUARD", "РЛС": "RDR", "КОЛС": "IRST",
  "ОБЗОР": "SEARCH", "СОПР": "TRACK", "ПАМЯТЬ": "MEMORY", "ПРОГРЕВ": "WARMUP", "ЦУ": "SLAVED", "В": "HEAD-ON", "АВТ": "AUTO", "БЛ.БОЙ": "DOGFIGHT"
};
/** ИЛС legends are Cyrillic, as on the aircraft. */
const STATE_RU: Record<string, string> = { off: "ОТКЛ", warmup: "ПРОГРЕВ", standby: "ЭКВ", search: "ОБЗОР", acquire: "ЗАХВ", track: "СОПР", memory: "ПАМЯТЬ", slaved: "ЦУ" };
const MISSILE_RU: Record<string, string> = { r27r: "27Р", r27er: "27ЭР", r27t: "27Т", r27et: "27ЭТ", r60m: "60М", r73a: "73" };
export const RADAR_MODE_EN: Record<RadarMode, string> = { "В": "HEAD-ON", "Д": "TAIL", "АВТ": "AUTO", "БЛ.БОЙ": "DOGFIGHT" };
const RADAR_MODES: readonly RadarMode[] = ["В", "Д", "АВТ", "БЛ.БОЙ"];
/** ΔH switch positions, km (RLPK slide 61, ПУР-31: −6 … +10). */
const DH_KM = [-6, -4, -2, -1, 0, 1, 2, 4, 6, 8, 10] as const;
/** Range scale per mode in search, km (BP-29 fig.19). */
const SCALE_KM: Record<RadarMode, number> = { "В": 150, "АВТ": 100, "Д": 50, "БЛ.БОЙ": 10 };
const CLOSE_COMBAT_PATTERN: RasterPattern = { frame: "body", center: { az: 0, el: 12 * DEG }, widthRad: 50 * DEG, bars: 2, barSpacingRad: 3 * DEG, orientation: "vertical", rateRadS: 90 * DEG, turnaroundS: 0.05 };

export const MIG29_AVIONICS_CONTROLS: readonly AvionicsControl[] = [
  { key: "arrowup", label: "Cursor up / farther", control: "KU-31 strobe knob (BP-29 p.9)" },
  { key: "arrowdown", label: "Cursor down / nearer", control: "KU-31 strobe knob" },
  { key: "arrowleft", label: "Cursor left", control: "KU-31 strobe knob" },
  { key: "arrowright", label: "Cursor right", control: "KU-31 strobe knob" },
  { key: "enter", label: "Lock target under the cursor", control: "МРК.ЗАХВ.ПЗ lock button (BP-29 p.16)" },
  { key: "backspace", label: "Break lock", control: "Lock reset" },
  { key: "=", label: "Sight mode: NAV / RDR / IRST / CC / HMS / OPT / BRST", control: "РЕЖ.СУВ selector НВГ/РЛС/ТП/ББ/ШЛЕМ/ОПТ, panel ПСР-31; BRST = boresight" },
  { key: "-", label: "Radar mode: head-on / tail-chase / auto / dogfight", control: "РЕЖИМЫ РЛС В/Д/АВТ/Б.БОЙ, panel ПУР-31" },
  { key: "pageup", label: "Scan elevation up (target above you)", control: "ΔН switch, panel ПУР-31" },
  { key: "pagedown", label: "Scan elevation down (target below you)", control: "ΔН switch" },
  { key: "\\", label: "Scan zone: centre / left / right", control: "ЗОНА buttons, panel ПСР-31" },
  { key: "home", label: "Radar transmit / standby / off", control: "ИЗЛ–ЭКВ–ОТКЛ switch, panel ПУР-31" },
  { key: "end", label: "Track-while-scan: off / head-on / tail", control: "СНП ППС–ЗПС switch, panel ПУР-31" },
  { key: "insert", label: "Radar + IRST work together on/off", control: "ТОРМОЗ–БЕЗ ТОРМОЗА switch, panel С-31" },
  { key: "delete", label: "Laser rangefinder on/off", control: "OEPS laser enable" },
  { key: "[", label: "IRST gain down", control: "УСИЛ.ТП knob, panel ПСР-31" },
  { key: "]", label: "IRST gain up", control: "УСИЛ.ТП knob, panel ПСР-31" },
  { key: "f", label: "Select missile type", control: "Weapon selector" },
  { key: "l", label: "Launch missile", control: "ПУСК (launch) button on the stick" },
  { key: "j", label: "SPO-15: search signals shown / track only", control: "СПО-15 control panel search switch (DCS MiG-29A manual p.107)" },
  { key: "k", label: "Cannon sight (hold = trigger first stage)", control: "Gun trigger, first stage (НО), BP-29 p.25" }
];

export interface Mig29WcsStatus {
  master: Master; radarMode: RadarMode; zone: number; dhKm: number; strobeKm: number; strobeAzDeg: number; strobeElDeg: number;
  emission: Emission; snp: Snp; interaction: boolean; laser: boolean; compensation: boolean;
  /** IRST gain 0..1 (УСИЛ.ТП). */
  irstGain: number;
  /** OPT mode cursor, body angles, deg. */
  optAzDeg: number; optElDeg: number;
  /** Cannon sight (НО) selected. */
  gun: boolean;
}

/** Approximate R-27R max launch range, km, from BP-29 p.21 (ППС 50–60 km, ЗПС 16–18 km at altitude) and fig.17's trend; display only. */
export function r27MaxLaunchKm(aspectFromNoseDeg: number, altitudeM: number): number {
  const t = Math.min(1, Math.max(0, aspectFromNoseDeg / 180));
  const alt = 0.45 + 0.55 * Math.min(1, Math.max(0, altitudeM / 10000));
  return (55 * (1 - t) + 17 * t) * alt;
}

const fmtKm = (km: number) => (km >= 1 ? String(Math.round(km)) : km.toFixed(1));

const MIG_STORE: Record<string, MissileSpec> = { "R-73": SOVIET_AAM.R73A, "R-60M": SOVIET_AAM.R60M, "R-27R": SOVIET_AAM.R27R, "R-27ER": SOVIET_AAM.R27ER, "R-27T": SOVIET_AAM.R27T, "R-27ET": SOVIET_AAM.R27ET };
const migStores = (names: readonly string[]): (MissileSpec | null)[] => names.map((n) => MIG_STORE[n] ?? null);

export class MiG29WeaponControl implements AvionicsSuite {
  /** СПО-15ЛМ radar warning station (passive; its forward channels blank while the radar radiates). */
  public readonly rwr = new Spo15Lm();
  private rwrTime = 0;
  public readonly controls = MIG29_AVIONICS_CONTROLS;
  public readonly ownsHud = true;
  public readonly radar: PulseDopplerRadar;
  public readonly kols: ScanningIrst;
  private s: Mig29WcsStatus = MiG29WeaponControl.initial();
  private held = new Set<string>();
  private ctx: AvionicsContext | null = null;
  private lockPressed = false;
  /** СНП priority target chosen by the pilot (overrides the automatic most-dangerous choice). */
  private priorityId: number | null = null;
  /**
   * Stores: test loadout carrying one of each type (wing stations 1–6). A real squadron fit is
   * symmetric (e.g. 2 × R-27R + 4 × R-60M, BP-29 fig.1); this mix is for trying every missile.
   */
  private loadout: readonly string[] = MIG29_STORES.presets[0]!.stations;
  private stores: (MissileSpec | null)[] = migStores(this.loadout);
  private selected = 0;
  /** Time the current weapon was selected (IR seeker cool-down starts then). */
  private selectedAtS = 0;
  /** Smoothed launch zone of the selected missile on the current target, m. */
  private dlz: { maxM: number; minM: number; t: number; specId: string } | null = null;
  private launchPressed = false;
  private eventsSeen = 0;

  public constructor(seed = 29) {
    this.radar = new PulseDopplerRadar(N019_PROFILE, seed);
    this.kols = new ScanningIrst(KOLS_PROFILE, seed);
  }

  private static initial(): Mig29WcsStatus {
    return { master: "РЛС", radarMode: "В", zone: 0, dhKm: 0, strobeKm: 40, strobeAzDeg: 0, strobeElDeg: 0, emission: "ИЗЛ", snp: "ОТКЛ", interaction: false, laser: true, compensation: true, irstGain: 0.5, optAzDeg: 0, optElDeg: 0, gun: false };
  }

  /** Selected missile type (null when none left). */
  public get weapon(): MissileSpec | null { return this.stores[this.selected] ?? this.stores.find((x) => x) ?? null; }
  public get remaining(): number { const w = this.weapon; return w ? this.stores.filter((x) => x?.id === w.id).length : 0; }

  private cycleWeapon(): void {
    const types = [...new Set(this.stores.filter((x): x is MissileSpec => !!x).map((x) => x.id))];
    if (types.length === 0) return;
    const cur = this.weapon?.id;
    const next = types[(types.indexOf(cur ?? "") + 1) % types.length];
    this.selected = this.stores.findIndex((x) => x?.id === next);
    this.selectedAtS = this.ctx?.own.timeS ?? 0;
    this.dlz = null;
  }

  /** Best available estimate of the attacked target: radar lock, else TWS priority track. */
  private targetEstimate(own: SensorOwnship): { positionEnuM: Vector3; velocityEnuMps: Vector3 } | null {
    const rl = this.radar.lock(own);
    if (rl) return { positionEnuM: rl.positionEnuM, velocityEnuMps: rl.velocityEnuMps };
    const pt = this.snpActive() ? this.priorityTrack(own) : undefined;
    if (pt) return { positionEnuM: pt.positionEnuM, velocityEnuMps: pt.velocityEnuMps };
    const kl = this.kols.lock(own);
    if (kl && Number.isFinite(kl.laserRangeM)) return { positionEnuM: add(own.positionEnuM, scale(kl.losEnu, kl.laserRangeM)), velocityEnuMps: [0, 0, 0] };
    return null;
  }

  /** IR missile seeker on the rail: cued by the IRST/radar lock, the helmet (off-boresight missiles) or the boresight. */
  private irSeekerLos(ctx: AvionicsContext, spec: MissileSpec): Vector3 | null {
    const sk = spec.seeker.value;
    if (sk.kind !== "ir") return null;
    const own = ctx.own;
    // Detector cool-down after selection (catalog `seekerCoolingS`): no lock until it is cold.
    if (own.timeS - this.selectedAtS < (spec.seekerCoolingS?.value ?? 0)) return null;
    const kl = this.kols.lock(own), rl = this.radar.lock(own);
    let cue: Vector3 = kl ? kl.losEnu : rl ? unit(sub(rl.positionEnuM, own.positionEnuM)) : this.bodyDir(own, 0, 0);
    if (!kl && !rl && this.s.master === "ШЛЕМ" && spec.offBoresight) cue = this.bodyDir(own, ctx.head.az, ctx.head.el);
    const b = bodyAngles(own, cue);
    if (Math.hypot(b.az, b.el) > sk.gimbalRad) return null;
    let best: { los: Vector3; snr: number } | null = null;
    for (const pt of ctx.scene.infrared({ originEnuM: own.positionEnuM, fieldFrom: cue, fieldTo: cue, fieldHalfRad: sk.fovRad, maxRangeM: 40000 })) {
      const snr = Math.abs(pt.irradianceWm2) / sk.neiWm2;
      if (!best || snr > best.snr) best = { los: pt.losEnu, snr };
    }
    return best && best.snr >= sk.lockSnr ? best.los : null;
  }

  private bodyDir(own: SensorOwnship, az: number, el: number): Vector3 {
    const q = own.bodyToWorld;
    const v: Vector3 = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), -Math.sin(el)];
    // rotate body → world
    const [x, y, z, w] = q;
    const t: Vector3 = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
    return [v[0] + w * t[0] + (y * t[2] - z * t[1]), v[1] + w * t[1] + (z * t[0] - x * t[2]), v[2] + w * t[2] + (x * t[1] - y * t[0])];
  }

  /** Launch-allowed conditions for the selected missile. */
  private launchState(ctx: AvionicsContext): { ok: boolean; seekerLos: Vector3 | null; rangeM: number } {
    const w = this.weapon;
    const own = ctx.own;
    if (!w) return { ok: false, seekerLos: null, rangeM: Number.NaN };
    const est = this.targetEstimate(own);
    const rangeM = est ? norm(sub(est.positionEnuM, own.positionEnuM)) : Number.NaN;
    const inZone = !!this.dlz && Number.isFinite(rangeM) && rangeM <= this.dlz.maxM && rangeM >= this.dlz.minM;
    if (w.seeker.value.kind === "sarh") return { ok: !!this.radar.lock(own) && !this.radar.lock(own)!.memory && inZone, seekerLos: null, rangeM };
    const los = this.irSeekerLos(ctx, w);
    // IR missiles: seeker lock required; zone checked when a range is known.
    return { ok: !!los && (!Number.isFinite(rangeM) || inZone), seekerLos: los, rangeM };
  }

  private launch(ctx: AvionicsContext): void {
    const w = this.weapon;
    const port = ctx.weapons;
    if (!w || !port) return;
    const ls = this.launchState(ctx);
    if (!ls.ok) return;
    const own = ctx.own;
    const radar = this.radar;
    const liveOwn = () => this.ctx?.own ?? own;
    const g = w.guidance.value;
    const est0 = this.targetEstimate(own);
    const t0 = own.timeS;
    // Radio correction: the command frame for one missile takes (30.72 + 20.48) ms × 7 = 358.4 ms (RLPK slide 56),
    // so the missile's target estimate is refreshed at that rate, not continuously.
    let rc: { t: number; est: { positionEnuM: Vector3; velocityEnuMps: Vector3 } } | null = null;
    const link = (): LauncherLink => {
      const o = liveOwn();
      const rl = radar.lock(o);
      if (w.seeker.value.kind === "sarh" || g.midcourse === "inertial+radio") {
        if (!rl || rl.memory) return { illumination: null, targetEstimate: rc ? { positionEnuM: add(rc.est.positionEnuM, scale(rc.est.velocityEnuMps, o.timeS - rc.t)), velocityEnuMps: rc.est.velocityEnuMps } : null };
        if (!rc || o.timeS - rc.t >= 0.3584) rc = { t: o.timeS, est: { positionEnuM: rl.positionEnuM, velocityEnuMps: rl.velocityEnuMps } };
        const est = { positionEnuM: add(rc.est.positionEnuM, scale(rc.est.velocityEnuMps, o.timeS - rc.t)), velocityEnuMps: rc.est.velocityEnuMps };
        // Illumination (RLPK slide 7: КНП average 0.9 kW) through the N019 antenna (transmit directivity 2000),
        // on the lock line of sight, alternating with tracking: 30.72 ms illumination / 20.48 ms track (slides 7, 56).
        return {
          illumination: { positionEnuM: o.positionEnuM, velocityEnuMps: o.velocityEnuMps, erpW: 900 * radar.hw.antenna.transmitGain, duty: 30.72 / (30.72 + 20.48), boresight: unit(sub(rl.positionEnuM, o.positionEnuM)), pattern: radar.hw.antenna, wavelengthM: radar.hw.wavelengthM },
          targetEstimate: est
        };
      }
      // IR missiles: inertial only, from the estimate at launch, extrapolated.
      const dtl = o.timeS - t0;
      return { illumination: null, targetEstimate: est0 ? { positionEnuM: add(est0.positionEnuM, scale(est0.velocityEnuMps, dtl)), velocityEnuMps: est0.velocityEnuMps } : null };
    };
    const station = this.stores.findIndex((x) => x?.id === w.id);
    const below = this.bodyDir(own, 0, -Math.PI / 2);
    port.launch(w, add(own.positionEnuM, scale(below, 1.5)), own.velocityEnuMps, link, ls.seekerLos);
    this.stores[station] = null;
    if (!this.weapon || this.remaining === 0) this.cycleWeapon();
  }

  private updateDlz(ctx: AvionicsContext): void {
    const w = this.weapon;
    const own = ctx.own;
    const est = this.targetEstimate(own);
    if (!w || !est) { this.dlz = null; return; }
    if (this.dlz && this.dlz.specId === w.id && own.timeS - this.dlz.t < 1) return;
    const los = unit(sub(est.positionEnuM, own.positionEnuM));
    const z = launchZone(w, { positionEnuM: own.positionEnuM, velocityEnuMps: own.velocityEnuMps }, { losEnu: los, velocityEnuMps: est.velocityEnuMps });
    if (!Number.isFinite(z.maxM)) return;
    // Exponential smoothing (≈2 s) so the marks move steadily instead of jumping with each track update.
    const k = this.dlz && this.dlz.specId === w.id ? 0.4 : 1;
    this.dlz = { maxM: this.dlz && k < 1 ? this.dlz.maxM + k * (z.maxM - this.dlz.maxM) : z.maxM, minM: this.dlz && k < 1 ? this.dlz.minM + k * (z.minM - this.dlz.minM) : z.minM, t: own.timeS, specId: w.id };
  }

  public reset(): void {
    this.rwr.reset(); this.s = MiG29WeaponControl.initial(); this.radar.breakLock("reset"); this.kols.breakLock("reset"); this.stores = migStores(this.loadout); this.selected = Math.max(0, this.stores.findIndex((x) => x)); }

  public get state(): Readonly<Mig29WcsStatus> { return this.s; }

  /** Pilot-equivalent setting for tests and scripted use (same effect as turning the knob). */
  public set<K extends keyof Mig29WcsStatus>(k: K, v: Mig29WcsStatus[K]): void { this.s[k] = v; }

  public key(k: string, down: boolean): boolean {
    if (!this.controls.some((c) => c.key === k)) return false;
    if (!down) { this.held.delete(k); if (k === "k") this.s.gun = false; return true; }
    if (this.held.has(k)) return true;
    this.held.add(k);
    const s = this.s;
    const cycle = <T>(list: readonly T[], v: T) => list[(list.indexOf(v) + 1) % list.length] as T;
    switch (k) {
      case "=": s.master = cycle(MASTERS, s.master); this.radar.breakLock("mode change"); this.kols.breakLock("mode change"); break;
      case "-": s.radarMode = cycle(RADAR_MODES, s.radarMode); this.radar.breakLock("mode change"); s.strobeKm = Math.min(s.strobeKm, SCALE_KM[s.radarMode]); break;
      case "enter": this.lockPressed = true; break;
      case "backspace": this.radar.breakLock("pilot"); this.kols.breakLock("pilot"); break;
      case "pagedown": s.dhKm = DH_KM[Math.max(0, DH_KM.indexOf(s.dhKm as (typeof DH_KM)[number]) - 1)] as number; break;
      case "pageup": s.dhKm = DH_KM[Math.min(DH_KM.length - 1, DH_KM.indexOf(s.dhKm as (typeof DH_KM)[number]) + 1)] as number; break;
      case "\\": s.zone = s.zone === 0 ? -1 : s.zone === -1 ? 1 : 0; break;
      case "home": s.emission = cycle<Emission>(["ИЗЛ", "ЭКВ", "ОТКЛ"], s.emission); break;
      case "end": s.snp = cycle<Snp>(["ОТКЛ", "ППС", "ЗПС"], s.snp); break;
      case "insert": s.interaction = !s.interaction; break;
      case "delete": s.laser = !s.laser; break;
      case "[": s.irstGain = Math.max(0, Math.round((s.irstGain - 0.1) * 10) / 10); break;
      case "]": s.irstGain = Math.min(1, Math.round((s.irstGain + 0.1) * 10) / 10); break;
      case "k": s.gun = true; break;
      case "f": this.cycleWeapon(); break;
      case "j": this.rwr.setSearchAllowed(!this.rwr.searchAllowed); break;
      case "l": this.launchPressed = true; break;
    }
    return true;
  }

  /** Radar search pattern: autonomous zones №4/№5 (RLPK slide 39) or the close-combat vertical scan. */
  private searchPattern(): RasterPattern {
    const s = this.s;
    // BP-29 figs 12–13: two vertical lines, 6° wide, −13° … +37°, fixed to the aircraft axis; RLPK slide 8:
    // review period 1.2 s → ≈ 90°/s over 2 × 50° (DERIVED).
    if (s.radarMode === "БЛ.БОЙ") return CLOSE_COMBAT_PATTERN;
    // Mode Д (N019-WEB): 40° × 16.5° below 20 km strobe range, 30° × 13.5° beyond.
    // Modes В/АВТ: zone №4 50° × 10.5° below 30 km, №5 50° × 7.8° beyond (RLPK slide 39); 57°/s.
    const pursuit = s.radarMode === "Д";
    const width = pursuit ? (s.strobeKm < 20 ? 40 : 30) * DEG : 50 * DEG;
    const elSpan = (pursuit ? (s.strobeKm < 20 ? 16.5 : 13.5) : s.strobeKm < 30 ? 10.5 : 7.8) * DEG;
    const bars = Math.max(2, Math.round((elSpan - 3.5 * DEG) / (3.4 * DEG)) + 1);
    // Elevation centre: α ≈ ΔH/Д (BP-29 p.9); in СНП the zone follows the priority target in elevation (N019-WEB).
    let el = Math.atan2(s.dhKm, Math.max(1, s.strobeKm));
    const own = this.ctx?.own;
    const pt = own && this.snpActive() ? this.priorityTrack(own) : undefined;
    if (pt) el = pt.look.el;
    el = Math.max(-36 * DEG + elSpan / 2, Math.min(56 * DEG - elSpan / 2, el));
    return { frame: "stabilized", center: { az: s.zone * 40 * DEG, el }, widthRad: width, bars, barSpacingRad: (elSpan - 3.5 * DEG) / (bars - 1), orientation: "horizontal" };
  }

  /**
   * Waveforms for the radar mode: В = ВЧП, Д = СЧП, АВТ alternates ВЧП/СЧП line by line except below
   * 10 km strobe range where only СЧП is used (N019-WEB); СНП ППС/ЗПС forces ВЧП/СЧП.
   */
  private waveforms(): string[] {
    const s = this.s;
    if (s.radarMode === "БЛ.БОЙ") return ["BMB"];
    if (s.radarMode === "АВТ") return s.strobeKm < 10 ? ["MPRF"] : ["HPRF", "MPRF"];
    if (s.snp === "ППС") return ["HPRF"];
    if (s.snp === "ЗПС") return ["MPRF"];
    return s.radarMode === "В" ? ["HPRF"] : ["MPRF"];
  }

  /** Waveforms the lock may use: В locks stay ВЧП (a target that stops closing is lost), Д stays СЧП, АВТ chooses. */
  private trackWaveforms(): string[] | null {
    const s = this.s;
    if (s.master === "ББ" || s.radarMode === "БЛ.БОЙ") return ["BMB"];
    if (s.radarMode === "АВТ") return null;
    return s.radarMode === "В" ? ["HPRF"] : ["MPRF"];
  }

  /** Track-while-scan: СНП switch in В/Д; built into АВТ (N019-WEB). */
  private snpActive(): boolean {
    const s = this.s;
    return s.master === "РЛС" && (s.radarMode === "АВТ" || (s.snp !== "ОТКЛ" && (s.radarMode === "В" || s.radarMode === "Д")));
  }

  private priorityTrack(own: SensorOwnship): RadarTrackReport | undefined {
    const tracks = this.radar.tracks(own);
    return tracks.find((t) => t.id === this.priorityId) ?? this.mostDangerous(own);
  }

  /** RLPK slide 65: the OEPS leads in ТП, ШЛЕМ, ОПТ and in close combat when the laser is on. */
  private oepsLeads(): boolean {
    const m = this.s.master;
    return m === "ТП" || m === "ШЛЕМ" || m === "ОПТ" || m === "БРСТ" || (m === "ББ" && this.s.laser);
  }

  public step(ctx: AvionicsContext, dt: number): void {
    this.rwrTime = ctx.own.timeS;
    // Power: any live bus (the exact RWR bus assignment is not sourced).
    this.rwr.setPower(!ctx.snapshot.electrical || ctx.snapshot.electrical.buses.some((b) => b.powered));
    const radiating = this.s.emission === "ИЗЛ" && !["off", "warmup", "standby"].includes(this.radar.state);
    this.rwr.step({ timeS: ctx.own.timeS, positionEnuM: ctx.own.positionEnuM, bodyToWorld: ctx.own.bodyToWorld }, ctx.scene, dt, radiating);
    this.ctx = ctx;
    const s = this.s;
    const scale = SCALE_KM[s.radarMode];
    const tp = s.master === "ТП";
    if (s.master === "ОПТ") {
      // OPT: a movable sight cursor that the IRST head follows (within its ±30° / −15…+30° field).
      if (this.held.has("arrowup")) s.optElDeg = Math.min(30, s.optElDeg + 10 * dt);
      if (this.held.has("arrowdown")) s.optElDeg = Math.max(-15, s.optElDeg - 10 * dt);
      if (this.held.has("arrowright")) s.optAzDeg = Math.min(30, s.optAzDeg + 10 * dt);
      if (this.held.has("arrowleft")) s.optAzDeg = Math.max(-30, s.optAzDeg - 10 * dt);
    } else if (this.held.has("arrowup")) { if (tp) s.strobeElDeg = Math.min(15, s.strobeElDeg + 15 * dt); else s.strobeKm = Math.min(scale, s.strobeKm + scale * 0.3 * dt); }
    if (this.held.has("arrowdown")) { if (tp) s.strobeElDeg = Math.max(-15, s.strobeElDeg - 15 * dt); else s.strobeKm = Math.max(0.5, s.strobeKm - scale * 0.3 * dt); }
    const azLim = tp ? 30 : 25;
    if (this.held.has("arrowright")) s.strobeAzDeg = Math.min(azLim, s.strobeAzDeg + 20 * dt);
    if (this.held.has("arrowleft")) s.strobeAzDeg = Math.max(-azLim, s.strobeAzDeg - 20 * dt);

    // Power: radar and OEPS on the 115 V AC bus, shed under PTO supply (assignment ESTIMATED).
    const ac = ctx.snapshot.electrical?.buses.find((b) => b.id === "ac");
    const acOk = !ctx.snapshot.electrical || (!!ac && ac.powered && !ac.shed);
    this.radar.setPower(acOk && s.emission !== "ОТКЛ");
    this.kols.setPower(acOk && s.master !== "НВГ");

    // The radar emits in РЛС, in ББ without the laser, and as the slaved channel with ТОРМОЗ (interaction).
    const radarWanted = s.master === "РЛС" || s.master === "БРСТ" || (s.master === "ББ" && !s.laser) || (s.interaction && s.master !== "НВГ");
    this.radar.setRadiate(s.emission === "ИЗЛ" && radarWanted);
    this.radar.setSearch({
      pattern: s.master === "ББ" ? CLOSE_COMBAT_PATTERN : this.searchPattern(),
      waveformIds: s.master === "ББ" ? ["BMB"] : this.waveforms(),
      tws: this.snpActive(),
      plotPersistenceS: 4,
      rangeScaleM: (s.master === "ББ" ? 10 : scale) * 1000
    });
    this.radar.setCompensation(s.compensation);
    this.radar.setTrackWaveforms(this.trackWaveforms());

    // OEPS by mode (BP-29 figs 14–16, 23).
    if (s.master === "ТП") this.kols.setScan({ frame: "body", center: { az: 0, el: 0 }, widthRad: 60 * DEG, bars: 8, barSpacingRad: 3.75 * DEG, orientation: "horizontal" });
    else if (s.master === "ББ") this.kols.setScan({ frame: "body", center: { az: 0, el: 1 * DEG }, widthRad: 30 * DEG, bars: 1, barSpacingRad: 4 * DEG, orientation: "vertical" }, true);
    else this.kols.setScan(null);
    if (s.master === "ШЛЕМ") this.kols.setSlave({ az: Math.max(-30 * DEG, Math.min(30 * DEG, ctx.head.az)), el: Math.max(-15 * DEG, Math.min(30 * DEG, ctx.head.el)) });
    else if (s.master === "ОПТ") this.kols.setSlave({ az: s.optAzDeg * DEG, el: s.optElDeg * DEG });
    else if (s.master === "БРСТ") this.kols.setSlave({ az: 0, el: 0 });
    else this.kols.setSlave(null);
    this.kols.setLaser(s.laser);
    this.kols.setGain(s.irstGain);

    if (this.lockPressed) { this.lockPressed = false; this.designate(ctx); }
    this.updateDlz(ctx);
    if (this.launchPressed) { this.launchPressed = false; this.launch(ctx); }
    const evs = ctx.weapons?.events() ?? [];

    this.eventsSeen = evs.length;
    // HMS: the lock is made where the pilot is looking now — an acquisition in progress follows the head.
    if (s.master === "ШЛЕМ") this.kols.steerAcquisition({ az: ctx.head.az, el: ctx.head.el });

    // СНП: the most dangerous track (min Д/Ḋ) is framed; auto-lock at the max launch range (BP-29 p.14).
    // At the max launch range the radar stops scanning and searches a 40° × 8° box on the target for up to 3 cycles (N019-WEB).
    if (this.snpActive() && this.radar.state === "search") {
      const md = this.priorityTrack(ctx.own);
      const rmaxKm = this.dlz ? this.dlz.maxM / 1000 : md ? r27MaxLaunchKm(this.aspectDeg(md, ctx.own.positionEnuM), ctx.own.positionEnuM[2]) : 0;
      if (md && md.rangeM / 1000 < rmaxKm) {
        this.radar.designate({ look: md.look, frame: "stabilized", rangeM: md.rangeM, rangeWindowM: 10000, box: { widthRad: 40 * DEG, bars: 3, spacingRad: 2.25 * DEG, periods: 3 } });
      }
    }
    // OEPS leading + interaction: the radar gets the direction only ("quasi-search") and captures inside
    // 40 km head-on / 15 km tail-on (RLPK slide 65).
    const kl = this.kols.lock(ctx.own);
    if (s.interaction && kl && this.oepsLeads() && this.radar.state === "search") {
      this.radar.designate({ look: kl.lookBody, frame: "body", rangeM: 20000, rangeWindowM: 20000, minRangeM: 300, maxRangeM: 40000, stare: true });
    }
    // Radar leading + interaction: the OEPS is cued in direction and captures.
    const rl = this.radar.lock(ctx.own);
    if (s.interaction && rl && !this.oepsLeads() && !kl && this.kols.state !== "acquire") this.kols.designate(rl.lookBody, "body", 2 * DEG, 2 * DEG);

    this.radar.step(ctx.own, ctx.scene, dt);
    this.kols.step(ctx.own, ctx.scene, dt);
  }

  private designate(ctx: AvionicsContext): void {
    const s = this.s;
    if (this.snpActive()) {
      // СНП: the button over a track makes it the priority target; over the current priority it locks now.
      const t = this.radar.tracks(ctx.own).filter((x) => Math.abs(x.look.az / DEG - s.strobeAzDeg) < 5 && Math.abs(x.rangeM / 1000 - s.strobeKm) < SCALE_KM[s.radarMode] * 0.08)[0];
      if (t && t.id !== this.priorityId) { this.priorityId = t.id; return; }
      if (t) { this.radar.designate({ look: t.look, frame: "stabilized", rangeM: t.rangeM, rangeWindowM: 10000 }); return; }
    }
    if ((s.master === "РЛС" && s.radarMode === "БЛ.БОЙ") || (s.master === "ББ" && !this.oepsLeads())) {
      // Semi-automatic close combat: the closest return in the zone, 450 m – 10 km, is locked (N019-WEB, BP-29 p.16).
      const p = this.radar.recentPlots.filter((x) => !x.falseAlarm && x.rangeM >= 450 && x.rangeM <= 10000 && ctx.own.timeS - x.timeS < 1.5).sort((a, b) => a.rangeM - b.rangeM)[0];
      if (p) this.radar.designate({ look: bodyAngles(ctx.own, p.losEnu), frame: "body", rangeM: p.rangeM, rangeWindowM: 800, stare: true, trackMinRangeM: 250 });
      return;
    }
    if (s.master === "РЛС") {
      // Strobe over a mark (KU-31) + МРК.ЗАХВ: the radar re-finds the target in the strobed direction.
      const pat = this.searchPattern();
      const plot = this.radar.recentPlots.filter((p) => !p.falseAlarm && Math.abs(p.look.az / DEG - s.strobeAzDeg) < 4 && Math.abs(p.rangeM / 1000 - s.strobeKm) < SCALE_KM[s.radarMode] * 0.06)
        .sort((a, b) => b.timeS - a.timeS)[0];
      const look: LookAngles = plot ? plot.look : { az: s.strobeAzDeg * DEG, el: pat.center.el };
      this.radar.designate({ look, frame: "stabilized", rangeM: plot ? plot.rangeM : s.strobeKm * 1000, rangeWindowM: this.waveforms().includes("HPRF") ? 10000 : 2000 });
    } else if (s.master === "ТП") {
      this.kols.designate({ az: s.strobeAzDeg * DEG, el: s.strobeElDeg * DEG }, "body", 4 * DEG, 6 * DEG);
    } else if (s.master === "ШЛЕМ") {
      this.kols.designate({ az: ctx.head.az, el: ctx.head.el }, "body", 4 * DEG, 4 * DEG);
    } else if (s.master === "ОПТ") {
      this.kols.designate({ az: s.optAzDeg * DEG, el: s.optElDeg * DEG }, "body", 2 * DEG, 2 * DEG);
    } else if (s.master === "БРСТ") {
      // Boresight: IRST at the boresight; with the radar emitting it also stares along the axis.
      this.kols.designate({ az: 0, el: 0 }, "body", 2.5 * DEG, 2.5 * DEG);
      if (s.emission === "ИЗЛ") this.radar.designate({ look: { az: 0, el: 0 }, frame: "body", rangeM: 5000, rangeWindowM: 5000, minRangeM: 250, maxRangeM: 10000, stare: true, trackMinRangeM: 250 });
    }
  }

  private mostDangerous(own: SensorOwnship): RadarTrackReport | undefined {
    return this.radar.tracks(own).filter((t) => t.closureMps > 1).sort((a, b) => a.rangeM / a.closureMps - b.rangeM / b.closureMps)[0];
  }

  /** Target aspect from its nose, deg (0 = head-on), from the estimated velocity. */
  private aspectDeg(t: RadarTrackReport, ownPos: Vector3): number {
    const v = t.velocityEnuMps;
    if (norm(v) < 10) return 0;
    const toUs = unit(sub(ownPos, t.positionEnuM));
    const c = (v[0] * toUs[0] + v[1] * toUs[1] + v[2] * toUs[2]) / norm(v);
    return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  }

  // ======================= ИЛС / ИПВ symbology (English legends) =======================

  /** The ИЛС picture. `hud` adds the flight symbology and conformal elements; otherwise the head-down repeat. */
  private picture(hud: boolean): DisplayPrimitive[] {
    const out: DisplayPrimitive[] = [];
    const ctx = this.ctx;
    if (!ctx) return out;
    const s = this.s, own = ctx.own;
    const L = (pts: [number, number][], o: { closed?: boolean; dash?: boolean; width?: number } = {}) => { out.push({ kind: "line", frame: "screen", points: pts, ...o }); };
    const T = (x: number, y: number, text: string, align: "left" | "center" | "right" = "left", size = 0.075) => { out.push({ kind: "text", frame: "screen", at: [x, y], text, align, size }); };
    const O = (x: number, y: number, r: number, dash = false, fill = false) => { out.push({ kind: "circle", frame: "screen", at: [x, y], radius: r, dash, fill }); };
    const A = (az: number, el: number, r: number, dash = false) => { out.push({ kind: "circle", frame: "angle", at: [az, el], radius: r, dash }); };
    const AL = (pts: [number, number][]) => { out.push({ kind: "line", frame: "angle", points: pts }); };
    const rl = this.radar.lock(own);
    const kl = this.kols.lock(own);

    // ---------- flight data (all modes): IAS km/h with trend index, heading tape, altitude m ----------
    if (hud) {
      const snap = ctx.snapshot as Partial<typeof ctx.snapshot>;
      const ias = (snap.equivalentAirspeedMps ?? norm(own.velocityEnuMps)) * 3.6;
      const alt = snap.altitudeMslM ?? own.positionEnuM[2];
      T(-0.62, 0.86, `${Math.round(ias / 10) * 10}`, "center", 0.1);
      L([[-0.74, 0.8], [-0.5, 0.8]]);
      L([[-0.66, 0.74], [-0.62, 0.79], [-0.58, 0.74]], { closed: true });
      T(0.62, 0.86, `${Math.round(alt / 10) * 10}`, "center", 0.1);
      // Attacked target's speed and altitude, smaller, above our own (BP-29 fig.43).
      const est = this.targetEstimate(own);
      if (est) {
        T(-0.62, 0.97, `${Math.round((norm(est.velocityEnuMps) * 3.6) / 10) * 10}`, "center", 0.065);
        T(0.62, 0.97, `${Math.round(est.positionEnuM[2] / 100) * 100}`, "center", 0.065);
      }
      const hdg = ((own.headingRad / DEG) % 360 + 360) % 360;
      const px = 0.02;
      L([[-0.26, 0.8], [0.26, 0.8]]);
      for (let ten = Math.floor(hdg / 10) - 1; ten <= Math.floor(hdg / 10) + 2; ten++) {
        const x = (ten * 10 - hdg) * px;
        if (Math.abs(x) <= 0.26) { L([[x, 0.8], [x, 0.84]]); T(x, 0.89, String(((ten % 36) + 36) % 36).padStart(2, "0"), "center", 0.06); }
        if (Math.abs(x + 0.1) <= 0.26) L([[x + 0.1, 0.8], [x + 0.1, 0.82]]);
      }
      L([[-0.025, 0.74], [0, 0.79], [0.025, 0.74]], { closed: true });
      this.horizon(out, own);
    }

    const rangeScale = (scaleKm: number, label: string) => {
      L([[-0.78, -0.55], [-0.78, 0.7]]);
      for (let i = 0; i <= 5; i++) { const y = -0.55 + (1.25 * i) / 5; L([[-0.78, y], [-0.74, y]]); if (i > 0) T(-0.81, y, fmtKm((scaleKm * i) / 5), "right", 0.055); }
      T(-1.0, 0.3, label, "left", 0.08);
      return (km: number) => -0.55 + 1.25 * Math.min(1, Math.max(0, km / scaleKm));
    };
    const rangeArrow = (y: number) => L([[-0.74, y], [-0.66, y + 0.035], [-0.66, y - 0.035]], { closed: true });
    const wings = () => { L([[-0.22, 0], [-0.06, 0]]); L([[0.06, 0], [0.22, 0]]); L([[-0.22, 0], [-0.22, -0.03]]); L([[0.22, 0], [0.22, -0.03]]); };
    const lead = this.oepsLeads() ? "ТП" : "РЛ";

    // ---------- cannon sight (first trigger stage held; BP-29 figs 24–25, 55) ----------
    if (s.gun) {
      const useRadar = !!rl && (lead === "РЛ" || !kl);
      const rangeM = kl && Number.isFinite(kl.laserRangeM) ? kl.laserRangeM : rl ? rl.rangeM : Number.NaN;
      const ry = (km: number) => -0.55 + 1.25 * Math.min(1, Math.max(0, km / 1.0));
      L([[-0.78, -0.55], [-0.78, 0.7]]);
      for (let i = 1; i <= 5; i++) { const y = ry(i * 0.2); L([[-0.78, y], [-0.74, y]]); T(-0.81, y, (i * 0.2).toFixed(1), "right", 0.055); }
      T(-1.0, 0.3, useRadar ? "РЛ" : "ТП", "left", 0.08);
      if (rl || kl) T(-1.0, 0.05, "А", "left", 0.08);
      // Permitted firing range 200–800 m marks (fig.55 items 1–2).
      for (const km of [0.2, 0.8]) L([[-0.78, ry(km)], [-0.86, ry(km)]], { width: 2.5 });
      if (Number.isFinite(rangeM)) rangeArrow(ry(rangeM / 1000));
      // Lead: the gun line is ahead of the target by LOS rate × time of flight, plus gravity drop (v0 ≈ 875 m/s, BP-29 p.25).
      const tgt = useRadar ? rl!.lookBody : kl?.lookBody;
      if (hud) {
        if (tgt && Number.isFinite(rangeM)) {
          const tof = rangeM / 875;
          const rate = kl ? kl.losRateRadS : 0;
          const drop = (0.5 * 9.81 * tof * tof) / Math.max(200, rangeM);
          A(tgt.az, tgt.el + drop + rate * tof * 0.2, 0.08);
          AL([[tgt.az - 0.6 * DEG, tgt.el], [tgt.az + 0.6 * DEG, tgt.el]]);
        } else A(0, -0.5 * DEG, 0.08);
      }
      L([[0.4, -0.62], [0.5, -0.62], [0.5, -0.52], [0.4, -0.52]], { closed: true });
      T(0.45, -0.57, "4", "center", 0.07);
      return this.footer(out, own, hud);
    }

    const locked = (lead === "РЛ" && rl) || (lead === "ТП" && (kl || rl));
    if (locked) {
      // ---------- target locked (BP-29 fig.20 radar, fig.22 IRST) ----------
      const useRadar = lead === "РЛ" ? true : !kl;
      const look = useRadar ? rl!.lookBody : kl!.lookBody;
      const rangeM = useRadar ? rl!.rangeM : Number.isFinite(kl!.laserRangeM) ? kl!.laserRangeM : rl ? rl.rangeM : Number.NaN;
      const scaleKm = useRadar ? (rangeM > 25000 ? 50 : rangeM > 10000 ? 25 : 10) : 10;
      const ry = rangeScale(scaleKm, useRadar ? "РЛ" : "ТП");
      T(-1.0, 0.05, "А", "left", 0.08);
      const ringScale = useRadar ? 45 * DEG : 30 * DEG;
      const rx = Math.max(-0.95, Math.min(0.95, (look.az / ringScale) * 0.9)), ry2 = Math.max(-0.95, Math.min(0.95, (look.el / ringScale) * 0.9));
      O(rx, ry2, 0.08, useRadar ? rl!.memory : kl!.memory);
      if (useRadar) {
        const dx = (look.az / (70 * DEG)) * 0.9, dy = (look.el / (70 * DEG)) * 0.9;
        L([[dx, dy + 0.035], [dx + 0.025, dy], [dx, dy - 0.035], [dx - 0.025, dy]], { closed: true });
      }
      if (hud) A(look.az, look.el, 0.035, true);
      if (Number.isFinite(rangeM)) { rangeArrow(ry(rangeM / 1000)); T(0.95, 0.66, `Д ${(rangeM / 1000).toFixed(rangeM < 10000 ? 2 : 1)}`, "right", 0.065); }
      if (useRadar) {
        const asp = this.aspectDeg(rl!, own.positionEnuM);
        T(0.95, 0.56, `Ṽ ${Math.round((rl!.closureMps * 3.6) / 10) * 10}`, "right", 0.06);
        T(-1.0, -0.2, asp < 90 ? "ППС" : "ЗПС", "left", 0.06);
      } else if (!Number.isFinite(rangeM)) T(0.95, 0.66, "Д --", "right", 0.065);
      // Launch zone of the selected missile (flyout-computed, smoothed).
      if (this.dlz) for (const m of [this.dlz.maxM, this.dlz.minM]) L([[-0.78, ry(m / 1000)], [-0.86, ry(m / 1000)]], { width: 2.5 });
      if (this.ctx && this.launchState(this.ctx).ok) T(0, -0.62, "ПР", "center", 0.1);
    } else if (s.master === "РЛС" && s.radarMode !== "БЛ.БОЙ") {
      // ---------- radar search: range scale, targets as dot dashes (dots = target size), cursor box, scan-sector bar ----------
      const ry = rangeScale(SCALE_KM[s.radarMode], "РЛ");
      const ax = (deg: number) => (deg / 25) * 0.62;
      for (const p of this.radar.recentPlots) {
        const x = ax(p.look.az / DEG), y = ry(p.rangeM / 1000);
        if (Math.abs(x) > 0.66) continue;
        // Size class from the radar's own RCS estimate: 1 dot ≈ ≤1 m², 2 ≈ 3, 3 ≈ 10, 4 ≈ 30, 5 ≈ ≥100 m².
        const rcs = p.rcsEstimateM2 ?? 3;
        // Size class: 1 dot small (< 2 m²), 2 medium (2–10 m², fighter), 3 large (> 10 m²). Class limits ESTIMATED.
        const dots = rcs < 2 ? 1 : rcs <= 10 ? 2 : 3;
        for (let i = 0; i < dots; i++) O(x + (i - (dots - 1) / 2) * 0.022, y, 0.006, false, true);
      }
      const md = this.snpActive() ? this.priorityTrack(own) : undefined;
      for (const t of this.radar.tracks(own)) {
        const x = ax(t.look.az / DEG), y = ry(t.rangeM / 1000);
        if (Math.abs(x) > 0.66) continue;
        O(x, y, 0.025);
        if (md && t.id === md.id) L([[x - 0.07, y - 0.055], [x + 0.07, y - 0.055], [x + 0.07, y + 0.055], [x - 0.07, y + 0.055]], { closed: true });
      }
      const sx = ax(s.strobeAzDeg), sy = ry(s.strobeKm);
      L([[sx - 0.06, sy - 0.045], [sx + 0.06, sy - 0.045], [sx + 0.06, sy + 0.045], [sx - 0.06, sy + 0.045]], { closed: true, width: 1.5 });
      wings();
      // Bottom bar: the selected scan sector across the ±65° coverage (the display does not show the beam itself).
      const pat = this.searchPattern();
      const bx = (deg: number) => (deg / 65) * 0.75;
      L([[bx(pat.center.az / DEG - pat.widthRad / DEG / 2), -0.75], [bx(pat.center.az / DEG + pat.widthRad / DEG / 2), -0.75]], { width: 2.5 });
      if (!hud) T(0.95, 0.66, `ΔН ${s.dhKm > 0 ? "+" : ""}${s.dhKm}`, "right", 0.06);
      if (this.radar.acquisitionPhase) T(0, -0.62, "ЗАХВ", "center", 0.07);
    } else if (s.master === "РЛС" || (s.master === "ББ" && !this.oepsLeads())) {
      // ---------- radar close combat (BP-29 figs 12–13): two vertical lines bounding the zone ----------
      if (hud) for (const x of [-3, 3]) AL([[x * DEG, -13 * DEG], [x * DEG, 37 * DEG]]);
      else for (const x of [-0.06, 0.06]) L([[x, -0.4], [x, 0.9]]);
      T(-1.0, 0.3, "РЛ", "left", 0.08);
      T(0.95, -0.82, "Б.Б", "right", 0.07);
    } else if (s.master === "ТП") {
      // ---------- IRST search: ±30° az, ±15° el field (L frame), marks, noise dots with gain, cursor box ----------
      const ax = (deg: number) => (deg / 30) * 0.75, ay = (deg: number) => 0.1 + (deg / 15) * 0.6;
      L([[-0.78, 0.7], [-0.78, -0.55], [0.8, -0.55]]);
      T(-1.0, 0.3, "ТП", "left", 0.08);
      for (const p of this.kols.recentPlots) O(ax(p.look.az / DEG), ay(p.look.el / DEG), p.noise ? 0.005 : 0.016, false, true);
      const x = ax(s.strobeAzDeg), y = ay(s.strobeElDeg);
      L([[x - ax(2), y - (ay(3) - ay(0))], [x + ax(2), y - (ay(3) - ay(0))], [x + ax(2), y + (ay(3) - ay(0))], [x - ax(2), y + (ay(3) - ay(0))]], { closed: true });
      wings();
      T(0.95, 0.66, `УСИЛ ${Math.round(s.irstGain * 10)}`, "right", 0.06);
      if (this.kols.state === "acquire") T(0, -0.62, "ЗАХВ", "center", 0.07);
    } else if (s.master === "ББ") {
      // ---------- IRST close combat (BP-29 fig.15): 4°-wide vertical strip, −12° … +12° ----------
      if (hud) for (const x of [-2, 2]) AL([[x * DEG, -12 * DEG], [x * DEG, 12 * DEG]]);
      else for (const x of [-0.05, 0.05]) L([[x, -0.6], [x, 0.6]]);
      T(-1.0, 0.3, "ТП", "left", 0.08);
      T(0.95, -0.82, "Б.Б", "right", 0.07);
    } else if (s.master === "ШЛЕМ") {
      // ---------- helmet: sighting is on the helmet (see helmet()); the ИЛС shows only the mode ----------
      T(0.95, -0.82, "ШЛЕМ", "right", 0.07);
    } else if (s.master === "ОПТ") {
      // ---------- OPT: movable sight cursor, IRST follows it; laser range on a 10 km scale ----------
      rangeScale(10, "ТП");
      const c = { az: s.optAzDeg * DEG, el: s.optElDeg * DEG };
      if (hud) { A(c.az, c.el, 0.06); AL([[c.az - 1.5 * DEG, c.el], [c.az - 0.6 * DEG, c.el]]); AL([[c.az + 0.6 * DEG, c.el], [c.az + 1.5 * DEG, c.el]]); AL([[c.az, c.el + 0.6 * DEG], [c.az, c.el + 1.5 * DEG]]); }
      else O((c.az / (30 * DEG)) * 0.75, (c.el / (30 * DEG)) * 0.75, 0.06);
      T(0.95, -0.82, "ОПТ", "right", 0.07);
    } else if (s.master === "БРСТ") {
      // ---------- boresight: fixed 2.5° circle on the axis; sensors stare along it ----------
      if (hud) A(0, 0, 0.1); else O(0, 0, 0.1);
      T(0.95, -0.82, "ВИЗ", "right", 0.07);
    } else {
      // ---------- navigation (photo 1): bank scale and roll line ----------
      if (hud) {
        const cy = -0.05, r = 0.4;
        for (const b of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
          const a = (b * Math.PI) / 180;
          L([[Math.sin(a) * r, cy - Math.cos(a) * r], [Math.sin(a) * (r + 0.05), cy - Math.cos(a) * (r + 0.05)]]);
        }
        const roll = own.rollRad;
        L([[-Math.sin(roll) * 0.08, cy + Math.cos(roll) * 0.08], [Math.sin(roll) * r, cy - Math.cos(roll) * r]], { width: 1.5 });
        L([[-0.04, cy], [0.04, cy]]); L([[0, cy - 0.04], [0, cy + 0.04]]);
      }
      T(0.95, -0.82, "НВГ", "right", 0.07);
    }
    return this.footer(out, own, hud);
  }

  /** Switch-state line (simulation aid) and lock-break cue. */
  private footer(out: DisplayPrimitive[], own: SensorOwnship, hud: boolean): DisplayPrimitive[] {
    const s = this.s;
    const T = (x: number, y: number, text: string, align: "left" | "center" | "right" = "left", size = 0.05) => { out.push({ kind: "text", frame: "screen", at: [x, y], text, align, size }); };
    // Selected missile type (BP-29 figs 20, 22, 43 show the type only, e.g. «27Р», «60М»).
    const w = this.weapon;
    T(-0.95, -0.82, w ? (MISSILE_RU[w.id] ?? w.display) : "НЕТ", "left", 0.065);
    // IR seeker lock is not drawn on the ИЛС: BP-29 fig.16 gives it as the helmet symbol with the audio tone.
    const em = s.emission;
    const tags = [s.emission !== "ИЗЛ" ? em : "", s.interaction ? "ТОРМ" : "", s.snp !== "ОТКЛ" ? `СНП ${s.snp}` : "", s.compensation ? "" : "БЕЗ КОМП"].filter(Boolean);
    if (!hud) T(0.95, -0.95, tags.join(" "), "right");
    if (!hud) T(-0.95, -0.95, `РЛС ${STATE_RU[this.radar.state] ?? this.radar.state} ${s.radarMode}  КОЛС ${STATE_RU[this.kols.state] ?? this.kols.state}`, "left");
    const loss = this.radar.lossEvent ?? this.kols.lossEvent;
    if (loss && own.timeS - loss.timeS < 2.5 && !["mode change", "pilot", "rescan", "reset"].includes(loss.reason)) T(0, 0.68, "СРЫВ", "center", 0.08);
    return out;
  }

  /**
   * Helmet-mounted sight symbology (ШЛЕМ mode), drawn on the helmet visor at the pilot's line of sight,
   * in yellow. States per the HMS table: mode on (double circle with ticks); lock by IRST/radar
   * (flashing, shown dashed); lock and launch allowed (circles with a 3° cross); IR-missile lock without
   * range or outside max range (flashing cross). Nothing outside ±60° of the aircraft axis.
   */
  public helmet(): DisplayList {
    const ctx = this.ctx;
    if (!ctx || this.s.master !== "ШЛЕМ") return [];
    const h = ctx.head;
    if (Math.abs(h.az) > 60 * DEG || Math.abs(h.el) > 60 * DEG) return [];
    const own = ctx.own;
    const kl = this.kols.lock(own), rl = this.radar.lock(own);
    const lockOn = !!kl || !!rl;
    const rangeM = kl && Number.isFinite(kl.laserRangeM) ? kl.laserRangeM : rl ? rl.rangeM : Number.NaN;
    // R-60M envelope approximation (BP-29 p.24: 0.3 … 12 km head-on, 9 km tail) for the launch cue (display only).
    const inRange = this.launchState(ctx).ok;
    const flashOn = Math.floor(own.timeS * 4) % 2 === 0;
    const out: DisplayPrimitive[] = [];
    const circle = (rDeg: number, dash: boolean) => out.push({ kind: "circle", frame: "angle", at: [h.az, h.el], radius: rDeg, dash });
    const seg = (a: [number, number], b: [number, number]) => out.push({ kind: "line", frame: "angle", points: [[h.az + a[0] * DEG, h.el + a[1] * DEG], [h.az + b[0] * DEG, h.el + b[1] * DEG]] });
    const cross = () => { seg([-1.5, 0], [-0.3, 0]); seg([0.3, 0], [1.5, 0]); seg([0, -1.5], [0, -0.3]); seg([0, 0.3], [0, 1.5]); };
    if (!lockOn) {
      circle(1.25, false); circle(0.5, false);
      seg([-1.25 * 0.707, -1.25 * 0.707], [-1.7 * 0.707, -1.7 * 0.707]); seg([1.25 * 0.707, 1.25 * 0.707], [1.7 * 0.707, 1.7 * 0.707]);
    } else if (inRange) {
      circle(1.25, false); circle(0.5, false); cross();
    } else if (!Number.isFinite(rangeM)) {
      if (flashOn) { circle(1.25, true); circle(0.5, true); cross(); }
    } else if (flashOn) {
      circle(1.25, true); circle(0.5, true);
    }
    return out;
  }

  /** Horizon (gap and end ticks) and ±10° pitch lines with numerals, conformal; they roll with the aircraft. */
  private horizon(out: DisplayPrimitive[], own: SensorOwnship): void {
    const h = own.headingRad;
    const at = (dAz: number, el: number): [number, number] => {
      const d: Vector3 = [Math.cos(el) * Math.sin(h + dAz), Math.cos(el) * Math.cos(h + dAz), Math.sin(el)];
      const b = bodyAngles(own, d);
      return [b.az, b.el];
    };
    for (const pitch of [0, 10, -10, 20, -20]) {
      const el = pitch * DEG;
      const w = pitch === 0 ? 9 : 4;
      const g = pitch === 0 ? 1.5 : 1;
      out.push({ kind: "line", frame: "angle", points: [at(-w * DEG, el), at(-g * DEG, el)], dash: pitch < 0 });
      out.push({ kind: "line", frame: "angle", points: [at(g * DEG, el), at(w * DEG, el)], dash: pitch < 0 });
      const tick = pitch === 0 ? -0.6 * DEG : (pitch > 0 ? -0.5 : 0.5) * DEG;
      out.push({ kind: "line", frame: "angle", points: [at(-g * DEG, el), at(-g * DEG, el + tick)] });
      out.push({ kind: "line", frame: "angle", points: [at(g * DEG, el), at(g * DEG, el + tick)] });
      out.push({ kind: "text", frame: "angle", at: at((w + 1.6) * DEG, el), text: pitch === 0 ? "00" : String(Math.abs(pitch)), size: 0.06 });
    }
  }

  /** HUD/HDD legend language: "ru" as on the aircraft, or "en". */
  private lang: "ru" | "en" = "ru";
  public setOption(key: string, value: string): void {
    if (key === "hudLanguage" && (value === "ru" || value === "en")) this.lang = value;
    if (key === "stores") { const names = decodeStores(value); if (MIG29_STORES.validate(names).length === 0) { this.loadout = names; this.stores = migStores(names); this.selected = Math.max(0, this.stores.findIndex((x) => x)); } }
  }

  private localize(list: DisplayPrimitive[]): DisplayList {
    if (this.lang === "ru") return list;
    return list.map((p) => (p.kind === "text" ? { ...p, text: p.text.split(" ").map((w) => EN[w] ?? w).join(" ") } : p));
  }

  public hud(): DisplayList { return this.localize(this.picture(true)); }

  public audioCues(): AudioCues {
    const st = this.rwr.state;
    // Low tone per detection event; continuous high tone in track-warning mode (source p.105/108).
    return { newContacts: st.detections > 0 && !st.trackWarning ? 1 : 0, steadyIllumination: st.trackWarning, missile: false };
  }

  public screen(id: string): DisplayList | undefined {
    if (id === "rwr") return spo15Display(this.rwr.state, Math.floor(this.rwrTime * 4) % 2 === 0);
    return id === "radar" ? this.localize(this.picture(false)) : undefined; }

  public status(): Readonly<Record<string, string | number>> {
    const own = this.ctx?.own;
    const rl = own ? this.radar.lock(own) : null;
    return {
      master: this.s.master, radarMode: this.s.radarMode, radar: this.radar.state, kols: this.kols.state,
      plots: this.radar.recentPlots.length, tracks: own ? this.radar.tracks(own).length : 0,
      lockRangeM: rl ? Math.round(rl.rangeM) : Number.NaN, loss: this.radar.lossEvent?.reason ?? ""
    };
  }
}
