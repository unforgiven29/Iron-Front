/**
 * Mixed-flow afterburning turbofan PLANT: quasi-steady 0-D gas-path cycle plus rotor dynamics.
 *
 * Owner: physics/propulsion. Platform-neutral: an aircraft package supplies the engine's
 * cycle parameters (and their provenance) and calibrates unknown design temperatures against
 * published thrust ratings.
 *
 * Control is NOT in this file. The engine control (Fadec.ts) turns the throttle into a speed and
 * afterburner demand and owns every limit; this plant only follows the demand with rotor
 * inertia and computes the thermodynamics:  throttle → Fadec → demand → MixedFlowTurbofan → thrust.
 *
 * Gas path: freestream → INLET component (components/Inlet.ts) → fan → core compressor → burner →
 * HP/LP turbine (powers fan + compressor) → bypass/core mixer → afterburner → NOZZLE component
 * (components/Nozzle.ts: throat, exit expansion, momentum + pressure thrust). Thrust = gross − ram drag.
 * Inlet and nozzle are swappable components because engines/airframes differ there.
 *
 * Fidelity tier: "generic-map cycle". Component maps are not engine-specific. Corrected flow and
 * pressure ratios scale with corrected spool speed through simple generic laws, and the turbine
 * inlet temperature schedules with corrected speed. Altitude and Mach trends, ram drag, fuel flow
 * and the afterburner fuel penalty come out of the thermodynamics. Absolute accuracy away from
 * the calibration point is limited by those generic maps and is not validated against F110 data.
 * Not modelled: compressor stall/surge itself, compressor variable geometry, bleed/power
 * extraction, the effect of nozzle back-pressure on the fan operating line (the engine control
 * instead keeps the throat large enough, and slows the engine when it cannot), inlet distortion, relight.
 */

import type { InletModel } from "./components/Inlet.js";
import type { NozzleModel, NozzleResult, ThroatCommand } from "./components/Nozzle.js";

export { milE5008bRecovery as inletRecovery, normalShockRecovery } from "./components/Inlet.js";

export interface TurbofanDesign {
  /** Sea-level-static design (100 % corrected speed) total airflow, kg/s. */
  readonly airflowKgS: number;
  readonly bypassRatio: number;
  readonly overallPressureRatio: number;
  readonly fanPressureRatio: number;
  readonly fanEfficiency: number;
  readonly compressorEfficiency: number;
  readonly turbineEfficiency: number;
  readonly burnerEfficiency: number;
  readonly afterburnerEfficiency: number;
  /** Design turbine inlet temperature at 100 % corrected speed, K (usually calibrated). */
  readonly turbineInletTemperatureK: number;
  /** Maximum afterburner exit temperature, K (usually calibrated). */
  readonly afterburnerMaxTemperatureK: number;
  /** Rotor response time constant to a speed demand, s (spool inertia; the FADEC rate-limits the demand). */
  readonly rotorTimeConstantS: number;
  /** Inlet component (total-pressure recovery). */
  readonly inlet: InletModel;
  /** Exhaust nozzle component (throat, expansion, gross thrust). */
  readonly nozzle: NozzleModel;
  /** Fraction of net thrust lost to installation (bleed, power extraction, spillage, nozzle). Default 0. */
  readonly installationLossFraction?: number;
  /**
   * Reynolds-number effect: component efficiencies fall by this fraction × (1 − RNI) when the
   * Reynolds number index RNI = δ2/(θ2^0.5·μ-ratio) drops below 1 (approximated as δ2/θ2^1.25).
   * Default 0 (off).
   */
  readonly reynoldsEfficiencyLoss?: number;
}

export interface Ambient {
  readonly temperatureK: number;
  readonly pressurePa: number;
  readonly mach: number;
}

export interface CycleResult {
  readonly netThrustN: number;
  readonly grossThrustN: number;
  readonly ramDragN: number;
  readonly airflowKgS: number;
  readonly fuelFlowKgS: number;
  readonly turbineInletTemperatureK: number;
  readonly nozzleTemperatureK: number;
  readonly compressorExitPressurePa: number;
  readonly correctedSpeed: number;
  readonly compressorExitTemperatureK: number;
  /** Nozzle operating state (throat, exit, pressure thrust, area demand). */
  readonly nozzle: NozzleResult;
  /** True when the nozzle throat was too small and the turbine ran hotter to push the flow through. */
  readonly backPressureLimited?: boolean;
}

export interface CycleOptions {
  /** Nozzle throat command (default: follow the flow). */
  readonly throat?: ThroatCommand;
  /** Overrides of the design temperatures (used by calibration). */
  readonly turbineInletTemperatureK?: number;
  readonly afterburnerMaxTemperatureK?: number;
}

const CP_COLD = 1004.5, G_COLD = 1.4;
const CP_HOT = 1150, G_HOT = 1.33;
const R = 287.05;
const LHV = 43.0e6; // J/kg, kerosene-type fuel (standard value)
const T_STD = 288.15, P_STD = 101325;

