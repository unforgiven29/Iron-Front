/**
 * MiG-29 weapon-control system (СУВ): RLPK-29 radar + OEPrNK-29 (KOLS) mode logic, the pilot's
 * controls and the HUD/HDD symbology. Behaviour from BP-29 (MiG-29 combat employment manual,
 * 2nd ed.); page references inline. The sensors themselves are the shared equipment models.
 *
 * Simplifications (stated): ground-controlled ("приборное") guidance zones and datalink commands are
 * not modelled — the autonomous ("глазомерное") zones are used; weapon launch zones are an
 * approximation of BP-29 figs 17–18 for display only (no missiles exist yet); the HMS is the
 * pilot's view direction.
 */
import type { Vector3 } from "../../../../core/coordinates/CoordinateFrames.js";
import type { DisplayList, DisplayPrimitive } from "../../../../rendering/instruments/DisplayList.js";
import { norm, sub, unit } from "../../../../physics/sensing/SweepGeometry.js";
import { DEG, type LookAngles, type RasterPattern } from "../../../../sensors/common/ScanGeometry.js";
import { ScanningIrst } from "../../../../sensors/irst/ScanningIrst.js";
import { PulseDopplerRadar, type RadarTrackReport } from "../../../../sensors/radar/PulseDopplerRadar.js";
import type { AvionicsContext, AvionicsControl, AvionicsSuite } from "../../common/Avionics.js";
import { KOLS_PROFILE } from "./KolsProfile.js";
import { N019_PROFILE } from "./N019Profile.js";

export type Master = "РЛ" | "ТП" | "ББ" | "ШЛЕМ";
export type RadarMode = "В" | "Д" | "АВТ" | "БЛ.БОЙ";

const MASTERS: readonly Master[] = ["РЛ", "ТП", "ББ", "ШЛЕМ"];
const RADAR_MODES: readonly RadarMode[] = ["В", "Д", "АВТ", "БЛ.БОЙ"];
/** ΔH switch positions, km (BP-29 p.7: attack envelope +10 / −6 km). Intermediate steps ESTIMATED. */
const DH_KM = [-6, -4, -2, -1, 0, 1, 2, 4, 6, 8, 10] as const;
/** Range scale per mode, km (BP-29 p.29 fig.19). */
const SCALE_KM: Record<RadarMode, number> = { "В": 150, "АВТ": 100, "Д": 50, "БЛ.БОЙ": 10 };

export const MIG29_AVIONICS_CONTROLS: readonly AvionicsControl[] = [
  { key: "-", label: "Radar mode В / Д / АВТ / БЛ.БОЙ", control: "РЕЖИМЫ РЛС selector (RLPK control panel, BP-29 p.7)" },
  { key: "=", label: "Sight mode РЛ / ТП / ББ / ШЛЕМ", control: "РЕЖИМЫ selector of the OEPrNK (BP-29 fig.1)" },
  { key: "t", label: "Lock (МРК.ЗАХВ.ПЗ)", control: "Lock button on the stick (BP-29 p.16)" },
  { key: "z", label: "Break lock / reset", control: "Lock reset" },
  { key: "[", label: "Strobe range down (hold)", control: "KU-31 range axis (BP-29 p.9)" },
  { key: "]", label: "Strobe range up (hold)", control: "KU-31 range axis" },
  { key: ",", label: "Strobe left (hold)", control: "KU-31 azimuth axis" },
  { key: ".", label: "Strobe right (hold)", control: "KU-31 azimuth axis" },
  { key: ";", label: "ΔH down", control: "ΔH switch (BP-29 p.9 fig.6)" },
  { key: "'", label: "ΔH up", control: "ΔH switch" },
  { key: "\\", label: "Zone L / C / R", control: "ЗОНА switch (BP-29 p.9 fig.4)" },
  { key: "home", label: "Radar emission ИЗЛ on/off", control: "ИЗЛ emission switch (BP-29 fig.1)" },
  { key: "end", label: "СНП track-while-scan on/off", control: "СНП (BP-29 p.14)" },
  { key: "insert", label: "Radar–KOLS interaction ВЗМД", control: "ВЗМД.ТОРМОЗ – БЕЗ ТОРМ. switch (BP-29 p.7, p.11)" },
  { key: "pageup", label: "Radar power", control: "Radar power switch" }
];

