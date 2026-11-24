/**
 * F110-GE-129 engine for the F-16C Block 50: the plant (inlet, data-driven gas generator,
 * afterburner, nozzle) and the FADEC schedule, fed by F16Data.ts and F110DeckData.ts.
 *
 * Dry engine: corrected-parameter tables built from the GE F110-GE-129 cycle deck as published
 * in NASA TM-104326 (ground run, idle → MIL). The deck's 19 flight points are NOT used to build
 * the tables; tests compare against them (game/tests/unit/F110Deck.test.ts).
 * Afterburner: thermodynamic heat addition on the deck's mixed exhaust, its maximum temperature
 * DERIVED by calibrating sea-level-static max thrust to the published 29,000 lbf (no AB data).
 * Nozzle: variable C-D physics; exit/throat area ratio and thrust coefficient schedules from the
 * same report.
 *
 * Shared code used: physics/propulsion (MixedFlowTurbofan cycle + rotor, components, Fadec).
 */
import type { Table1D } from "../../../physics/aerodynamics/Tables.js";
import type { GasGeneratorDeck } from "../../../physics/propulsion/components/GasGeneratorDeck.js";
import { pitotInlet } from "../../../physics/propulsion/components/Inlet.js";
import { idealNozzle, variableConvergentDivergentNozzle } from "../../../physics/propulsion/components/Nozzle.js";
import type { FadecSchedule } from "../../../physics/propulsion/Fadec.js";
import { calibrate, solveCycle, type TurbofanDesign } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import { F110_FLIGHT_POINTS, F110_GROUND_RUN, type DeckRow } from "./F110DeckData.js";
import { F16_ENGINE, F16_ENGINE_CONTROL } from "./F16Data.js";

const E = F16_ENGINE, C = F16_ENGINE_CONTROL;
const SLS = { temperatureK: 288.15, pressurePa: 101325, mach: 0 };
const LB = 0.45359237, R_STD = 518.67, PSI_STD = 14.696;
const N2_REF = 14709, N1_REF = 8241; // ground-run MIL (TM-104326 table 4, point 13)

/** Corrected-parameter tables from the ground run (rows with a value only). */
function deckTables(rows: readonly DeckRow[]): GasGeneratorDeck {
  const pts = rows.map((r) => {
    const [, t1, p1, pt25, ps3, wfe, n1, n2, , egt, p8, t8, , w8] = r;
    const th = t1 / R_STD, de = p1 / PSI_STD, rt = Math.sqrt(th);
    return {
      key: n1 / rt / N1_REF, n2c: n2 / rt / N2_REF,
      wc: w8 === null ? null : (w8 * LB * rt) / de,
      fpr: pt25 / p1, cpr: ps3 / p1, p8r: p8 / p1, t8r: t8 / t1,
      wfc: (wfe * LB) / 3600 / (de * rt), egt: egt / t1
    };
  });
  const table = (f: (p: (typeof pts)[number]) => number | null): Table1D => {
    const ok = pts.filter((p) => f(p) !== null);
    return { breakpoints: ok.map((p) => p.key), values: ok.map((p) => f(p) as number) };
  };
  return {
    referenceN2Rpm: N2_REF, referenceN1Rpm: N1_REF,
    n2Corrected: table((p) => p.n2c),
    nozzleFlowCorrectedKgS: table((p) => p.wc),
    fanPressureRatio: table((p) => p.fpr),
    compressorPressureRatio: table((p) => p.cpr),
    nozzlePressureRatio: table((p) => p.p8r),
    nozzleTemperatureRatio: table((p) => p.t8r),
    fuelFlowCorrectedKgS: table((p) => p.wfc),
    exhaustGasTemperatureRatio: table((p) => p.egt),
    provenance: "GE F110-GE-129 cycle deck via NASA TM-104326 table 4 (ground run), corrected to engine-face conditions"
  };
}

/** Nozzle exit/throat area ratio vs NPR: ground run and flight points of TM-104326 (deck AE9/AE8). */
function exitAreaSchedule(): Table1D {
  const pairs = [...F110_GROUND_RUN, ...F110_FLIGHT_POINTS.map((f) => f[4])].map((r) => [r[15], r[14]] as const).sort((a, b) => a[0] - b[0]);
  const bp: number[] = [], v: number[] = [];
  for (const [npr, ae] of pairs) { if (bp.length === 0 || npr - (bp[bp.length - 1] as number) > 0.05) { bp.push(npr); v.push(ae); } }
  return { breakpoints: bp, values: v };
}

/**
 * Gross thrust coefficient vs NPR, DERIVED from the ground run: deck Fg divided by the C-D nozzle
 * physics at the deck's own P8, T8, W8 and AE9/AE8 (0.96 unchoked part power, ≈0.978 at MIL).
 */
const THRUST_COEFFICIENT: Table1D = { breakpoints: [1.2, 1.8, 2.1, 2.6], values: [0.96, 0.964, 0.975, 0.978] };

const GAS_GENERATOR = deckTables(F110_GROUND_RUN);

