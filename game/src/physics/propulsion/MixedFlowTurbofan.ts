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

import { lookup1D, type Table1D } from "../aerodynamics/Tables.js";
import type { InletCondition } from "./components/Inlet.js";
import { evaluateGasGenerator, type GasGeneratorDeck } from "./components/GasGeneratorDeck.js";
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
  /**
   * Optional data-driven gas generator. When present, the dry engine (fan → mixer) comes from
   * these corrected tables instead of the generic maps; the inlet, afterburner and nozzle are
   * still the physical components. Generic map parameters are then unused except the
   * afterburner temperature and efficiency.
   */
  readonly gasGenerator?: GasGeneratorDeck;
  /** Exhaust nozzle component (throat, expansion, gross thrust). */
  readonly nozzle: NozzleModel;
  /** Fraction of net thrust lost to installation (bleed, power extraction, spillage, nozzle). Default 0. */
  readonly installationLossFraction?: number;
  /**
   * Reynolds-number effect: component efficiencies fall by this fraction × (1 − RNI) when the
   * Reynolds number index RNI = δ2/(θ2^0.5·μ-ratio) drops below 1 (approximated as δ2/θ2^1.25).
   * Default 0 (off).
   */
  /**
   * Generic-map shape: corrected airflow ∝ (corrected speed)^k at low speed (≤ 0.65), blending to
   * linear (k = 1) at 0.9 and above (default k = 1). Real fans lose flow faster than linearly at part
   * speed; an engine package may fit k to published part-power data.
   */
  readonly flowSpeedExponent?: number;
  /** Optional transient, stability and health behaviour (two-spool lag, surge, oil/vibration/life, AB zones). */
  readonly dynamics?: EngineDynamicsSpec;
  readonly reynoldsEfficiencyLoss?: number;
}

export interface Ambient {
  readonly temperatureK: number;
  readonly pressurePa: number;
  readonly mach: number;
  /** Airframe condition some inlets schedule on (e.g. FOD-protection modes). Optional. */
  readonly inletCondition?: InletCondition;
}

/**
 * Engine station values (SAE ARP755 numbering): 2 engine face, 13 fan exit, 3 compressor exit,
 * 4 turbine inlet, 5 turbine exit, 6 mixer, 7 afterburner exit / nozzle entry. NaN where the model
 * does not compute a station (e.g. a data deck that does not publish it).
 */
export interface EngineStations {
  readonly Tt2K: number; readonly pt2Pa: number; readonly inletRecovery: number;
  readonly Tt13K: number; readonly pt13Pa: number;
  readonly Tt3K: number; readonly pt3Pa: number;
  readonly Tt4K: number;
  readonly Tt5K: number; readonly pt5Pa: number;
  readonly Tt6K: number;
  readonly Tt7K: number; readonly pt7Pa: number;
  /** Main-burner fuel–air ratio (core flow). */
  readonly fuelAirRatio: number;
  readonly bypassRatio: number;
  /** Core (hot) and bypass (cold) airflow, kg/s; NaN where not computed. */
  readonly coreFlowKgS: number;
  readonly bypassFlowKgS: number;
  /** Main combustor and afterburner fuel flow, kg/s. */
  readonly mainFuelKgS: number;
  readonly afterburnerFuelKgS: number;
  /** Total fuel / total airflow. */
  readonly totalFuelAirRatio: number;
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
  /** Data-driven engines: spool speeds, measured-type exhaust gas temperature and deck-range flag. */
  readonly n1Rpm?: number;
  readonly n2Rpm?: number;
  readonly exhaustGasTemperatureK?: number;
  readonly outsideDeck?: boolean;
  /** Station temperatures and pressures through the engine. */
  readonly stations?: EngineStations;
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
  const Tt2 = Tt0, pt2 = pt0 * d.inlet.recovery(M, amb.inletCondition);
  const theta = Tt2 / T_STD, delta = pt2 / P_STD;
  const Nc = Math.max(0.2, Math.min(1.05, correctedSpeed));
  if (d.gasGenerator) return deckCycle(d, d.gasGenerator, amb, V0, Tt2, pt2, Nc, abFraction, tab, opts);
  // Reynolds-number index (approximation δ/θ^1.25) and the resulting efficiency loss.
  const rni = delta / theta ** 1.25;
  const reLoss = 1 - (d.reynoldsEfficiencyLoss ?? 0) * Math.max(0, 1 - rni);
  const etaFan = d.fanEfficiency * reLoss, etaComp = d.compressorEfficiency * reLoss, etaTurb = d.turbineEfficiency * reLoss;

