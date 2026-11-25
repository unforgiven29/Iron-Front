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
import type { AvionicsContext, AvionicsControl, AvionicsSuite } from "../../common/Avionics.js";

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
  stabilization: { value: { rollMaxRad: 180 * DEG, pitchMaxRad: 60 * DEG }, ...E("") },
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
  { key: "-", label: "FCR mode CRM / ACM", control: "FCR mode (OSB / DOGFIGHT switch)" },
  { key: "t", label: "TMS up: designate / lock", control: "Target management switch forward" },
  { key: "z", label: "TMS down: break lock", control: "Target management switch aft" },
  { key: "[", label: "Cursor down (hold)", control: "Cursor/enable switch" },
  { key: "]", label: "Cursor up (hold)", control: "Cursor/enable switch" },
  { key: ",", label: "Cursor left (hold)", control: "Cursor/enable switch" },
  { key: ".", label: "Cursor right (hold)", control: "Cursor/enable switch" },
  { key: ";", label: "Antenna elevation down", control: "ANT ELEV knob" },
  { key: "'", label: "Antenna elevation up", control: "ANT ELEV knob" },
  { key: "\\", label: "Azimuth scan ±60 / ±30 / ±10", control: "FCR azimuth OSB" },
  { key: "end", label: "Bars 1 / 2 / 4", control: "FCR bar OSB" },
  { key: "home", label: "Radar transmit / standby", control: "FCR OVRD (standby)" },
  { key: "pageup", label: "Range scale", control: "FCR range OSB" }
];

export class F16FireControl implements AvionicsSuite {
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

  public constructor(seed = 16) { this.radar = new PulseDopplerRadar(APG68_PROFILE, seed); }

  public reset(): void { this.radar.breakLock("reset"); this.mode = "CRM"; }

  public key(k: string, down: boolean): boolean {
    if (!this.controls.some((c) => c.key === k)) return false;
    if (!down) { this.held.delete(k); return true; }
    if (this.held.has(k)) return true;
    this.held.add(k);
    switch (k) {
      case "-": this.mode = this.mode === "CRM" ? "ACM" : "CRM"; this.radar.breakLock("mode"); break;
      case "t": this.tms = true; break;
      case "z": this.radar.breakLock("pilot"); break;
      case ";": this.elevDeg = Math.max(-60, this.elevDeg - 2); break;
      case "'": this.elevDeg = Math.min(60, this.elevDeg + 2); break;
      case "\\": this.az = (this.az + 1) % AZ.length; break;
      case "end": this.bars = (this.bars + 1) % BARS.length; break;
      case "home": this.transmit = !this.transmit; break;
      case "pageup": this.scale = (this.scale + 1) % SCALES.length; break;
    }
    return true;
  }

  private pattern(): RasterPattern {
    if (this.mode === "ACM") return { frame: "body", center: { az: 0, el: 25 * DEG }, widthRad: 60 * DEG, bars: 2, barSpacingRad: 3 * DEG, orientation: "vertical" };
    const bars = BARS[this.bars] as number;
    return { frame: "stabilized", center: { az: 0, el: this.elevDeg * DEG }, widthRad: 2 * (AZ[this.az] as number) * DEG, bars, barSpacingRad: 2.2 * DEG, orientation: "horizontal" };
  }

  public step(ctx: AvionicsContext, dt: number): void {
    this.ctx = ctx;
    const sc = SCALES[this.scale] as number;
    if (this.held.has("]")) this.cursor.rNm = Math.min(sc, this.cursor.rNm + sc * 0.3 * dt);
    if (this.held.has("[")) this.cursor.rNm = Math.max(0, this.cursor.rNm - sc * 0.3 * dt);
    if (this.held.has(".")) this.cursor.x = Math.min(1, this.cursor.x + 0.5 * dt);
    if (this.held.has(",")) this.cursor.x = Math.max(-1, this.cursor.x - 0.5 * dt);
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
      for (const dx of [-0.03, 0.03]) out.push({ kind: "line", frame: "screen", points: [[cx + dx, cy - 0.04], [cx + dx, cy + 0.04]] });
    }
    out.push({ kind: "line", frame: "screen", points: [[X(this.radar.beam.look.az), -0.92], [X(this.radar.beam.look.az), -0.87]] });
    out.push({ kind: "text", frame: "screen", at: [-0.85, 0.92], text: `${this.mode} ${this.mode === "CRM" ? `A${AZ[this.az]} ${BARS[this.bars]}B` : ""} ${sc}`, size: 0.07 });
    out.push({ kind: "text", frame: "screen", at: [-0.85, -0.95], text: this.radar.state.toUpperCase(), size: 0.06 });
    return out;
  }

  public hud(): DisplayList {
    const ctx = this.ctx;
    const lock = ctx ? this.radar.lock(ctx.own) : null;
    if (!lock) return this.mode === "ACM" ? [{ kind: "line", frame: "angle", points: [[-1.5 * DEG, -5 * DEG], [-1.5 * DEG, 55 * DEG]] }, { kind: "line", frame: "angle", points: [[1.5 * DEG, -5 * DEG], [1.5 * DEG, 55 * DEG]] }] : [];
    const { az, el } = lock.lookBody, d = 1.2 * DEG;
    return [{ kind: "line", frame: "angle", points: [[az - d, el - d], [az + d, el - d], [az + d, el + d], [az - d, el + d]], closed: true }];
  }

  public screen(id: string): DisplayList | undefined { return id === "mfd-left" ? this.bscope() : undefined; }

  public status(): Readonly<Record<string, string | number>> { return { mode: this.mode, radar: this.radar.state, plots: this.radar.recentPlots.length }; }
}
