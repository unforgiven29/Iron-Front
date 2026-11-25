/**
 * F-16C Block 50 fire-control radar installation (AN/APG-68(V)5 working baseline) on the shared
 * pulse-Doppler radar engine, with F-16-style controls and an FCR MFD page.
 *
 * PROVISIONAL: no F-16 radar source is in the project's reference library yet. Every hardware value
 * is ESTIMATED from the radar's class (flat slotted planar array, X band) and nothing is fitted to
 * published performance; treat detection ranges as unvalidated until a sourced figure is added.
 * Modes: CRM range-while-search (MPRF, optional HPRF interleave) and ACM 30×20 / 10×60 vertical
 * scans with auto-acquisition. TWS, SAM, DTT, GM/SEA and the ECCM options are not modelled.
 */
import type { DisplayList, DisplayPrimitive } from "../../../../rendering/instruments/DisplayList.js";
import { DEG, type RasterPattern } from "../../../../sensors/common/ScanGeometry.js";
import { PulseDopplerRadar, type RadarProfile, type WaveformSpec } from "../../../../sensors/radar/PulseDopplerRadar.js";
import type { AudioCues, AvionicsContext, AvionicsControl, AvionicsSuite, LoadoutOption } from "../../common/Avionics.js";
import { RadarWarningReceiver } from "../../../../sensors/rwr/RadarWarningReceiver.js";
import { ALR56M_PROFILE, alr56mDisplay } from "./ALR56M.js";
import { NOTIONAL_AAM, type NotionalMissileSpec } from "../../../../weapons/catalog/NotionalAirToAir.js";

const E = (source: string) => ({ source: `ESTIMATED: ${source}`, status: "estimated" as const });

const MPRF: WaveformSpec = {
  id: "MPRF", label: "MED PRF", prfsHz: { value: [10.2e3, 11.0e3, 11.9e3, 12.9e3, 14.0e3, 15.2e3, 16.5e3, 17.9e3], ...E("medium-PRF set typical of the class") },
  pulseWidthS: { value: 1.1e-6, ...E("") }, averagePowerW: { value: 250, ...E("not validated") }, mainlobeNotchMps: { value: 50, ...E("main-lobe clutter filter") },
  searchRangeSigmaM: { value: 50, ...E("") }, rangeGated: true, twsRangeGateM: { value: 2000, ...E("") }
};
const HPRF: WaveformSpec = {
  id: "HPRF", label: "HI PRF", prfsHz: { value: [150e3, 160e3, 170e3], ...E("") }, pulseWidthS: { value: 1.3e-6, ...E("") }, averagePowerW: { value: 900, ...E("not validated") },
  mainlobeNotchMps: { value: 50, ...E("") }, searchRangeSigmaM: { value: 2000, ...E("") }, rangeGated: false, twsRangeGateM: { value: 8000, ...E("") }
};

export const APG68_PROFILE: RadarProfile = {
  id: "apg68v5.f16c50", designation: "AN/APG-68(V)5 (provisional)",
  frequencyHz: { value: 9.7e9, ...E("X band") },
  aperture: { value: { diameterM: 0.62, taperExponent: 1, farSidelobeFloorDb: 40 }, ...E("planar array modelled as a circular aperture") },
  noiseFigureDb: { value: 3.5, ...E("") }, antennaTemperatureK: { value: 150, ...E("") },
  lossesDb: { value: { radome: 1.0, plumbing: 1.2, beamShapeScan: 1.3, filterMismatch: 1.2, cfar: 1.0, straddle: 1.0 }, ...E("") },
  falseAlarmProbability: { value: 1e-6, ...E("") },
  clutterSpreadDbc: { value: -65, ...E("") },
  timing: { value: { searchTactS: 10e-3, searchCoherentS: 5e-3, trackTactS: 20e-3, trackCoherentS: 10e-3, confirmTacts: 2 }, ...E("") },
  scanRateRadS: { value: 60 * DEG, ...E("") }, barTurnaroundS: { value: 0.1, ...E("") }, slewRateRadS: { value: 120 * DEG, ...E("") },
  searchGimbal: { value: { azMaxRad: 60 * DEG, elMinRad: -60 * DEG, elMaxRad: 60 * DEG }, ...E("±60° gimbal") },
  trackGimbal: { value: { azMaxRad: 60 * DEG, elMinRad: -60 * DEG, elMaxRad: 60 * DEG }, ...E("") },
  stabilization: { value: { rollMaxRad: 180 * DEG, pitchUpRad: 60 * DEG, pitchDownRad: 60 * DEG }, ...E("") },
  minTrackRangeM: { value: 300, ...E("") }, instrumentedRangeM: { value: 160 * 1852, ...E("160 nm scale") },
  acquisition: { value: { offsetAzRad: -3 * DEG, offsetElRad: 1.5 * DEG, boxWidthRad: 6 * DEG, boxSpacingRad: 3 * DEG, boxRateRadS: 30 * DEG, periods: 2, pullInS: 0.8, attempts: 4 }, ...E("") },
  trackMemoryS: { value: 2.0, ...E("") }, maxTrackLosRateRadS: { value: 70 * DEG, ...E("") },
  trackAccuracy: { value: { rangeM: 100, angleRad: 0.2 * DEG, speedMps: 5 }, ...E("") }, rangeFilter: { value: { alpha: 0.5, beta: 0.05 }, ...E("") },
  waveforms: { MPRF, HPRF }, tws: { value: { capacity: 10, dropAfterS: 13, gateAzRad: 4 * DEG, gateElRad: 2 * DEG }, ...E("") }, warmUpS: { value: 180, ...E("") }
};