export interface Mig29WcsStatus {
  master: Master; radarMode: RadarMode; zone: number; dhKm: number; strobeKm: number; strobeAzDeg: number; strobeElDeg: number;
  emit: boolean; snp: boolean; vzmd: boolean; radarPower: boolean;
}

/** Approximate R-27R max launch range, km, from BP-29 p.21 (ПС 50–60 km, ЗПС 16–18 km at altitude) and fig.17 trend; display only. */
export function r27MaxLaunchKm(aspectFromNoseDeg: number, altitudeM: number): number {
  const front = 55, rear = 17;
  const t = Math.min(1, Math.max(0, aspectFromNoseDeg / 180));
  const alt = 0.45 + 0.55 * Math.min(1, Math.max(0, altitudeM / 10000));
  return (front * (1 - t) + rear * t) * alt;
}

export class MiG29WeaponControl implements AvionicsSuite {
  public readonly controls = MIG29_AVIONICS_CONTROLS;
  public readonly radar: PulseDopplerRadar;
  public readonly kols: ScanningIrst;
  private s: Mig29WcsStatus = this.initial();
  private held = new Set<string>();
  private ctx: AvionicsContext | null = null;
  private lockPressed = false;

  public constructor(private readonly seed = 29) {
    this.radar = new PulseDopplerRadar(N019_PROFILE, seed);
    this.kols = new ScanningIrst(KOLS_PROFILE, seed);
  }

  private initial(): Mig29WcsStatus {
    return { master: "РЛ", radarMode: "В", zone: 0, dhKm: 0, strobeKm: 40, strobeAzDeg: 0, strobeElDeg: 0, emit: true, snp: false, vzmd: false, radarPower: true };
  }

  public reset(): void {
    this.s = this.initial();
    this.radar.breakLock("reset"); this.kols.breakLock("reset");
  }

  public get state(): Readonly<Mig29WcsStatus> { return this.s; }

  public key(k: string, down: boolean): boolean {
    if (!this.controls.some((c) => c.key === k)) return false;
    if (!down) { this.held.delete(k); return true; }
    if (this.held.has(k)) return true;
    this.held.add(k);
    const s = this.s;
    const cycle = <T>(list: readonly T[], v: T) => list[(list.indexOf(v) + 1) % list.length] as T;
    switch (k) {
      case "-": s.radarMode = cycle(RADAR_MODES, s.radarMode); this.radar.breakLock("mode change"); s.strobeKm = Math.min(s.strobeKm, SCALE_KM[s.radarMode]); break;
      case "=": s.master = cycle(MASTERS, s.master); this.radar.breakLock("mode change"); this.kols.breakLock("mode change"); break;
      case "t": this.lockPressed = true; break;
      case "z": this.radar.breakLock("pilot"); this.kols.breakLock("pilot"); break;
      case ";": s.dhKm = DH_KM[Math.max(0, DH_KM.indexOf(s.dhKm as (typeof DH_KM)[number]) - 1)] as number; break;
      case "'": s.dhKm = DH_KM[Math.min(DH_KM.length - 1, DH_KM.indexOf(s.dhKm as (typeof DH_KM)[number]) + 1)] as number; break;
      case "\\": s.zone = s.zone === 0 ? -1 : s.zone === -1 ? 1 : 0; break;
      case "home": s.emit = !s.emit; break;
      case "end": s.snp = !s.snp; break;
      case "insert": s.vzmd = !s.vzmd; break;
      case "pageup": s.radarPower = !s.radarPower; break;
    }
    return true;
  }

