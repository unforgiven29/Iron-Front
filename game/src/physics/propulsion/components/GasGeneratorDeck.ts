/**
 * Data-driven gas generator ("engine deck") component (physics/propulsion).
 *
 * Instead of generic component maps, the dry gas generator (fan, compressor, burner, turbines,
 * mixer) is represented by tables of CORRECTED parameters against corrected FAN speed
 * N1c = N1/√θ1, where θ1 = T1/288.15 K and δ1 = P1/101325 Pa at the engine face. The fan sets the
 * airflow, so fan speed is the parameter that collapses the data across flight conditions;
 * core speed does not when variable geometry reschedules the core with engine-face temperature. Gas-turbine
 * similarity makes these nearly independent of flight condition, which is why manufacturers'
 * cycle decks and test data are reduced this way. This is the engine counterpart of the
 * wind-tunnel coefficient tables used for the airframe.
 *
 * The engine package supplies the tables with provenance. Outside the tabulated speed range the
 * values are held at the edge and flagged (never extrapolated silently).
 */
import { lookup1D, type Table1D } from "../../aerodynamics/Tables.js";

export interface GasGeneratorDeck {
  /** Core (N2) and fan (N1) speeds, rpm, that correspond to 1.0 in the tables. */
  readonly referenceN2Rpm: number;
  readonly referenceN1Rpm: number;
  /** All tables use corrected fan speed N1c (fraction of the N1 reference) as breakpoints. */
  readonly n2Corrected: Table1D;
  /** Nozzle (station 8) mass flow, corrected: W8·√θ1/δ1, kg/s. */
  readonly nozzleFlowCorrectedKgS: Table1D;
  /** Fan discharge total pressure / engine-face total pressure. */
  readonly fanPressureRatio: Table1D;
  /** Compressor discharge static pressure / engine-face total pressure. */
  readonly compressorPressureRatio: Table1D;
  /** Nozzle-throat total pressure P8 / engine-face total pressure. */
  readonly nozzlePressureRatio: Table1D;
  /** Nozzle-throat mixed total temperature T8 / engine-face total temperature. */
  readonly nozzleTemperatureRatio: Table1D;
  /** Core fuel flow, corrected: WF/(δ1·√θ1), kg/s. */
  readonly fuelFlowCorrectedKgS: Table1D;
  /** Exhaust gas temperature / engine-face total temperature (measured EGT). */
  readonly exhaustGasTemperatureRatio: Table1D;
  readonly provenance: string;
}

export interface GasGeneratorState {
  readonly n1Rpm: number;
  readonly n2Rpm: number;
  readonly nozzleFlowKgS: number;
  readonly fanDischargePressurePa: number;
  readonly compressorDischargePressurePa: number;
  readonly nozzleTotalPressurePa: number;
  readonly nozzleTotalTemperatureK: number;
  readonly fuelFlowKgS: number;
  readonly exhaustGasTemperatureK: number;
  /** True when N1c is outside the tabulated range (values held at the edge). */
  readonly outsideDeck: boolean;
}

const T_STD = 288.15, P_STD = 101325;

/** Evaluate the deck at engine-face conditions and corrected fan speed. */
export function evaluateGasGenerator(deck: GasGeneratorDeck, faceTemperatureK: number, facePressurePa: number, n1Corrected: number): GasGeneratorState {
  const theta = faceTemperatureK / T_STD, delta = facePressurePa / P_STD, rt = Math.sqrt(theta);
  // Flag only real extrapolation (0.5 % tolerance at the table ends absorbs rounding at idle/MIL).
  const bp = deck.nozzleFlowCorrectedKgS.breakpoints;
  const outside = n1Corrected < (bp[0] as number) * 0.995 || n1Corrected > (bp[bp.length - 1] as number) * 1.005;
  const L = (t: Table1D) => lookup1D(t, n1Corrected).value;
  return {
    n1Rpm: n1Corrected * rt * deck.referenceN1Rpm,
    n2Rpm: L(deck.n2Corrected) * rt * deck.referenceN2Rpm,
    nozzleFlowKgS: (L(deck.nozzleFlowCorrectedKgS) * delta) / rt,
    fanDischargePressurePa: L(deck.fanPressureRatio) * facePressurePa,
    compressorDischargePressurePa: L(deck.compressorPressureRatio) * facePressurePa,
    nozzleTotalPressurePa: L(deck.nozzlePressureRatio) * facePressurePa,
    nozzleTotalTemperatureK: L(deck.nozzleTemperatureRatio) * faceTemperatureK,
    fuelFlowKgS: L(deck.fuelFlowCorrectedKgS) * delta * rt,
    exhaustGasTemperatureK: L(deck.exhaustGasTemperatureRatio) * faceTemperatureK,
    outsideDeck: outside
  };
}