  // Generic map laws: corrected flow ∝ Nc, pressure rise ∝ Nc² (each relative to design).
  // Part-speed flow: linear near design speed, steepening to the package exponent at low speed.
  const kFlow = 1 + ((d.flowSpeedExponent ?? 1) - 1) * Math.min(1, Math.max(0, (0.9 - Nc) / 0.25));
  const W2 = d.airflowKgS * Nc ** kFlow * delta / Math.sqrt(theta);
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
      compressorExitPressurePa: pt3, correctedSpeed: Nc, compressorExitTemperatureK: Tt3, nozzle,
      // Exhaust gas temperature taken at the turbine exit (where e.g. the RD-33 measures it).
      exhaustGasTemperatureK: Tt5,
      stations: { Tt2K: Tt2, pt2Pa: pt2, inletRecovery: pt2 / pt0, Tt13K: Tt13, pt13Pa: pt13, Tt3K: Tt3, pt3Pa: pt3, Tt4K: Tt4, Tt5K: Tt5, pt5Pa: pt5, Tt6K: Tt6, Tt7K: Tt7, pt7Pa: pt7, fuelAirRatio: f, bypassRatio: d.bypassRatio,
        coreFlowKgS: wCore, bypassFlowKgS: wBypass, mainFuelKgS: wCore * f, afterburnerFuelKgS: fAb, totalFuelAirRatio: (wCore * f + fAb) / W2 }
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

/** Dry gas generator from corrected deck tables; afterburner, nozzle and ram drag from physics. */
function deckCycle(d: TurbofanDesign, deck: GasGeneratorDeck, amb: Ambient, V0: number, Tt2: number, pt2: number, n1c: number, abFraction: number, tab: number, opts: CycleOptions): CycleResult {
  const gg = evaluateGasGenerator(deck, Tt2, pt2, n1c);
  const ab = Math.max(0, Math.min(1, abFraction));
  const cp8 = 1105, g8 = 1.35; // mixed dry exhaust (TM-104326 GAM7 ≈ 1.35 at intermediate)
  const Tt7 = ab > 0 ? gg.nozzleTotalTemperatureK + (Math.max(tab, gg.nozzleTotalTemperatureK) - gg.nozzleTotalTemperatureK) * ab : gg.nozzleTotalTemperatureK;
  const fAb = ab > 0 ? (gg.nozzleFlowKgS * cp8 * (Tt7 - gg.nozzleTotalTemperatureK)) / (d.afterburnerEfficiency * LHV) : 0;
  const pt7 = gg.nozzleTotalPressurePa * (ab > 0 ? 0.95 : 1); // afterburner heat-addition (Rayleigh) loss when lit
  const nozzle = d.nozzle.evaluate({ massFlowKgS: gg.nozzleFlowKgS + fAb, totalPressurePa: pt7, totalTemperatureK: Tt7, gamma: ab > 0 ? 1.3 : g8, cpJkgK: cp8, ambientPressurePa: amb.pressurePa }, opts.throat ?? { kind: "auto" });
  const airflow = gg.nozzleFlowKgS - gg.fuelFlowKgS;
  const gross = nozzle.grossThrustN * (1 - (d.installationLossFraction ?? 0)), ram = airflow * V0;
  // Compressor-exit temperature is not in the deck: ESTIMATED from the deck pressure ratio with a
  // polytropic efficiency of 0.88 (typical for the class).
  const pr3 = gg.compressorDischargePressurePa / pt2;
  const Tt3 = Tt2 * pr3 ** ((G_COLD - 1) / G_COLD / 0.88);
  return {
    netThrustN: gross - ram, grossThrustN: gross, ramDragN: ram, airflowKgS: airflow,
    fuelFlowKgS: gg.fuelFlowKgS + fAb, turbineInletTemperatureK: Number.NaN, nozzleTemperatureK: Tt7,
    compressorExitPressurePa: gg.compressorDischargePressurePa, correctedSpeed: n1c, compressorExitTemperatureK: Tt3, nozzle,
    n1Rpm: gg.n1Rpm, n2Rpm: gg.n2Rpm, exhaustGasTemperatureK: gg.exhaustGasTemperatureK, outsideDeck: gg.outsideDeck,
    // The deck publishes face, fan/compressor discharge pressures, EGT and nozzle entry; not T4/T5/mixer.
    stations: { Tt2K: Tt2, pt2Pa: pt2, inletRecovery: Number.NaN, Tt13K: Number.NaN, pt13Pa: gg.fanDischargePressurePa, Tt3K: Tt3, pt3Pa: gg.compressorDischargePressurePa, Tt4K: Number.NaN, Tt5K: gg.exhaustGasTemperatureK, pt5Pa: Number.NaN, Tt6K: gg.nozzleTotalTemperatureK, Tt7K: Tt7, pt7Pa: pt7,
      // The deck gives total airflow; the core/bypass split uses the design bypass ratio.
      fuelAirRatio: gg.fuelFlowKgS / Math.max(1e-6, airflow / (1 + d.bypassRatio)), bypassRatio: d.bypassRatio,
      coreFlowKgS: airflow / (1 + d.bypassRatio), bypassFlowKgS: airflow * d.bypassRatio / (1 + d.bypassRatio), mainFuelKgS: gg.fuelFlowKgS, afterburnerFuelKgS: fAb, totalFuelAirRatio: (gg.fuelFlowKgS + fAb) / Math.max(1e-6, airflow) }
  };
}

/**
 * Solve the design TIT and maximum AB temperature so UNINSTALLED sea-level-static thrust (bellmouth
 * inlet, no installation loss) matches the given ratings — published engine ratings are test-stand
 * values. Installation losses then apply only in the aircraft.
 */
export function calibrate(design: TurbofanDesign, militaryThrustN: number, maxAfterburnerThrustN: number): { turbineInletTemperatureK: number; afterburnerMaxTemperatureK: number } {
  const sls: Ambient = { temperatureK: T_STD, pressurePa: P_STD, mach: 0 };
  const d: TurbofanDesign = { ...design, installationLossFraction: 0, inlet: { kind: "bellmouth", recovery: () => 1 } };
  const bisect = (fn: (x: number) => number, lo: number, hi: number) => {
    if (fn(lo) * fn(hi) > 0) throw new RangeError("Engine calibration target is not reachable with this cycle.");
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (fn(lo) * fn(mid) <= 0) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  };
  // A data-driven gas generator already fixes dry thrust: only the afterburner is calibrated.
  const tit = d.gasGenerator ? d.turbineInletTemperatureK : bisect((t) => solveCycle(d, sls, 1, 0, { turbineInletTemperatureK: t }).netThrustN - militaryThrustN, 1000, 2400);
  const tab = bisect((t) => solveCycle(d, sls, 1, 1, { turbineInletTemperatureK: tit, afterburnerMaxTemperatureK: t }).netThrustN - maxAfterburnerThrustN, 1200, 2600);
  return { turbineInletTemperatureK: tit, afterburnerMaxTemperatureK: tab };
}

/**
 * Engine transient and health behaviour, supplied per engine package (values with provenance there).
 *  - Two spools: the core (NH) follows the control's speed demand with `rotorTimeConstantS`; the
 *    fan (NL) lags the core with `fanTimeConstantS`. Airflow and thrust follow the FAN, so thrust
 *    lags the core during a spool-up.
 *  - Surge: margin(Nc) from a table minus penalties for core acceleration, inlet distortion and
 *    afterburner light-off pressure pulses. Margin < 0 → surge: thrust and airflow collapse, EGT rises,
 *    and the recovery logic (fuel dip / IGV closure / relight) holds the engine for `recoveryS`.
 *  - Health: oil temperature (first-order toward ambient + rise × NH²), oil pressure ∝ NH², vibration
 *    (∝ NH, spikes in surge), life counters (hot-section time weighted by TIT, AB time, surges).
 *  - Afterburner: `zones` light in sequence (one every `zoneDelayS`); below `blowoutBurnerPressurePa`
 *    the flame blows out and may relight after `relightDelayS`.
 */
export interface EngineDynamicsSpec {
  readonly fanTimeConstantS: number;
  readonly surge?: {
    readonly baseMarginByCorrectedSpeed: Table1D;
    /** Margin lost per (fraction of speed per second) of core acceleration. */
    readonly accelerationPenalty: number;
    /** Margin lost at full distortion index (1). */
    readonly distortionPenalty: number;
    /** Margin lost per (fraction per second) of afterburner increase (light-off pressure pulse). */
    readonly afterburnerPulsePenalty: number;
    readonly recoveryS: number;
    readonly thrustFractionInSurge: number;
    readonly egtRiseK: number;
  };
  readonly health?: { readonly oilTimeConstantS: number; readonly oilTemperatureRiseK: number; readonly oilPressureAtMaxPa: number; readonly vibrationAtMax: number };
  readonly afterburner?: { readonly zones: number; readonly zoneDelayS: number; readonly blowoutBurnerPressurePa: number; readonly relightDelayS: number };
  /** Variable-nozzle actuator: maximum position rate, fraction of travel per second (the actual nozzle lags the schedule). */
  readonly nozzleRatePerS?: number;
}

export interface EngineHealth {
  readonly oilTemperatureK: number;
  readonly oilPressurePa: number;
  /** Vibration, fraction of the warning level (1 = limit). */
  readonly vibration: number;
  /** Life usage: equivalent hot-section seconds (TIT-weighted), afterburner seconds, surge events. */
  readonly hotSectionEquivalentS: number;
  readonly afterburnerTimeS: number;
  readonly surgeCount: number;
}

export interface TurbofanState extends CycleResult {
  /** Physical spool speed as a fraction of design (the core, NH). */
  readonly spoolSpeed: number;
  /** Fan / LP spool speed fraction (NL); equals the core speed without a two-spool model. */
  readonly fanSpeed: number;
  readonly afterburnerFraction: number;
  readonly afterburnerLit: boolean;
  /** Afterburner zones lit and the total (0/0 without a zone model). */
  readonly afterburnerZonesLit: number;
  readonly afterburnerZones: number;
  readonly afterburnerBlowout: boolean;
  /** Surge margin, fraction (NaN without a surge model); true while surging / recovering. */
  readonly surgeMargin: number;
  readonly surging: boolean;
  /** Variable nozzle: position the control asks for vs where the actuator actually is (0 closed … 1 open); NaN if fixed. */
  readonly nozzleCommandPosition: number;
  readonly nozzleActualPosition: number;
  readonly health?: EngineHealth;
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
  private fan: number;
  private ab = 0;
  private abLit = 0;
  private zoneTimer = 0;
  private blowoutTimer = 0;
  private surgeTimer = 0;
  private surgeSpool = 0;
  private oilK = 288.15;
  private life = { hot: 0, ab: 0, surges: 0 };
  /** Reported (sensed / metal) temperatures with thermal lag: they do not drop to ambient the instant the fire goes out. */
  private thermal: Record<string, number> | undefined;
  private nozzlePos: number | undefined;
  private nozzleCmd = Number.NaN;
  private last: TurbofanState;

