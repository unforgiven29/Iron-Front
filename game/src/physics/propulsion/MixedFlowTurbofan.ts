/**
 * Mixed-flow afterburning turbofan: quasi-steady 0-D gas-path cycle with spool dynamics.
 *
 * Owner: physics/propulsion. Platform-neutral: an aircraft package supplies the engine's
 * cycle parameters (and their provenance) and calibrates unknown design temperatures against
 * published thrust ratings.
 *
 * Gas path: freestream → inlet (MIL-E-5008B ram recovery) → fan → core compressor → burner →
 * HP/LP turbine (powers fan + compressor) → bypass/core mixer → afterburner → nozzle (ideally
 * expanded, with a velocity coefficient). Thrust = gross − ram drag.
 *
 * Fidelity tier: "generic-map cycle". Component maps are not engine-specific. Corrected flow and
 * pressure ratios scale with corrected spool speed through simple generic laws, and the turbine
 * inlet temperature schedules with corrected speed. Altitude and Mach trends, ram drag, fuel flow
 * and the afterburner fuel penalty come out of the thermodynamics. Absolute accuracy away from
 * the calibration point is limited by those generic maps and is not validated against F110 data.
 * Not modelled: compressor stall/surge margin, variable geometry, bleed/power extraction, nozzle
 * area scheduling and pressure thrust, inlet distortion, relight.
 */

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
  readonly nozzleVelocityCoefficient: number;
  /** Design turbine inlet temperature at 100 % corrected speed, K (usually calibrated). */
  readonly turbineInletTemperatureK: number;
  /** Maximum afterburner exit temperature, K (usually calibrated). */
  readonly afterburnerMaxTemperatureK: number;
  /** Corrected spool speed at idle (fraction of design). */
  readonly idleCorrectedSpeed: number;
  /** Spool acceleration / deceleration time constants, s. */
  readonly spoolUpTimeConstantS: number;
  readonly spoolDownTimeConstantS: number;
  /** Delay before afterburner thrust starts after selection, s. */
  readonly afterburnerLightDelayS: number;
  /** Afterburner fraction rate, 1/s. */
  readonly afterburnerRatePerS: number;
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
}

const CP_COLD = 1004.5, G_COLD = 1.4;
const CP_HOT = 1150, G_HOT = 1.33;
const R = 287.05;
const LHV = 43.0e6; // J/kg, kerosene-type fuel (standard value)
const T_STD = 288.15, P_STD = 101325;

/** MIL-E-5008B inlet total-pressure recovery. */
export function inletRecovery(mach: number): number {
  return mach <= 1 ? 1 : 1 - 0.075 * (mach - 1) ** 1.35;
}

/**
 * Steady cycle at a corrected spool speed and afterburner fraction. Pure function.
 * `tit` and `tab` override the design temperatures (used by calibration).
 */