  private searchPattern(): RasterPattern {
    const s = this.s;
    if (s.radarMode === "БЛ.БОЙ") {
      // BP-29 p.15–16 fig.12: vertical scan in the plane of symmetry, two columns, 6° wide, −13° … +37°, fixed to the aircraft axis.
      return { frame: "body", center: { az: 0, el: 12 * DEG }, widthRad: 50 * DEG, bars: 2, barSpacingRad: 3 * DEG, orientation: "vertical" };
    }
    // Autonomous guidance zone (BP-29 p.8 table 3, fig.11): 50° az × 4 bars; 11° el below 50 km, 9.5° beyond.
    const elSpan = s.strobeKm < 50 ? 11 : 9.5;
    // Zone centre: ЗОНА left/right shifts to the extreme positions within ±65° (fig.4); elevation α ≈ ΔH/Д (p.9).
    const el = Math.max(-36 * DEG + (elSpan * DEG) / 2, Math.min(56 * DEG - (elSpan * DEG) / 2, Math.atan2(s.dhKm, Math.max(1, s.strobeKm))));
    return { frame: "stabilized", center: { az: s.zone * 40 * DEG, el }, widthRad: 50 * DEG, bars: 4, barSpacingRad: (elSpan * DEG) / 3, orientation: "horizontal" };
  }

  public step(ctx: AvionicsContext, dt: number): void {
    this.ctx = ctx;
    const s = this.s;
    // Strobe (KU-31) slews while held.
    const range = SCALE_KM[s.radarMode];
    if (this.held.has("]")) { if (s.master === "ТП") s.strobeElDeg = Math.min(15, s.strobeElDeg + 15 * dt); else s.strobeKm = Math.min(range, s.strobeKm + range * 0.3 * dt); }
    if (this.held.has("[")) { if (s.master === "ТП") s.strobeElDeg = Math.max(-15, s.strobeElDeg - 15 * dt); else s.strobeKm = Math.max(0.5, s.strobeKm - range * 0.3 * dt); }
    const azLim = s.master === "ТП" ? 30 : 25;
    if (this.held.has(".")) s.strobeAzDeg = Math.min(azLim, s.strobeAzDeg + 20 * dt);
    if (this.held.has(",")) s.strobeAzDeg = Math.max(-azLim, s.strobeAzDeg - 20 * dt);

    // Power: radar on the 115 V AC bus (shed under PTO supply), KOLS on the same bus (assignment ESTIMATED).
    const ac = ctx.snapshot.electrical?.buses.find((b) => b.id === "ac");
    const acOk = !ctx.snapshot.electrical || (!!ac && ac.powered && !ac.shed);
    this.radar.setPower(acOk && s.radarPower);
    this.kols.setPower(acOk);

    const radarActive = s.master === "РЛ";
    this.radar.setRadiate(s.emit && (radarActive || s.vzmd));
    this.radar.setSearch({
      pattern: this.searchPattern(),
      waveformIds: s.radarMode === "В" ? ["HPRF"] : s.radarMode === "Д" ? ["MPRF"] : ["HPRF", "MPRF"],
      tws: s.snp && s.radarMode !== "БЛ.БОЙ",
      plotPersistenceS: 4,
      rangeScaleM: SCALE_KM[s.radarMode] * 1000,
      ...(s.radarMode === "БЛ.БОЙ" && radarActive ? { autoAcquire: { minRangeM: 450, maxRangeM: 10000 } } : {})
    });

    // KOLS modes (BP-29 figs 14–16).
    if (s.master === "ТП") this.kols.setScan({ frame: "body", center: { az: 0, el: 0 }, widthRad: 60 * DEG, bars: 8, barSpacingRad: 3.75 * DEG, orientation: "horizontal" });
    else if (s.master === "ББ") this.kols.setScan({ frame: "body", center: { az: 0, el: 1 * DEG }, widthRad: 30 * DEG, bars: 1, barSpacingRad: 4 * DEG, orientation: "vertical" }, true);
    else if (s.master === "ШЛЕМ") this.kols.setScan(null);
    else this.kols.setScan(null);
    this.kols.setSlave(s.master === "ШЛЕМ" ? { az: Math.max(-30 * DEG, Math.min(30 * DEG, ctx.head.az)), el: Math.max(-15 * DEG, Math.min(30 * DEG, ctx.head.el)) } : null);
    this.kols.setLaser(true);

    if (this.lockPressed) { this.lockPressed = false; this.designate(ctx); }

    // СНП: the most dangerous track (min Д/Ḋ) is framed; auto-lock at the max launch range (BP-29 p.14).
    if (radarActive && s.snp && this.radar.state === "search") {
      const md = this.mostDangerous(ctx);
      if (md && md.rangeM / 1000 < r27MaxLaunchKm(this.aspectDeg(md, ctx.own.positionEnuM), ctx.own.positionEnuM[2])) {
        this.radar.designate({ look: md.look, frame: "stabilized", rangeM: md.rangeM, rangeWindowM: 2000, timeoutS: 3 });
      }
    }
    // Interaction: KOLS track cues the radar for range (ВЗМД, BP-29 p.18).
    const kl = this.kols.lock(ctx.own);
    if (s.vzmd && kl && this.radar.state !== "track" && this.radar.state !== "acquire" && this.radar.state !== "memory") {
      this.radar.designate({ look: kl.lookBody, frame: "body", rangeM: 5000, rangeWindowM: 10000, minRangeM: 300, maxRangeM: 20000, timeoutS: 3, pattern: { widthRad: 0.01 * DEG, bars: 1 } });
    }

    this.radar.step(ctx.own, ctx.scene, dt);
    this.kols.step(ctx.own, ctx.scene, dt);
  }