type Mode = "CRM" | "ACM";
const NM = 1852;
const SCALES = [10, 20, 40, 80, 160];
const AZ = [60, 30, 10];
const BARS = [1, 2, 4];

export const F16_AVIONICS_CONTROLS: readonly AvionicsControl[] = [
  { key: "arrowup", label: "Radar cursor: farther", control: "Cursor/enable switch" },
  { key: "arrowdown", label: "Radar cursor: nearer", control: "Cursor/enable switch" },
  { key: "arrowleft", label: "Radar cursor: left", control: "Cursor/enable switch" },
  { key: "arrowright", label: "Radar cursor: right", control: "Cursor/enable switch" },
  { key: "enter", label: "Lock target under the cursor", control: "TMS forward" },
  { key: "backspace", label: "Break lock", control: "TMS aft" },
  { key: "-", label: "Radar mode: search / dogfight", control: "FCR mode (CRM / ACM)" },
  { key: "=", label: "Radar range scale", control: "FCR range OSB" },
  { key: "pageup", label: "Antenna elevation up", control: "ANT ELEV knob" },
  { key: "pagedown", label: "Antenna elevation down", control: "ANT ELEV knob" },
  { key: "\\", label: "Scan width ±60 / ±30 / ±10°", control: "FCR azimuth OSB" },
  { key: "end", label: "Scan bars 1 / 2 / 4", control: "FCR bar OSB" },
  { key: "home", label: "Radar transmit / standby", control: "FCR standby" },
  { key: "f", label: "Select missile (AIM-120 / AIM-9X)", control: "DOGFIGHT / missile step (placeholder)" },
  { key: "l", label: "Launch missile", control: "Weapon release (placeholder)" }
];

/**
 * Air-to-air loadouts. The missiles are NOTIONAL low-fidelity placeholders (invented gameplay
 * values) until the F-16 weapons are reworked; station layout: 1 (left tip) … 9 (right tip).
 */
export const F16_LOADOUTS: readonly LoadoutOption[] = [
  { id: "a2a-standard", label: "Air superiority", description: "2 × AIM-9X on the wingtips, 4 × AIM-120 on the wing stations.", stations: ["AIM-9X", "AIM-120", "AIM-120", "", "", "", "AIM-120", "AIM-120", "AIM-9X"] },
  { id: "a2a-bvr", label: "Beyond visual range", description: "6 × AIM-120: maximum long-range shots, no heat-seekers.", stations: ["AIM-120", "AIM-120", "AIM-120", "", "", "", "AIM-120", "AIM-120", "AIM-120"] },
  { id: "a2a-wvr", label: "Close-in fight", description: "4 × AIM-9X and 2 × AIM-120 for a turning fight.", stations: ["AIM-9X", "AIM-9X", "AIM-120", "", "", "", "AIM-120", "AIM-9X", "AIM-9X"] },
  { id: "clean", label: "Clean (training)", description: "No stores: flying and radar practice.", stations: ["", "", "", "", "", "", "", "", ""] }
];
const BY_NAME: Record<string, NotionalMissileSpec> = { "AIM-9X": NOTIONAL_AAM.AIM9X, "AIM-120": NOTIONAL_AAM.AIM120 };
const storesFor = (id: string): (NotionalMissileSpec | null)[] => (F16_LOADOUTS.find((l) => l.id === id) ?? F16_LOADOUTS[0]!).stations.map((n) => BY_NAME[n] ?? null);

