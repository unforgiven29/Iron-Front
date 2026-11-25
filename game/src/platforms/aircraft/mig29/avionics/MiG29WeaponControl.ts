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
import type { AvionicsContext, AvionicsControl, AvionicsSuite } from "../../common/Avionics.js";
import { KOLS_PROFILE } from "./KolsProfile.js";
import { N019_PROFILE } from "./N019Profile.js";

/** РЕЖ.СУВ selector positions used here (RLPK slide 61: КБР, НВГ, РЛС, СТРОБ/ТП, Б.БОЙ, ШЛЕМ, ОПТ, φ0). */
export type Master = "НВГ" | "РЛС" | "ТП" | "ББ" | "ШЛЕМ" | "ОПТ" | "БРСТ";
export type RadarMode = "В" | "Д" | "АВТ" | "БЛ.БОЙ";
export type Emission = "ИЗЛ" | "ЭКВ" | "ОТКЛ";
export type Snp = "ОТКЛ" | "ППС" | "ЗПС";

const MASTERS: readonly Master[] = ["НВГ", "РЛС", "ТП", "ББ", "ШЛЕМ", "ОПТ", "БРСТ"];
/** English names shown on the ИЛС and in the controls list. */
export const MASTER_EN: Record<Master, string> = { "НВГ": "NAV", "РЛС": "RDR", "ТП": "IRST", "ББ": "CC", "ШЛЕМ": "HMS", "ОПТ": "OPT", "БРСТ": "BRST" };
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
  { key: "c", label: "Radar sidelobe guard on/off", control: "КОМПЕНС switch, panel ПУР-31 (guard channel)" },
  { key: "[", label: "IRST gain down", control: "УСИЛ.ТП knob, panel ПСР-31" },
  { key: "]", label: "IRST gain up", control: "УСИЛ.ТП knob, panel ПСР-31" },
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

export class MiG29WeaponControl implements AvionicsSuite {
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

  public constructor(seed = 29) {
    this.radar = new PulseDopplerRadar(N019_PROFILE, seed);
    this.kols = new ScanningIrst(KOLS_PROFILE, seed);
  }

  private static initial(): Mig29WcsStatus {
    return { master: "РЛС", radarMode: "В", zone: 0, dhKm: 0, strobeKm: 40, strobeAzDeg: 0, strobeElDeg: 0, emission: "ИЗЛ", snp: "ОТКЛ", interaction: false, laser: true, compensation: true, irstGain: 0.5, optAzDeg: 0, optElDeg: 0, gun: false };
  }

  public reset(): void { this.s = MiG29WeaponControl.initial(); this.radar.breakLock("reset"); this.kols.breakLock("reset"); }

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
      case "c": s.compensation = !s.compensation; break;
      case "[": s.irstGain = Math.max(0, Math.round((s.irstGain - 0.1) * 10) / 10); break;
      case "]": s.irstGain = Math.min(1, Math.round((s.irstGain + 0.1) * 10) / 10); break;
      case "k": s.gun = true; break;
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