export function solveCycle(d: TurbofanDesign, amb: Ambient, correctedSpeed: number, abFraction: number, tit = d.turbineInletTemperatureK, tab = d.afterburnerMaxTemperatureK): CycleResult {
  const M = Math.max(0, amb.mach);
  const T0 = amb.temperatureK, p0 = amb.pressurePa;
  const V0 = M * Math.sqrt(G_COLD * R * T0);
  const Tt0 = T0 * (1 + 0.2 * M * M);
  const pt0 = p0 * (1 + 0.2 * M * M) ** 3.5;
  const Tt2 = Tt0, pt2 = pt0 * inletRecovery(M);
  const theta = Tt2 / T_STD, delta = pt2 / P_STD;
  const Nc = Math.max(0.2, Math.min(1.05, correctedSpeed));

  // Generic map laws: corrected flow ∝ Nc, pressure rise ∝ Nc² (each relative to design).
  const W2 = d.airflowKgS * Nc * delta / Math.sqrt(theta);
  const fpr = 1 + (d.fanPressureRatio - 1) * Nc * Nc;
  const opr = 1 + (d.overallPressureRatio - 1) * Nc * Nc;
  const k = (G_COLD - 1) / G_COLD;
  const Tt13 = Tt2 * (1 + (fpr ** k - 1) / d.fanEfficiency);
  const pt13 = pt2 * fpr;
  const cpr = opr / fpr; // core compressor after the fan
  const Tt3 = Tt13 * (1 + (cpr ** k - 1) / d.compressorEfficiency);
  const pt3 = pt13 * cpr;

  const wCore = W2 / (1 + d.bypassRatio), wBypass = W2 - wCore;
  // Turbine inlet temperature schedules with corrected speed (generic), referenced to inlet temperature.
  const Tt4 = Math.max(Tt3 + 50, tit * theta * Nc * Nc);
  const f = (CP_HOT * Tt4 - CP_COLD * Tt3) / (d.burnerEfficiency * LHV - CP_HOT * Tt4);
  const pt4 = pt3 * 0.95; // combustor pressure loss 5 % (typical)
  const wHot = wCore * (1 + f);

  // Turbines drive the fan (all flow) and the core compressor.
  const work = W2 * CP_COLD * (Tt13 - Tt2) + wCore * CP_COLD * (Tt3 - Tt13);
  const Tt5 = Tt4 - work / (wHot * CP_HOT);
  const kh = (G_HOT - 1) / G_HOT;
  const Tt5s = Tt4 - (Tt4 - Tt5) / d.turbineEfficiency;
  const pt5 = pt4 * Math.max(1e-3, Tt5s / Tt4) ** (1 / kh);

  // Mixer: energy balance; mixed pressure by mass-weighted average (approximation).
  const w6 = wHot + wBypass;
  const cp6 = (wHot * CP_HOT + wBypass * CP_COLD) / w6;
  const Tt6 = (wHot * CP_HOT * Tt5 + wBypass * CP_COLD * Tt13) / (w6 * cp6);
  const pt6 = (wHot * pt5 + wBypass * pt13) / w6 * 0.98;

  // Afterburner.
  const ab = Math.max(0, Math.min(1, abFraction));
  const Tt7 = ab > 0 ? Tt6 + (Math.max(tab, Tt6) - Tt6) * ab : Tt6;
  const fAb = ab > 0 ? (w6 * cp6 * (Tt7 - Tt6)) / (d.afterburnerEfficiency * LHV) : 0;
  const pt7 = pt6 * (ab > 0 ? 0.95 : 0.98);
  const w9 = w6 + fAb;

  // Nozzle, ideally expanded to ambient.
  const g9 = ab > 0 ? 1.3 : 1.35;
  const pr = Math.max(1, pt7 / p0);
  const V9 = d.nozzleVelocityCoefficient * Math.sqrt(2 * cp6 * Tt7 * (1 - pr ** (-(g9 - 1) / g9)));
  const gross = w9 * V9, ram = W2 * V0;
  return {
    netThrustN: gross - ram,
    grossThrustN: gross,
    ramDragN: ram,
    airflowKgS: W2,
    fuelFlowKgS: wCore * f + fAb,
    turbineInletTemperatureK: Tt4,
    nozzleTemperatureK: Tt7,
    compressorExitPressurePa: pt3,
    correctedSpeed: Nc
  };
}

/** Solve the design TIT and maximum AB temperature so sea-level-static thrust matches the given ratings. */
export function calibrate(d: TurbofanDesign, militaryThrustN: number, maxAfterburnerThrustN: number): { turbineInletTemperatureK: number; afterburnerMaxTemperatureK: number } {
  const sls: Ambient = { temperatureK: T_STD, pressurePa: P_STD, mach: 0 };
  const bisect = (fn: (x: number) => number, lo: number, hi: number) => {
    if (fn(lo) * fn(hi) > 0) throw new RangeError("Engine calibration target is not reachable with this cycle.");
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (fn(lo) * fn(mid) <= 0) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  };
  const tit = bisect((t) => solveCycle(d, sls, 1, 0, t).netThrustN - militaryThrustN, 1000, 2400);
  const tab = bisect((t) => solveCycle(d, sls, 1, 1, tit, t).netThrustN - maxAfterburnerThrustN, 1200, 2600);
  return { turbineInletTemperatureK: tit, afterburnerMaxTemperatureK: tab };
}