const BASE: Omit<TurbofanDesign, "nozzle"> = {
  airflowKgS: E.airflowKgS.value,
  bypassRatio: E.bypassRatio.value,
  overallPressureRatio: E.overallPressureRatio.value,
  fanPressureRatio: E.fanPressureRatio.value,
  fanEfficiency: 0.86, compressorEfficiency: 0.86, turbineEfficiency: 0.89, burnerEfficiency: 0.99, afterburnerEfficiency: 0.9,
  turbineInletTemperatureK: Number.NaN, afterburnerMaxTemperatureK: 2000,
  rotorTimeConstantS: E.rotorTimeConstantS.value,
  inlet: pitotInlet(E.inletSubsonicRecovery.value),
  gasGenerator: GAS_GENERATOR,
  installationLossFraction: E.installationLossFraction.value,
  reynoldsEfficiencyLoss: E.reynoldsEfficiencyLoss.value
};

const calibrated = (d: TurbofanDesign): TurbofanDesign => ({ ...d, ...calibrate(d, E.militaryThrustN.value, E.maxAfterburnerThrustN.value) });

/**
 * Nozzle throat range: closed = the throat area sea-level-static MIL flow needs (TM-104326: the
 * F110 nozzle is at its smallest, ≈444–452 in², at intermediate power); open = an estimated margin
 * over what maximum afterburner needs. Iterated with the afterburner calibration.
 */
function sizeNozzle(): TurbofanDesign {
  let design = calibrated({ ...BASE, nozzle: idealNozzle(0.978) });
  for (let i = 0; i < 4; i++) {
    const milArea = solveCycle(design, SLS, 1, 0).nozzle.requiredThroatAreaM2;
    const abArea = solveCycle(design, SLS, 1, 1).nozzle.requiredThroatAreaM2;
    design = calibrated({
      ...BASE,
      nozzle: variableConvergentDivergentNozzle({
        minThroatAreaM2: milArea * E.nozzleClosedThroatFractionOfMil.value,
        maxThroatAreaM2: abArea * E.nozzleOpenThroatFractionOfMaxAb.value,
        exitAreaRatioClosed: E.nozzleExitAreaRatioClosed.value,
        exitAreaRatioOpen: E.nozzleExitAreaRatioOpen.value,
        thrustCoefficient: E.nozzleThrustCoefficient.value,
        exitAreaRatioByPressureRatio: exitAreaSchedule(),
        thrustCoefficientByPressureRatio: THRUST_COEFFICIENT
      })
    });
  }
  return design;
}

/**
 * Throttle map DERIVED from the deck ground run: power-lever angle 20° (idle) → 85° (MIL) mapped to
 * dry throttle 0 → 1, against corrected fan speed. The F110 responds steeply at low PLA.
 */
function throttleSchedule(): Table1D {
  const bp: number[] = [], v: number[] = [];
  for (const r of F110_GROUND_RUN) {
    const frac = Math.min(1, Math.max(0, (r[0] - 20) / 65));
    const n1c = r[6] / Math.sqrt(r[1] / R_STD) / N1_REF;
    if (bp.length === 0 || frac > (bp[bp.length - 1] as number) + 1e-6) { bp.push(frac); v.push(n1c); }
  }
  return { breakpoints: bp, values: v };
}

/** F110 plant: deck gas generator, calibrated afterburner, sized C-D nozzle. */
export const F110_DESIGN: TurbofanDesign = sizeNozzle();

/**
 * F110 FADEC schedule. Speeds are FAN (N1) fractions of 8,241 rpm (ground-run MIL). Idle and the
 * intermediate (MIL) limits are DERIVED from the deck: idle N1 3,105 rpm at PLA 20°; at PLA 85°
 * corrected N1 is held near 1.005 until physical N1 reaches ≈8,560 rpm (warm engine face in flight).
 */
export const F110_CONTROL: FadecSchedule = {
  afterburnerDetentThrottle: E.afterburnerDetentThrottle.value,
  idleSpeed: C.idleSpeed.value,
  dryThrottleCorrectedSpeed: throttleSchedule(),
  maxPhysicalSpeed: C.maxPhysicalSpeed.value,
  maxCorrectedSpeed: C.maxCorrectedSpeed.value,
  accelRatePerS: C.accelRatePerS.value,
  decelRatePerS: C.decelRatePerS.value,
  minBurnerPressurePa: C.minBurnerPressurePa.value,
  afterburnerMinSpeedFraction: C.afterburnerMinSpeedFraction.value,
  afterburnerMinBurnerPressurePa: C.afterburnerMinBurnerPressurePa.value,
  afterburnerLightDelayS: C.afterburnerLightDelayS.value,
  afterburnerRatePerS: C.afterburnerRatePerS.value,
  backup: { maxPhysicalSpeed: C.maxPhysicalSpeed.value, accelRatePerS: C.secAccelRatePerS.value, afterburnerInhibited: C.secAfterburnerInhibited.value === 1, nozzleClosed: C.secNozzleClosed.value === 1 }
};