export class F16FireControl implements AvionicsSuite {
  /** Radar warning receiver (passive; independent of the radar). */
  public readonly rwr = new RadarWarningReceiver(ALR56M_PROFILE);
  public readonly insetScreen = "rwr";
  private rwrSeen = new Set<number>();
  private rwrTime = 0;
  public readonly controls = F16_AVIONICS_CONTROLS;
  public readonly radar: PulseDopplerRadar;
  private mode: Mode = "CRM";
  private scale = 2;
  private az = 0;
  private bars = 2;
  private elevDeg = 0;
  private cursor = { x: 0, rNm: 20 };
  private transmit = true;
  private held = new Set<string>();
  private ctx: AvionicsContext | null = null;
  private tms = false;
  private loadoutId = F16_LOADOUTS[0]!.id;
  private stores: (NotionalMissileSpec | null)[] = storesFor(this.loadoutId);
  private selectedId: string = "aim120";
  private launch = false;
  private message: { text: string; t: number } | null = null;

  public constructor(seed = 16) { this.radar = new PulseDopplerRadar(APG68_PROFILE, seed); }

  public reset(): void {
    this.rwr.reset(); this.rwrSeen.clear(); this.radar.breakLock("reset"); this.mode = "CRM"; this.stores = storesFor(this.loadoutId); this.selectFirst(); }

  public setOption(key: string, value: string): void {
    if (key === "loadout" && F16_LOADOUTS.some((l) => l.id === value)) { this.loadoutId = value; this.stores = storesFor(value); this.selectFirst(); }
  }