  public constructor(private readonly design: TurbofanDesign, initialSpeed: number) {
    this.spool = initialSpeed;
    this.fan = initialSpeed;
    const h = design.dynamics?.health;
    if (h) this.oilK = 288.15 + h.oilTemperatureRiseK * initialSpeed * initialSpeed;
    this.last = this.compose(solveCycle(design, { temperatureK: T_STD, pressurePa: P_STD, mach: 0 }, initialSpeed, 0), { surgeMargin: Number.NaN, flameout: false });
  }

  public get state(): TurbofanState {
    return this.last;
  }

  /**
   * Thermal lag on the temperatures we REPORT (sensors and hot-section metal). Running: a short
   * sensor/metal lag (≈1.5 s); shut down: the hot section cools toward the gas temperature over
   * ≈60 s (ESTIMATED time constants). Physics and limiters use the instantaneous cycle values.
   */
  private lagTemperatures(cycle: CycleResult, dt: number, running: boolean): CycleResult {
    const tau = running ? 1.5 : 60;
    const k = 1 - Math.exp(-dt / tau);
    const st = cycle.stations;
    const raw: Record<string, number> = {
      tit: cycle.turbineInletTemperatureK, noz: cycle.nozzleTemperatureK, t3: cycle.compressorExitTemperatureK,
      ...(cycle.exhaustGasTemperatureK !== undefined ? { egt: cycle.exhaustGasTemperatureK } : {}),
      ...(st ? { s3: st.Tt3K, s4: st.Tt4K, s5: st.Tt5K, s6: st.Tt6K, s7: st.Tt7K } : {})
    };
    if (!this.thermal) this.thermal = { ...raw };
    const out: Record<string, number> = {};
    for (const [key, v] of Object.entries(raw)) {
      const prev = this.thermal[key];
      out[key] = !Number.isFinite(v) ? v : prev === undefined || !Number.isFinite(prev) ? v : prev + (v - prev) * k;
      this.thermal[key] = out[key]!;
    }
    return {
      ...cycle,
      turbineInletTemperatureK: out["tit"]!, nozzleTemperatureK: out["noz"]!, compressorExitTemperatureK: out["t3"]!,
      ...(out["egt"] !== undefined ? { exhaustGasTemperatureK: out["egt"] } : {}),
      ...(st ? { stations: { ...st, Tt3K: out["s3"]!, Tt4K: out["s4"]!, Tt5K: out["s5"]!, Tt6K: out["s6"]!, Tt7K: out["s7"]! } } : {})
    };
  }