/**
 * Steady cycle at a corrected spool speed and afterburner fraction. Pure function; no limits
 * (those belong to the engine control). `tit` and `tab` override the design temperatures (used
 * by calibration).
 */
export function solveCycle(d: TurbofanDesign, amb: Ambient, correctedSpeed: number, abFraction: number, opts: CycleOptions = {}): CycleResult {
  const tit = opts.turbineInletTemperatureK ?? d.turbineInletTemperatureK;
  const tab = opts.afterburnerMaxTemperatureK ?? d.afterburnerMaxTemperatureK;
  const M = Math.max(0, amb.mach);
  const T0 = amb.temperatureK, p0 = amb.pressurePa;
  const V0 = M * Math.sqrt(G_COLD * R * T0);
  const Tt0 = T0 * (1 + 0.2 * M * M);
  const pt0 = p0 * (1 + 0.2 * M * M) ** 3.5;
  const Tt2 = Tt0, pt2 = pt0 * d.inlet.recovery(M);
  const theta = Tt2 / T_STD, delta = pt2 / P_STD;
  const Nc = Math.max(0.2, Math.min(1.05, correctedSpeed));
  // Reynolds-number index (approximation δ/θ^1.25) and the resulting efficiency loss.
  const rni = delta / theta ** 1.25;
  const reLoss = 1 - (d.reynoldsEfficiencyLoss ?? 0) * Math.max(0, 1 - rni);
  const etaFan = d.fanEfficiency * reLoss, etaComp = d.compressorEfficiency * reLoss, etaTurb = d.turbineEfficiency * reLoss;

  // Generic map laws: corrected flow ∝ Nc, pressure rise ∝ Nc² (each relative to design).
  const W2 = d.airflowKgS * Nc * delta / Math.sqrt(theta);
  const fpr = 1 + (d.fanPressureRatio - 1) * Nc * Nc;
  const opr = 1 + (d.overallPressureRatio - 1) * Nc * Nc;
  const k = (G_COLD - 1) / G_COLD;
  const Tt13 = Tt2 * (1 + (fpr ** k - 1) / etaFan);
  const pt13 = pt2 * fpr;
  const cpr = opr / fpr; // core compressor after the fan
  const Tt3 = Tt13 * (1 + (cpr ** k - 1) / etaComp);
  const pt3 = pt13 * cpr;

  const wCore = W2 / (1 + d.bypassRatio), wBypass = W2 - wCore;
  const pt4 = pt3 * 0.95; // combustor pressure loss 5 % (typical)
  const work = W2 * CP_COLD * (Tt13 - Tt2) + wCore * CP_COLD * (Tt3 - Tt13); // turbines drive fan + core compressor
  const kh = (G_HOT - 1) / G_HOT;
  const ab = Math.max(0, Math.min(1, abFraction));
  const g9 = ab > 0 ? 1.3 : 1.35;
  const install = 1 - (d.installationLossFraction ?? 0);
  const throat = opts.throat ?? { kind: "auto" as const };

  /** Burner → turbine → mixer → afterburner → nozzle for a turbine inlet temperature. */
  const hot = (Tt4: number): CycleResult => {
    const f = (CP_HOT * Tt4 - CP_COLD * Tt3) / (d.burnerEfficiency * LHV - CP_HOT * Tt4);
    const wHot = wCore * (1 + f);
    const Tt5 = Tt4 - work / (wHot * CP_HOT);
    const Tt5s = Tt4 - (Tt4 - Tt5) / etaTurb;
    const pt5 = pt4 * Math.max(1e-3, Tt5s / Tt4) ** (1 / kh);
    // Mixer: energy balance; mixed pressure by mass-weighted average (approximation).
    const w6 = wHot + wBypass;
    const cp6 = (wHot * CP_HOT + wBypass * CP_COLD) / w6;
    const Tt6 = (wHot * CP_HOT * Tt5 + wBypass * CP_COLD * Tt13) / (w6 * cp6);
    const pt6 = (wHot * pt5 + wBypass * pt13) / w6 * 0.98;
    // Afterburner.
    const Tt7 = ab > 0 ? Tt6 + (Math.max(tab, Tt6) - Tt6) * ab : Tt6;
    const fAb = ab > 0 ? (w6 * cp6 * (Tt7 - Tt6)) / (d.afterburnerEfficiency * LHV) : 0;
    const pt7 = pt6 * (ab > 0 ? 0.95 : 0.98);
    const nozzle = d.nozzle.evaluate({ massFlowKgS: w6 + fAb, totalPressurePa: pt7, totalTemperatureK: Tt7, gamma: g9, cpJkgK: cp6, ambientPressurePa: p0 }, throat);
    const gross = nozzle.grossThrustN * install, ram = W2 * V0;
    return {
      netThrustN: gross - ram, grossThrustN: gross, ramDragN: ram, airflowKgS: W2,
      fuelFlowKgS: wCore * f + fAb, turbineInletTemperatureK: Tt4, nozzleTemperatureK: Tt7,
      compressorExitPressurePa: pt3, correctedSpeed: Nc, compressorExitTemperatureK: Tt3, nozzle
    };
  };

  // Turbine inlet temperature schedules with corrected speed (generic), referenced to inlet temperature.
  const tt4Nominal = Math.max(Tt3 + 50, tit * theta * Nc * Nc);
  const nominal = hot(tt4Nominal);
  if (nominal.nozzle.throatAreaRatio <= 1) return nominal;
  // Nozzle back-pressure matching: a throat too small for the flow raises the pressure behind the
  // turbine, so the turbine expands less and must run hotter to keep driving the fan and
  // compressor at this speed. Find the turbine inlet temperature at which the flow passes.
  let lo = tt4Nominal, hi = tt4Nominal + 2000;
  if (hot(hi).nozzle.throatAreaRatio > 1) return { ...hot(hi), backPressureLimited: true };
  for (let i = 0; i < 24; i++) { // 2000 K / 2^24: far below a millikelvin
    const mid = (lo + hi) / 2;
    if (hot(mid).nozzle.throatAreaRatio > 1) lo = mid; else hi = mid;
  }
  return { ...hot(hi), backPressureLimited: true };
}