    // СНП: the most dangerous track (min Д/Ḋ) is framed; auto-lock at the max launch range (BP-29 p.14).
    // At the max launch range the radar stops scanning and searches a 40° × 8° box on the target for up to 3 cycles (N019-WEB).
    if (this.snpActive() && this.radar.state === "search") {
      const md = this.priorityTrack(ctx.own);
      if (md && md.rangeM / 1000 < r27MaxLaunchKm(this.aspectDeg(md, ctx.own.positionEnuM), ctx.own.positionEnuM[2])) {
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

  // ======================= ИЛС / ИПВ symbology =======================

  /** The ИЛС picture. `hud` adds the flight symbology and conformal elements; otherwise the head-down repeat. */
  private picture(hud: boolean): DisplayPrimitive[] {
    const out: DisplayPrimitive[] = [];
    const ctx = this.ctx;
    if (!ctx) return out;
    const s = this.s, own = ctx.own;
    const L = (pts: [number, number][], o: { closed?: boolean; dash?: boolean; width?: number } = {}) => { out.push({ kind: "line", frame: "screen", points: pts, ...o }); };
    const T = (x: number, y: number, text: string, align: "left" | "center" | "right" = "left", size = 0.075) => { out.push({ kind: "text", frame: "screen", at: [x, y], text, align, size }); };
    const O = (x: number, y: number, r: number, dash = false) => { out.push({ kind: "circle", frame: "screen", at: [x, y], radius: r, dash }); };
    const rl = this.radar.lock(own);
    const kl = this.kols.lock(own);

    // ---------- flight symbology (BP-29 figs 19–25, 55): IAS km/h + trend index, heading scale, altitude m ----------
    if (hud) {
      const snap = ctx.snapshot as Partial<typeof ctx.snapshot>;
      const ias = (snap.equivalentAirspeedMps ?? norm(own.velocityEnuMps)) * 3.6;
      const alt = snap.altitudeMslM ?? own.positionEnuM[2];
      T(-0.82, 0.93, `${Math.round(ias / 10) * 10}`, "center", 0.09);
      L([[-0.92, 0.86], [-0.72, 0.86]]);
      L([[-0.84, 0.8], [-0.8, 0.86], [-0.76, 0.8]], { closed: true });
      T(0.85, 0.93, `${Math.round(alt / 10) * 10}`, "center", 0.09);
      const hdg = ((own.headingRad / DEG) % 360 + 360) % 360;
      const centreTen = Math.round(hdg / 10);
      const px = 0.025;
      L([[-0.32, 0.86], [0.32, 0.86]]);
      for (let d = -1; d <= 1; d++) {
        const ten = centreTen + d;
        const x = (ten * 10 - hdg) * px;
        if (Math.abs(x) <= 0.32) { L([[x, 0.86], [x, 0.89]]); T(x, 0.94, String(((ten % 36) + 36) % 36).padStart(2, "0"), "center", 0.07); }
        if (Math.abs(x + 0.125) <= 0.32) L([[x + 0.125, 0.86], [x + 0.125, 0.875]]);
      }
      L([[-0.025, 0.8], [0, 0.85], [0.025, 0.8]], { closed: true });
      this.horizon(out, own);
      // Aircraft silhouette (fig.55 item 13) at the fixed aiming point.
      L([[-0.12, 0], [-0.04, 0]]); L([[0.04, 0], [0.12, 0]]); L([[0, 0.02], [0, 0.07]]);
    }

    const rangeScale = (scaleKm: number, label: string) => {
      L([[-0.78, -0.7], [-0.78, 0.7]]);
      for (let i = 0; i <= 5; i++) { const y = -0.7 + (1.4 * i) / 5; L([[-0.78, y], [-0.74, y]]); if (i > 0) T(-0.81, y, fmtKm((scaleKm * i) / 5), "right", 0.06); }
      T(-0.97, 0.2, label, "left", 0.075);
      return (km: number) => -0.7 + 1.4 * Math.min(1, Math.max(0, km / scaleKm));
    };
    const rangeArrow = (y: number) => L([[-0.74, y], [-0.66, y + 0.035], [-0.66, y - 0.035]], { closed: true });

    const lead = this.oepsLeads() ? "ТП" : "РЛ";
    const locked = (lead === "РЛ" && rl) || (lead === "ТП" && (kl || rl));
    if (locked) {
      // ---------- target locked (BP-29 fig.20 radar, fig.22 OEPS) ----------
      const useRadar = lead === "РЛ" ? true : !kl;
      const look = useRadar ? rl!.lookBody : kl!.lookBody;
      const rangeM = useRadar ? rl!.rangeM : Number.isFinite(kl!.laserRangeM) ? kl!.laserRangeM : rl ? rl.rangeM : Number.NaN;
      const scaleKm = useRadar ? (rangeM > 25000 ? 50 : rangeM > 10000 ? 25 : 10) : 10;
      const ry = rangeScale(scaleKm, useRadar ? "РЛ" : "ТП");
      T(-0.97, 0.0, "А", "left", 0.08);
      // Aiming ring: ±45° (radar) / ±30° (OEPS) to the field edge; diamond ±70° (fig.20).
      const ringScale = useRadar ? 45 * DEG : 30 * DEG;
      const rx = Math.max(-0.95, Math.min(0.95, (look.az / ringScale) * 0.9)), ry2 = Math.max(-0.95, Math.min(0.95, (look.el / ringScale) * 0.9));
      O(rx, ry2, 0.08, useRadar ? rl!.memory : kl!.memory);
      if (useRadar) {
        const dx = (look.az / (70 * DEG)) * 0.9, dy = (look.el / (70 * DEG)) * 0.9;
        L([[dx, dy + 0.035], [dx + 0.025, dy], [dx, dy - 0.035], [dx - 0.025, dy]], { closed: true });
      }
      if (hud) out.push({ kind: "circle", frame: "angle", at: [look.az, look.el], radius: 0.035, dash: true });
      if (Number.isFinite(rangeM)) { rangeArrow(ry(rangeM / 1000)); T(0.95, 0.72, `Д ${(rangeM / 1000).toFixed(rangeM < 10000 ? 2 : 1)}`, "right", 0.07); }
      if (useRadar) {
        const asp = this.aspectDeg(rl!, own.positionEnuM);
        const rmax = r27MaxLaunchKm(asp, own.positionEnuM[2]);
        const rmin = asp < 90 ? 1.2 : 0.5;
        for (const km of [rmax, rmin]) { const y = ry(km); L([[-0.78, y], [-0.86, y]], { width: 2.5 }); }
        T(0.95, 0.62, `${Math.round((rl!.closureMps * 3.6) / 10) * 10}`, "right", 0.065);
        T(-0.97, -0.25, asp < 90 ? "ППС" : "ЗПС", "left", 0.065);
        if (rangeM / 1000 <= rmax && rangeM / 1000 >= rmin) T(0, -0.62, "ПР", "center", 0.1);
        T(0.95, -0.85, "27Р", "right", 0.075);
      } else {
        T(0.95, -0.85, "60М", "right", 0.075);
        if (!Number.isFinite(rangeM)) T(0.95, 0.72, "Д —", "right", 0.07);
      }
    } else if (s.master === "РЛС" && s.radarMode !== "БЛ.БОЙ") {
      // ---------- radar search (BP-29 fig.19): scale 150/100/50 km, azimuth ±25° ----------
      const ry = rangeScale(SCALE_KM[s.radarMode], "РЛ");
      const ax = (deg: number) => (deg / 25) * 0.62;
      for (const p of this.radar.recentPlots) {
        const x = ax(p.look.az / DEG), y = ry(p.rangeM / 1000);
        if (Math.abs(x) <= 0.66) L([[x - 0.04, y], [x + 0.04, y]], { width: 3 });
      }
      const md = this.snpActive() ? this.priorityTrack(own) : undefined;
      for (const t of this.radar.tracks(own)) {
        const x = ax(t.look.az / DEG), y = ry(t.rangeM / 1000);
        if (Math.abs(x) > 0.66) continue;
        O(x, y, 0.025);
        if (md && t.id === md.id) L([[x - 0.07, y - 0.055], [x + 0.07, y - 0.055], [x + 0.07, y + 0.055], [x - 0.07, y + 0.055]], { closed: true });
      }
      // Capture strobe (cursor): a box over the mark to lock.
      const sx = ax(s.strobeAzDeg), sy = ry(s.strobeKm);
      L([[sx - 0.06, sy - 0.045], [sx + 0.06, sy - 0.045], [sx + 0.06, sy + 0.045], [sx - 0.06, sy + 0.045]], { closed: true, width: 1.5 });
      L([[ax(-25), -0.78], [ax(25), -0.78]]);
      L([[ax(this.radar.beam.look.az / DEG), -0.82], [ax(this.radar.beam.look.az / DEG), -0.74]]);
      T(0.95, 0.75, `${s.dhKm > 0 ? "+" : ""}${s.dhKm}`, "right", 0.07);
      if (this.radar.acquisitionPhase) T(0, -0.62, "ЗАХВ", "center", 0.07);
    } else if (s.master === "РЛС" || (s.master === "ББ" && !this.oepsLeads())) {
      // ---------- radar close combat (BP-29 figs 12–13): two vertical lines bounding the zone ----------
      if (hud) for (const x of [-3, 3]) out.push({ kind: "line", frame: "angle", points: [[x * DEG, -13 * DEG], [x * DEG, 37 * DEG]] });
      else for (const x of [-0.06, 0.06]) L([[x, -0.4], [x, 0.9]]);
      T(-0.97, 0.2, "РЛ", "left", 0.075);
      T(0.95, -0.85, "Б.Б", "right", 0.075);
    } else if (s.master === "ТП") {
      // ---------- OEPS search (BP-29 fig.21): ±30° az, ±15° el; 4° × 6° capture strobe ----------
      const ax = (deg: number) => (deg / 30) * 0.8, ay = (deg: number) => (deg / 15) * 0.6;
      L([[-0.8, -0.6], [0.8, -0.6], [0.8, 0.6], [-0.8, 0.6]], { closed: true, dash: true });
      T(-0.97, 0.2, "ТП", "left", 0.075);
      for (const p of this.kols.recentPlots) out.push({ kind: "circle", frame: "screen", at: [ax(p.look.az / DEG), ay(p.look.el / DEG)], radius: 0.018, fill: true });
      const x = ax(s.strobeAzDeg), y = ay(s.strobeElDeg);
      L([[x - ax(2), y - ay(3)], [x + ax(2), y - ay(3)], [x + ax(2), y + ay(3)], [x - ax(2), y + ay(3)]], { closed: true });
      if (this.kols.state === "acquire") T(0, -0.62, "ЗАХВ", "center", 0.07);
    } else if (s.master === "ББ") {
      // ---------- OEPS close combat (BP-29 fig.15): 4°-wide vertical strip, shown −12° … +12° on the ИЛС ----------
      if (hud) for (const x of [-2, 2]) out.push({ kind: "line", frame: "angle", points: [[x * DEG, -12 * DEG], [x * DEG, 12 * DEG]] });
      else for (const x of [-0.05, 0.05]) L([[x, -0.6], [x, 0.6]]);
      T(-0.97, 0.2, "ТП", "left", 0.075);
      T(0.95, -0.85, "Б.Б", "right", 0.075);
    } else if (s.master === "ШЛЕМ") {
      // ---------- helmet (BP-29 fig.16): sight circle with cross at the head direction ----------
      const h = this.kols.head.look;
      if (hud) {
        out.push({ kind: "circle", frame: "angle", at: [h.az, h.el], radius: 0.06 });
        out.push({ kind: "line", frame: "angle", points: [[h.az - 1.3 * DEG, h.el], [h.az + 1.3 * DEG, h.el]] });
        out.push({ kind: "line", frame: "angle", points: [[h.az, h.el - 1.3 * DEG], [h.az, h.el + 1.3 * DEG]] });
      }
      T(-0.97, 0.2, "ТП", "left", 0.075);
      T(0.95, -0.85, "ШЛЕМ", "right", 0.07);
    } else if (s.master === "ОПТ") {
      // ---------- optical (BP-29 fig.23): fixed aiming ring, ±3.36° scale, range scale 10 km ----------
      rangeScale(10, "ТП");
      if (hud) out.push({ kind: "circle", frame: "angle", at: [0, 0], radius: 0.07 });
      else O(0, 0, 0.12);
      T(0.95, -0.85, "ОПТ", "right", 0.07);
    } else {
      T(0.95, -0.85, "НВГ", "right", 0.07);
    }

    // Switch-state line (simulation aid; the real ИЛС has no such line).
    if (!hud || s.emission !== "ИЗЛ" || s.interaction || s.snp !== "ОТКЛ" || !s.compensation) T(0.95, -0.95, `${s.emission}${s.interaction ? " ТОРМ" : ""}${s.snp !== "ОТКЛ" ? ` СНП ${s.snp}` : ""}${s.compensation ? "" : " БЕЗ КОМП"}`, "right", 0.05);
    if (!hud) T(-0.95, -0.95, `РЛС ${this.radar.state.toUpperCase()}  КОЛС ${this.kols.state.toUpperCase()}`, "left", 0.05);
    const loss = this.radar.lossEvent ?? this.kols.lossEvent;
    if (loss && own.timeS - loss.timeS < 2.5 && !["mode change", "pilot", "rescan", "reset"].includes(loss.reason)) T(0, 0.72, "СРЫВ", "center", 0.08);
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
    for (const pitch of [0, 10, -10]) {
      const el = pitch * DEG;
      const w = pitch === 0 ? 9 : 4;
      const g = pitch === 0 ? 1.5 : 1;
      out.push({ kind: "line", frame: "angle", points: [at(-w * DEG, el), at(-g * DEG, el)], dash: pitch < 0 });
      out.push({ kind: "line", frame: "angle", points: [at(g * DEG, el), at(w * DEG, el)], dash: pitch < 0 });
      const tick = pitch === 0 ? -0.6 * DEG : (pitch > 0 ? -0.5 : 0.5) * DEG;
      out.push({ kind: "line", frame: "angle", points: [at(-g * DEG, el), at(-g * DEG, el + tick)] });
      out.push({ kind: "line", frame: "angle", points: [at(g * DEG, el), at(g * DEG, el + tick)] });
      out.push({ kind: "text", frame: "angle", at: at((w + 1.6) * DEG, el), text: pitch === 0 ? "00" : "10", size: 0.06 });
    }
  }

  public hud(): DisplayList { return this.picture(true); }

  public screen(id: string): DisplayList | undefined { return id === "radar" ? this.picture(false) : undefined; }

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