  private compose(cycle: CycleResult, x: { surgeMargin: number; flameout: boolean }): TurbofanState {
    const dyn = this.design.dynamics, zones = dyn?.afterburner?.zones ?? 0;
    const h = dyn?.health;
    return {
      ...cycle,
      spoolSpeed: this.spool, fanSpeed: this.fan,
      afterburnerFraction: this.abLit, afterburnerLit: this.abLit > 0,
      afterburnerZonesLit: zones ? Math.min(zones, Math.ceil(this.abLit * zones - 1e-6)) : 0, afterburnerZones: zones,
      afterburnerBlowout: this.blowoutTimer > 0,
      surgeMargin: x.surgeMargin, surging: this.surgeTimer > 0,
      nozzleCommandPosition: Number.isFinite(this.nozzleCmd) ? this.nozzleCmd : cycle.nozzle.position, nozzleActualPosition: cycle.nozzle.position,
      ...(h ? { health: {
        oilTemperatureK: this.oilK, oilPressurePa: h.oilPressureAtMaxPa * this.spool * this.spool,
        vibration: Math.min(2, h.vibrationAtMax * this.spool + (this.surgeTimer > 0 ? 1.2 : 0)),
        hotSectionEquivalentS: this.life.hot, afterburnerTimeS: this.life.ab, surgeCount: this.life.surges
      } } : {}),
      flameout: x.flameout
    };
  }