/** Solve the design TIT and maximum AB temperature so sea-level-static thrust matches the given ratings. */
export function calibrate(d: TurbofanDesign, militaryThrustN: number, maxAfterburnerThrustN: number): { turbineInletTemperatureK: number; afterburnerMaxTemperatureK: number } {
  const sls: Ambient = { temperatureK: T_STD, pressurePa: P_STD, mach: 0 };
  const bisect = (fn: (x: number) => number, lo: number, hi: number) => {
    if (fn(lo) * fn(hi) > 0) throw new RangeError("Engine calibration target is not reachable with this cycle.");
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (fn(lo) * fn(mid) <= 0) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  };
  const tit = bisect((t) => solveCycle(d, sls, 1, 0, { turbineInletTemperatureK: t }).netThrustN - militaryThrustN, 1000, 2400);
  const tab = bisect((t) => solveCycle(d, sls, 1, 1, { turbineInletTemperatureK: tit, afterburnerMaxTemperatureK: t }).netThrustN - maxAfterburnerThrustN, 1200, 2600);
  return { turbineInletTemperatureK: tit, afterburnerMaxTemperatureK: tab };
}

export interface TurbofanState extends CycleResult {
  /** Physical spool speed as a fraction of design. */
  readonly spoolSpeed: number;
  readonly afterburnerFraction: number;
  readonly afterburnerLit: boolean;
  readonly flameout: boolean;
}

export interface EngineDemand {
  /** Physical spool speed demand, fraction of design. */
  readonly speed: number;
  /** Afterburner demand, 0..1. */
  readonly afterburner: number;
  /** Nozzle throat command (default: follow the flow). */
  readonly throat?: ThroatCommand;
}

/** Rotor dynamics and gas path following an engine-control demand; fuel-starvation flameout. */
export class MixedFlowTurbofan {
  private spool: number;
  private ab = 0;
  private last: TurbofanState;

  public constructor(private readonly design: TurbofanDesign, initialSpeed: number) {
    this.spool = initialSpeed;
    this.last = { ...solveCycle(design, { temperatureK: T_STD, pressurePa: P_STD, mach: 0 }, initialSpeed, 0), spoolSpeed: initialSpeed, afterburnerFraction: 0, afterburnerLit: false, flameout: false };
  }

  public get state(): TurbofanState {
    return this.last;
  }

  public step(demand: EngineDemand, ambient: Ambient, fuelAvailable: boolean, dt: number): TurbofanState {
    const d = this.design;
    if (!fuelAvailable) {
      // Windmilling run-down (no relight model).
      this.spool = Math.max(0, this.spool - this.spool * (dt / (4 * d.rotorTimeConstantS)));
      this.ab = 0;
      this.last = { ...solveCycle(d, ambient, 0.2, 0), netThrustN: 0, grossThrustN: 0, fuelFlowKgS: 0, spoolSpeed: this.spool, afterburnerFraction: 0, afterburnerLit: false, flameout: true };
      return this.last;
    }
    this.spool += (demand.speed - this.spool) * (1 - Math.exp(-dt / d.rotorTimeConstantS));
    this.ab = Math.max(0, Math.min(1, demand.afterburner));
    const theta = (ambient.temperatureK * (1 + 0.2 * ambient.mach * ambient.mach)) / T_STD;
    const cycle = solveCycle(d, ambient, this.spool / Math.sqrt(theta), this.ab, { throat: demand.throat ?? { kind: "auto" } });
    this.last = { ...cycle, netThrustN: Math.max(0, cycle.netThrustN), spoolSpeed: this.spool, afterburnerFraction: this.ab, afterburnerLit: this.ab > 0, flameout: false };
    return this.last;
  }
}