  private designate(ctx: AvionicsContext): void {
    const s = this.s;
    if (s.master === "РЛ" && s.radarMode !== "БЛ.БОЙ") {
      const pat = this.searchPattern();
      // Strobe position: azimuth from the strobe, range from the strobe; pick the nearest plot inside it.
      const plot = this.radar.recentPlots.filter((p) => !p.falseAlarm && Math.abs(p.look.az / DEG - s.strobeAzDeg) < 4 && Math.abs(p.rangeM / 1000 - s.strobeKm) < SCALE_KM[s.radarMode] * 0.05)
        .sort((a, b) => b.timeS - a.timeS)[0];
      const look: LookAngles = plot ? plot.look : { az: s.strobeAzDeg * DEG, el: pat.center.el };
      this.radar.designate({ look, frame: "stabilized", rangeM: plot ? plot.rangeM : s.strobeKm * 1000, rangeWindowM: Math.max(2000, SCALE_KM[s.radarMode] * 60), timeoutS: 3, pattern: { widthRad: plot ? 2 * DEG : 8 * DEG, bars: plot ? 2 : 4 } });
    } else if (s.master === "РЛ") {
      // БЛ.БОЙ locks automatically; the button restarts the scan.
      this.radar.breakLock("rescan");
    } else if (s.master === "ТП") {
      this.kols.designate({ az: s.strobeAzDeg * DEG, el: s.strobeElDeg * DEG }, "body", 4 * DEG, 6 * DEG);
    } else if (s.master === "ШЛЕМ") {
      this.kols.designate({ az: ctx.head.az, el: ctx.head.el }, "body", 4 * DEG, 4 * DEG);
    }
  }

  private mostDangerous(ctx: AvionicsContext): RadarTrackReport | undefined {
    return this.radar.tracks(ctx.own).filter((t) => t.closureMps > 1).sort((a, b) => a.rangeM / a.closureMps - b.rangeM / b.closureMps)[0];
  }

  /** Target aspect from its nose, deg (0 = head-on), from the estimated velocity. */
  private aspectDeg(t: RadarTrackReport, ownPos: Vector3): number {
    const v = t.velocityEnuMps;
    if (norm(v) < 10) return 0;
    const toUs = unit(sub(ownPos, t.positionEnuM));
    const c = (v[0] * toUs[0] + v[1] * toUs[1] + v[2] * toUs[2]) / norm(v);
    return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  }

  // ---------------- symbology ----------------