  private selectFirst(): void { const first = this.stores.find((x) => x); if (first) this.selectedId = first.id; }
  public get weapon(): NotionalMissileSpec | null { return this.stores.find((x) => x?.id === this.selectedId) ?? null; }
  public get inventory(): Readonly<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const w of this.stores) if (w) out[w.display] = (out[w.display] ?? 0) + 1;
    return out;
  }

  private cycleWeapon(): void {
    const types = [...new Set(this.stores.filter((x): x is NotionalMissileSpec => !!x).map((x) => x.id))];
    if (types.length === 0) return;
    this.selectedId = types[(types.indexOf(this.selectedId) + 1) % types.length]!;
  }

  private fire(ctx: AvionicsContext): void {
    const w = this.weapon;
    const port = ctx.weapons;
    if (!w || !port?.launchNotional) { this.message = { text: "NO WPN", t: ctx.own.timeS }; return; }
    const lock = this.radar.lock(ctx.own);
    if (w.guidance === "radar" && !lock) { this.message = { text: "NO LOCK", t: ctx.own.timeS }; return; }
    const radar = this.radar;
    // Midcourse cue: the FCR track while the lock holds (one-way datalink), else nothing.
    const cue = () => { const c = this.ctx; const l = c ? radar.lock(c.own) : null; return l ? { positionEnuM: l.positionEnuM, velocityEnuMps: l.velocityEnuMps } : null; };
    const at = lock ? { positionEnuM: lock.positionEnuM, velocityEnuMps: lock.velocityEnuMps } : null;
    let first = true;
    port.launchNotional(w, [ctx.own.positionEnuM[0], ctx.own.positionEnuM[1], ctx.own.positionEnuM[2] - 1.5], ctx.own.velocityEnuMps, () => { if (first) { first = false; return at; } return cue(); });
    this.stores[this.stores.findIndex((x) => x?.id === w.id)] = null;
    this.message = { text: `${w.display} AWAY`, t: ctx.own.timeS };
    if (!this.weapon) this.cycleWeapon();
  }

  public key(k: string, down: boolean): boolean {
    if (!this.controls.some((c) => c.key === k)) return false;
    if (!down) { this.held.delete(k); return true; }
    if (this.held.has(k)) return true;
    this.held.add(k);
    switch (k) {
      case "-": this.mode = this.mode === "CRM" ? "ACM" : "CRM"; this.radar.breakLock("mode"); break;
      case "enter": this.tms = true; break;
      case "backspace": this.radar.breakLock("pilot"); break;
      case "pagedown": this.elevDeg = Math.max(-60, this.elevDeg - 2); break;
      case "pageup": this.elevDeg = Math.min(60, this.elevDeg + 2); break;
      case "\\": this.az = (this.az + 1) % AZ.length; break;
      case "end": this.bars = (this.bars + 1) % BARS.length; break;
      case "home": this.transmit = !this.transmit; break;
      case "=": this.scale = (this.scale + 1) % SCALES.length; break;
      case "f": this.cycleWeapon(); break;
      case "l": this.launch = true; break;
    }
    return true;
  }

  private pattern(): RasterPattern {
    if (this.mode === "ACM") return { frame: "body", center: { az: 0, el: 25 * DEG }, widthRad: 60 * DEG, bars: 2, barSpacingRad: 3 * DEG, orientation: "vertical" };
    const bars = BARS[this.bars] as number;
    return { frame: "stabilized", center: { az: 0, el: this.elevDeg * DEG }, widthRad: 2 * (AZ[this.az] as number) * DEG, bars, barSpacingRad: 2.2 * DEG, orientation: "horizontal" };
  }

  public step(ctx: AvionicsContext, dt: number): void {
    this.rwrTime = ctx.own.timeS;
    // Power: any live bus (the exact RWR bus assignment is not sourced).
    this.rwr.setPower(!ctx.snapshot.electrical || ctx.snapshot.electrical.buses.some((b) => b.powered));
    this.rwr.step({ timeS: ctx.own.timeS, positionEnuM: ctx.own.positionEnuM, bodyToWorld: ctx.own.bodyToWorld, headingRad: ctx.own.headingRad }, ctx.scene, dt);
    this.ctx = ctx;
    const sc = SCALES[this.scale] as number;
    if (this.held.has("arrowup")) this.cursor.rNm = Math.min(sc, this.cursor.rNm + sc * 0.3 * dt);
    if (this.held.has("arrowdown")) this.cursor.rNm = Math.max(0, this.cursor.rNm - sc * 0.3 * dt);
    if (this.held.has("arrowright")) this.cursor.x = Math.min(1, this.cursor.x + 0.5 * dt);
    if (this.held.has("arrowleft")) this.cursor.x = Math.max(-1, this.cursor.x - 0.5 * dt);
    const bus = ctx.snapshot.electrical?.buses.find((b) => b.id === "ac.nonessential");
    this.radar.setPower(!ctx.snapshot.electrical || !!bus?.powered);
    this.radar.setRadiate(this.transmit);
    this.radar.setSearch({ pattern: this.pattern(), waveformIds: ["MPRF", "MPRF", "HPRF"], tws: false, plotPersistenceS: 6, rangeScaleM: sc * NM, ...(this.mode === "ACM" ? { autoAcquire: { minRangeM: 300, maxRangeM: 10 * NM } } : {}) });
    if (this.tms && this.mode === "CRM") {
      const azDeg = this.cursor.x * 60;
      const plot = this.radar.recentPlots.filter((p) => !p.falseAlarm && Math.abs(p.look.az / DEG - azDeg) < 5 && Math.abs(p.rangeM / NM - this.cursor.rNm) < sc * 0.06).sort((a, b) => b.timeS - a.timeS)[0];
      if (plot) this.radar.designate({ look: plot.look, frame: "stabilized", rangeM: plot.rangeM, rangeWindowM: 2 * NM });
    }
    this.tms = false;
    this.radar.step(ctx.own, ctx.scene, dt);
    if (this.launch) { this.launch = false; this.fire(ctx); }
  }

  private bscope(): DisplayPrimitive[] {
    const out: DisplayPrimitive[] = [];
    const ctx = this.ctx;
    if (!ctx) return out;
    const sc = SCALES[this.scale] as number;
    const X = (azRad: number) => (azRad / (60 * DEG)) * 0.85, Y = (m: number) => -0.85 + 1.7 * Math.min(1, m / (sc * NM));
    out.push({ kind: "line", frame: "screen", points: [[-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85]], closed: true });
    for (const p of this.radar.recentPlots) out.push({ kind: "line", frame: "screen", points: [[X(p.look.az) - 0.025, Y(p.rangeM) - 0.02], [X(p.look.az) + 0.025, Y(p.rangeM) - 0.02], [X(p.look.az) + 0.025, Y(p.rangeM) + 0.02], [X(p.look.az) - 0.025, Y(p.rangeM) + 0.02]], closed: true, width: 2 });
    const lock = this.radar.lock(ctx.own);
    if (lock) {
      out.push({ kind: "circle", frame: "screen", at: [X(lock.look.az), Y(lock.rangeM)], radius: 0.04, fill: true });
      out.push({ kind: "text", frame: "screen", at: [0.8, 0.92], text: `${(lock.rangeM / NM).toFixed(1)}NM ${Math.round(lock.closureMps * 1.944)}VC`, align: "right", size: 0.07 });
    } else {
      const cx = this.cursor.x * 0.85, cy = Y(this.cursor.rNm * NM);
      out.push({ kind: "line", frame: "screen", points: [[cx - 0.05, cy - 0.05], [cx + 0.05, cy - 0.05], [cx + 0.05, cy + 0.05], [cx - 0.05, cy + 0.05]], closed: true });
    }
    out.push({ kind: "line", frame: "screen", points: [[X(this.radar.beam.look.az), -0.92], [X(this.radar.beam.look.az), -0.87]] });
    out.push({ kind: "text", frame: "screen", at: [-0.85, 0.92], text: `${this.mode} ${this.mode === "CRM" ? `A${AZ[this.az]} ${BARS[this.bars]}B` : ""} ${sc}`, size: 0.07 });
    out.push({ kind: "text", frame: "screen", at: [-0.85, -0.95], text: this.radar.state.toUpperCase(), size: 0.06 });
    return out;
  }

  public hud(): DisplayList {
    const ctx = this.ctx;
    const lock = ctx ? this.radar.lock(ctx.own) : null;
    const w = this.weapon;
    const n = w ? this.stores.filter((x) => x?.id === w.id).length : 0;
    const out: DisplayPrimitive[] = [{ kind: "text", frame: "screen", at: [0.9, -0.95], text: w ? `${n} ${w.display}` : "NO WPN", align: "right", size: 0.06 }];
    if (this.message && ctx && ctx.own.timeS - this.message.t < 3) out.push({ kind: "text", frame: "screen", at: [0, -0.62], text: this.message.text, align: "center", size: 0.07 });
    if (lock && w) {
      const inRange = lock.rangeM < w.maxLaunchRangeM && lock.rangeM > w.minLaunchRangeM && Math.hypot(lock.lookBody.az, lock.lookBody.el) < w.maxOffBoresightRad;
      if (inRange) out.push({ kind: "text", frame: "screen", at: [0, -0.72], text: "SHOOT", align: "center", size: 0.09 });
    }
    return [...out, ...this.hudLock(lock)];
  }

  private hudLock(lock: ReturnType<PulseDopplerRadar["lock"]>): DisplayList {
    if (!lock) return this.mode === "ACM" ? [{ kind: "line", frame: "angle", points: [[-1.5 * DEG, -5 * DEG], [-1.5 * DEG, 55 * DEG]] }, { kind: "line", frame: "angle", points: [[1.5 * DEG, -5 * DEG], [1.5 * DEG, 55 * DEG]] }] : [];
    const { az, el } = lock.lookBody, d = 1.2 * DEG;
    return [{ kind: "line", frame: "angle", points: [[az - d, el - d], [az + d, el - d], [az + d, el + d], [az - d, el + d]], closed: true }];
  }

  public audioCues(): AudioCues {
    const cs = this.rwr.contacts();
    let fresh = 0;
    for (const c of cs) if (!this.rwrSeen.has(c.id)) { this.rwrSeen.add(c.id); fresh++; }
    return { newContacts: fresh, steadyIllumination: cs.some((c) => c.steadyIllumination), missile: cs.some((c) => c.match?.entry.category === "missile-seeker") };
  }

  public screen(id: string): DisplayList | undefined {
    if (id === "rwr") return alr56mDisplay(this.rwr.contacts(), this.rwr.isPowered, Math.floor(this.rwrTime * 4) % 2 === 0);
    return id === "mfd-left" ? this.bscope() : undefined; }

  public status(): Readonly<Record<string, string | number>> { return { mode: this.mode, radar: this.radar.state, plots: this.radar.recentPlots.length }; }
}