export interface TurbofanState extends CycleResult {
  /** Physical spool speed as a fraction of design. */
  readonly spoolSpeed: number;
  readonly afterburnerFraction: number;
  readonly afterburnerLit: boolean;
  readonly flameout: boolean;
}

/** Throttle 0..1 with an afterburner detent; spool and afterburner dynamics; fuel-starvation flameout. */
export class MixedFlowTurbofan {
  private spool: number;
  private ab = 0;
  private abTimer = 0;
  private last: TurbofanState;

  public constructor(private readonly design: TurbofanDesign, private readonly afterburnerDetent: number, initialThrottle = 0.5) {
    this.spool = this.targetSpeed(initialThrottle);
    this.last = { ...solveCycle(design, { temperatureK: T_STD, pressurePa: P_STD, mach: 0 }, this.spool, 0), spoolSpeed: this.spool, afterburnerFraction: 0, afterburnerLit: false, flameout: false };
  }

  public get state(): TurbofanState {
    return this.last;
  }

  /** Corrected-speed target for a throttle position (dry range: idle → 100 %). */
  public targetSpeed(throttle: number): number {
    const t = Math.max(0, Math.min(1, throttle));
    const dry = Math.min(1, t / this.afterburnerDetent);
    return this.design.idleCorrectedSpeed + (1 - this.design.idleCorrectedSpeed) * dry;
  }

  public reset(throttle: number): void {
    this.spool = this.targetSpeed(throttle);
    this.ab = 0;
    this.abTimer = 0;
  }

  public step(throttle: number, ambient: Ambient, fuelAvailable: boolean, dt: number): TurbofanState {
    const d = this.design;
    if (!fuelAvailable) {
      this.spool = Math.max(0, this.spool - this.spool * (dt / d.spoolDownTimeConstantS));
      this.ab = 0;
      this.last = { ...solveCycle(d, ambient, 0.2, 0), netThrustN: 0, grossThrustN: 0, fuelFlowKgS: 0, spoolSpeed: this.spool, afterburnerFraction: 0, afterburnerLit: false, flameout: true };
      return this.last;
    }
    const target = this.targetSpeed(throttle);
    const tau = target > this.spool ? d.spoolUpTimeConstantS : d.spoolDownTimeConstantS;
    this.spool += (target - this.spool) * (1 - Math.exp(-dt / tau));

    const abRequest = throttle > this.afterburnerDetent ? (throttle - this.afterburnerDetent) / (1 - this.afterburnerDetent) : 0;
    const abAllowed = this.spool > 0.97;
    if (abRequest > 0 && abAllowed) this.abTimer += dt; else this.abTimer = 0;
    const abTarget = this.abTimer >= d.afterburnerLightDelayS ? abRequest : 0;
    const step = d.afterburnerRatePerS * dt;
    this.ab = abTarget > this.ab ? Math.min(abTarget, this.ab + step) : Math.max(abTarget, this.ab - step * 2);

    const theta = (ambient.temperatureK * (1 + 0.2 * ambient.mach * ambient.mach)) / T_STD;
    const corrected = this.spool / Math.sqrt(theta);
    const cycle = solveCycle(d, ambient, corrected, this.ab);
    this.last = { ...cycle, netThrustN: Math.max(0, cycle.netThrustN), spoolSpeed: this.spool, afterburnerFraction: this.ab, afterburnerLit: this.ab > 0, flameout: false };
    return this.last;
  }
}