  /** СЕИ/ИЛС picture (BP-29 figs 19–22). Screen frame: x ±1 across, y ±1. */
  private picture(conformal: boolean): DisplayPrimitive[] {
    const out: DisplayPrimitive[] = [];
    const ctx = this.ctx;
    if (!ctx) return out;
    const s = this.s;
    const L = (pts: [number, number][], o: Partial<Extract<DisplayPrimitive, { kind: "line" }>> = {}) => out.push({ kind: "line", frame: "screen", points: pts, ...o });
    const T = (x: number, y: number, text: string, align: "left" | "center" | "right" = "left", size = 0.07) => out.push({ kind: "text", frame: "screen", at: [x, y], text, align, size });
    const rl = this.radar.lock(ctx.own);
    const kl = this.kols.lock(ctx.own);
    const radarLocked = !!rl && (s.master === "РЛ" || s.vzmd);
    const scaleKm = rl ? (rl.rangeM > 25000 ? 50 : rl.rangeM > 10000 ? 25 : 10) : s.master === "РЛ" ? SCALE_KM[s.radarMode] : 10;
    // Range scale on the left (fig.19): x = −0.8, y from −0.7 (0) to +0.7 (full scale).
    const ry = (km: number) => -0.7 + 1.4 * Math.min(1, Math.max(0, km / scaleKm));
    L([[-0.8, -0.7], [-0.8, 0.7]]);
    for (let i = 0; i <= 5; i++) { const y = -0.7 + (1.4 * i) / 5; L([[-0.8, y], [-0.76, y]]); if (i > 0) T(-0.83, y, String(Math.round((scaleKm * i) / 5)), "right", 0.06); }
    T(-1.12, 0.15, s.master === "ББ" || s.master === "ТП" || s.master === "ШЛЕМ" ? "ТП" : "РЛ", "left", 0.07);
    if (rl || kl) T(-1.12, -0.05, "А", "left", 0.07);
    // Mode / sensor status line.
    const rs = this.radar.state;
    T(0.95, -0.85, `${s.master === "РЛ" ? s.radarMode : s.master}${s.snp ? " СНП" : ""}${s.vzmd ? " ВЗМД" : ""}${s.emit ? "" : " ИЗЛ ОТКЛ"}`, "right", 0.06);
    T(0.95, -0.95, `РЛС ${rs.toUpperCase()}  КОЛС ${this.kols.state.toUpperCase()}`, "right", 0.05);
    if (s.master === "РЛ" && !rl) {
      // ΔH and zone.
      T(0.95, 0.85, `ΔH ${s.dhKm > 0 ? "+" : ""}${s.dhKm}`, "right", 0.06);
      const az = (deg: number) => (deg / 25) * 0.6;
      if (s.radarMode === "БЛ.БОЙ") {
        // Two vertical lines bounding the zone, conformal on the HUD (fig.12).
        if (conformal) for (const x of [-3, 3]) out.push({ kind: "line", frame: "angle", points: [[x * DEG, -13 * DEG], [x * DEG, 37 * DEG]] });
      } else {
        // Plots.
        for (const p of this.radar.recentPlots) {
          const x = az(p.look.az / DEG), y = ry(p.rangeM / 1000);
          if (Math.abs(x) > 0.75) continue;
          L([[x - 0.035, y], [x + 0.035, y]], { width: 2.5 });
        }
        // TWS tracks with the most dangerous framed (fig. СНП p.14).
        const md = this.mostDangerous(ctx);
        for (const t of this.radar.tracks(ctx.own)) {
          const x = az(t.look.az / DEG), y = ry(t.rangeM / 1000);
          if (Math.abs(x) > 0.75) continue;
          out.push({ kind: "circle", frame: "screen", at: [x, y], radius: 0.03 });
          if (md && t.id === md.id) L([[x - 0.07, y - 0.06], [x + 0.07, y - 0.06], [x + 0.07, y + 0.06], [x - 0.07, y + 0.06]], { closed: true });
        }
        // Strobe "=" (fig.19).
        const sx = az(s.strobeAzDeg), sy = ry(s.strobeKm);
        L([[sx - 0.05, sy + 0.03], [sx + 0.05, sy + 0.03]]); L([[sx - 0.05, sy - 0.03], [sx + 0.05, sy - 0.03]]);
        // Antenna position marker under the scale.
        const b = this.radar.beam.look;
        L([[az(b.az / DEG), -0.78], [az(b.az / DEG), -0.73]]);
      }
    }
    if (s.master === "ТП" && !kl) {
      const az = (deg: number) => (deg / 30) * 0.6, el = (deg: number) => (deg / 15) * 0.6;
      L([[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]], { closed: true, dash: true });
      for (const p of this.kols.recentPlots) out.push({ kind: "circle", frame: "screen", at: [az(p.look.az / DEG), el(p.look.el / DEG)], radius: 0.02, fill: true });
      const x = az(s.strobeAzDeg), y = el(s.strobeElDeg);
      L([[x - az(2), y - el(3)], [x + az(2), y - el(3)], [x + az(2), y + el(3)], [x - az(2), y + el(3)]], { closed: true });
    }
    if (s.master === "ББ" && !kl && conformal) for (const x of [-2, 2]) out.push({ kind: "line", frame: "angle", points: [[x * DEG, -14 * DEG], [x * DEG, 16 * DEG]] });
    if (s.master === "ШЛЕМ" && conformal) out.push({ kind: "circle", frame: "angle", at: [this.kols.head.look.az, this.kols.head.look.el], radius: 0.05, dash: true });

    // Locked target: ring (conformal on the HUD), range arrow, launch-zone marks, closure, aspect.
    const lockLook = radarLocked && rl ? rl.lookBody : kl?.lookBody;
    if (lockLook) {
      if (conformal) out.push({ kind: "circle", frame: "angle", at: [lockLook.az, lockLook.el], radius: 0.07, dash: (rl?.memory ?? kl?.memory) === true });
      else out.push({ kind: "circle", frame: "screen", at: [(lockLook.az / (45 * DEG)) * 0.6, (lockLook.el / (45 * DEG)) * 0.6], radius: 0.06 });
      const rangeM = radarLocked && rl ? rl.rangeM : kl && Number.isFinite(kl.laserRangeM) ? kl.laserRangeM : Number.NaN;
      if (Number.isFinite(rangeM)) {
        const y = ry(rangeM / 1000);
        L([[-0.75, y], [-0.68, y + 0.03], [-0.68, y - 0.03]], { closed: true });
        T(0.95, 0.75, `Д ${(rangeM / 1000).toFixed(1)}`, "right", 0.065);
      }
      if (radarLocked && rl) {
        const asp = this.aspectDeg(rl, ctx.own.positionEnuM);
        const rmax = r27MaxLaunchKm(asp, ctx.own.positionEnuM[2]);
        const rmin = asp < 90 ? 1.2 : 0.5;
        for (const km of [rmax, rmin]) { const y = ry(km); L([[-0.8, y], [-0.86, y]], { width: 2.5 }); }
        T(0.95, 0.65, `Ḋ ${(rl.closureMps * 3.6).toFixed(0)}`, "right", 0.06);
        T(0.95, 0.55, `${asp < 90 ? "ППС" : "ЗПС"} ${Math.round((asp > 90 ? 180 - asp : asp) / 22.5)}/4`, "right", 0.06);
        if (rl.rangeM / 1000 <= rmax && rl.rangeM / 1000 >= rmin) T(0, -0.55, "ПР", "center", 0.09);
      }
      if (kl && !radarLocked) T(0.95, 0.65, `КОЛС ${Number.isFinite(kl.laserRangeM) ? "ЛД" : "УГЛ"}`, "right", 0.06);
    }
    const loss = this.radar.lossEvent ?? this.kols.lossEvent;
    if (loss && ctx.own.timeS - loss.timeS < 3 && loss.reason !== "mode change") T(0, 0.85, `СРЫВ: ${loss.reason}`, "center", 0.06);
    return out;
  }

  public hud(): DisplayList { return this.picture(true); }

  public screen(id: string): DisplayList | undefined {
    if (id !== "radar") return undefined;
    return this.picture(false);
  }

  public status(): Readonly<Record<string, string | number>> {
    const own = this.ctx?.own;
    const rl = own ? this.radar.lock(own) : null;
    return {
      master: this.s.master, radarMode: this.s.radarMode, radar: this.radar.state, kols: this.kols.state,
      plots: this.radar.recentPlots.length, tracks: own ? this.radar.tracks(own).length : 0,
      lockRangeM: rl ? Math.round(rl.rangeM) : Number.NaN,
      beamAzDeg: Math.round((this.radar.beam.look.az / DEG) * 10) / 10, beamElDeg: Math.round((this.radar.beam.look.el / DEG) * 10) / 10,
      loss: this.radar.lossEvent?.reason ?? ""
    };
  }
}