  public step(demand: EngineDemand, ambient: Ambient, fuelAvailable: boolean, dt: number): TurbofanState {
    const d = this.design, dyn = d.dynamics;
    const h = dyn?.health;
    if (h) this.oilK += ((ambient.temperatureK + h.oilTemperatureRiseK * this.spool * this.spool) - this.oilK) * (1 - Math.exp(-dt / h.oilTimeConstantS));
    if (!fuelAvailable) {
      // Windmilling run-down (no relight model).
      this.spool = Math.max(0, this.spool - this.spool * (dt / (4 * d.rotorTimeConstantS)));
      this.fan = Math.max(0, this.fan - this.fan * (dt / (4 * (dyn?.fanTimeConstantS ?? d.rotorTimeConstantS))));
      this.ab = 0; this.abLit = 0; this.surgeTimer = 0;
      // Windmilling gas is at ambient-ish temperature; the reported hot-section temperatures cool down from where they were.
      const windmill = solveCycle(d, ambient, 0.2, 0);
      const cold = { ...windmill, turbineInletTemperatureK: windmill.compressorExitTemperatureK, nozzleTemperatureK: windmill.compressorExitTemperatureK, exhaustGasTemperatureK: windmill.compressorExitTemperatureK,
        ...(windmill.stations ? { stations: { ...windmill.stations, Tt4K: windmill.compressorExitTemperatureK, Tt5K: windmill.compressorExitTemperatureK, Tt6K: windmill.compressorExitTemperatureK, Tt7K: windmill.compressorExitTemperatureK } } : {}) };
      this.last = this.compose({ ...this.lagTemperatures(cold, dt, false), netThrustN: 0, grossThrustN: 0, fuelFlowKgS: 0 }, { surgeMargin: Number.NaN, flameout: true });
      return this.last;
    }
    const before = this.spool;
    const surging = this.surgeTimer > 0;
    // Core: follows the demand; during surge recovery the fuel dip lets it sag (bounded) below where the surge began.
    const coreTarget = surging ? Math.min(demand.speed, this.surgeSpool - 0.08) : demand.speed;
    this.spool += (coreTarget - this.spool) * (1 - Math.exp(-dt / d.rotorTimeConstantS));
    // Fan: lags the core (two-spool).
    this.fan = dyn ? this.fan + (this.spool - this.fan) * (1 - Math.exp(-dt / dyn.fanTimeConstantS)) : this.spool;
    const accel = (this.spool - before) / Math.max(1e-6, dt);
    // Afterburner request from the control; zones light in sequence; blow-out below the burner-pressure limit.
    const abReq = surging ? 0 : Math.max(0, Math.min(1, demand.afterburner));
    const abLitBefore = this.abLit;
    this.ab = abReq;
    const ab = dyn?.afterburner;
    if (ab) {
      if (this.blowoutTimer > 0) { this.blowoutTimer = Math.max(0, this.blowoutTimer - dt); this.abLit = 0; }
      else {
        const zoneStep = 1 / ab.zones;
        if (this.ab > this.abLit) { this.zoneTimer += dt; if (this.zoneTimer >= ab.zoneDelayS || this.abLit > 0) { this.abLit = Math.min(this.ab, this.abLit + zoneStep * (dt / Math.max(1e-3, ab.zoneDelayS))); this.zoneTimer = ab.zoneDelayS; } }
        else { this.abLit = this.ab; if (this.ab === 0) this.zoneTimer = 0; }
      }
    } else this.abLit = this.ab;
    const theta = (ambient.temperatureK * (1 + 0.2 * ambient.mach * ambient.mach)) / T_STD;
    // Nozzle actuator: the schedule (or flow) gives the commanded position; the actuator moves toward it at a finite rate.
    let throat = demand.throat ?? { kind: "auto" as const };
    if (dyn?.nozzleRatePerS) {
      const wanted = solveCycle(d, ambient, this.fan / Math.sqrt(theta), this.abLit, { throat }).nozzle.position;
      if (Number.isFinite(wanted)) {
        this.nozzleCmd = wanted;
        const p0 = this.nozzlePos ?? wanted, step = dyn.nozzleRatePerS * dt;
        this.nozzlePos = p0 + Math.max(-step, Math.min(step, wanted - p0));
        throat = { kind: "position", position: this.nozzlePos };
      }
    }
    let cycle = solveCycle(d, ambient, this.fan / Math.sqrt(theta), this.abLit, { throat });
    if (ab && this.abLit > 0 && cycle.compressorExitPressurePa < ab.blowoutBurnerPressurePa) {
      this.blowoutTimer = ab.relightDelayS; this.abLit = 0;
      cycle = solveCycle(d, ambient, this.fan / Math.sqrt(theta), 0, { throat });
    }
    // Surge margin and surge events (the light-off pressure pulse follows the zones actually lighting).
    const abRise = Math.max(0, this.abLit - abLitBefore) / Math.max(1e-6, dt);
    let margin = Number.NaN;
    const sg = dyn?.surge;
    if (sg) {
      const distortion = ambient.inletCondition?.state?.distortion ?? 0;
      margin = lookup1D(sg.baseMarginByCorrectedSpeed, cycle.correctedSpeed).value - sg.accelerationPenalty * Math.max(0, accel) - sg.distortionPenalty * distortion - sg.afterburnerPulsePenalty * abRise;
      if (this.surgeTimer > 0) this.surgeTimer = Math.max(0, this.surgeTimer - dt);
      else if (margin < 0) { this.surgeTimer = sg.recoveryS; this.surgeSpool = this.spool; this.life.surges += 1; }
      if (this.surgeTimer > 0) {
        const f = sg.thrustFractionInSurge;
        cycle = { ...cycle, netThrustN: cycle.netThrustN * f, grossThrustN: cycle.grossThrustN * f, airflowKgS: cycle.airflowKgS * (0.5 + 0.5 * f), fuelFlowKgS: cycle.fuelFlowKgS * f,
          ...(cycle.exhaustGasTemperatureK !== undefined ? { exhaustGasTemperatureK: cycle.exhaustGasTemperatureK + sg.egtRiseK } : {}) };
      }
    }
    // Life usage: hot-section time weighted by turbine temperature (or EGT for data decks), AB time.
    const hotT = Number.isFinite(cycle.turbineInletTemperatureK) ? cycle.turbineInletTemperatureK / d.turbineInletTemperatureK : (cycle.exhaustGasTemperatureK ?? 0) / 1000;
    this.life.hot += dt * Math.max(0, hotT) ** 4;
    if (this.abLit > 0) this.life.ab += dt;
    this.last = this.compose({ ...this.lagTemperatures(cycle, dt, true), netThrustN: Math.max(0, cycle.netThrustN) }, { surgeMargin: margin, flameout: false });
    return this.last;
  }
}
