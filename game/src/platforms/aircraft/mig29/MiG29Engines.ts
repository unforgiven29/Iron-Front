/**
 * Twin RD-33 installation on the SHARED propulsion modules (generic-map MixedFlowTurbofan + Fadec).
 * Unlike the F-16's F110 (GE deck tables), no RD-33 deck is public: the generic component-map
 * cycle is calibrated to the family-level ratings (uninstalled), with an efficient variable-ramp
 * inlet (MIL-E-5008B recovery) and an ideal nozzle with an estimated thrust coefficient.
 */
import { mig29Intake } from "./MiG29Intake.js";
import { idealNozzle, variableConvergentDivergentNozzle } from "../../../physics/propulsion/components/Nozzle.js";
import type { Table1D } from "../../../physics/aerodynamics/Tables.js";
import type { FadecSchedule } from "../../../physics/propulsion/Fadec.js";
import { calibrate, solveCycle, type TurbofanDesign } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import type { EngineInstallation } from "../common/AircraftDefinition.js";
import { MIG29_ENGINE as E } from "./MiG29Data.js";

const BASE: TurbofanDesign = {
  airflowKgS: E.airflowKgS.value, bypassRatio: E.bypassRatio.value, overallPressureRatio: E.overallPressureRatio.value, fanPressureRatio: E.fanPressureRatio.value,
  fanEfficiency: 0.85, compressorEfficiency: 0.85, turbineEfficiency: 0.88, burnerEfficiency: 0.99, afterburnerEfficiency: 0.9,
  turbineInletTemperatureK: 1500, afterburnerMaxTemperatureK: 2000, rotorTimeConstantS: 0.35,
  inlet: mig29Intake(), nozzle: idealNozzle(0.97),
  installationLossFraction: E.installationLossFraction.value, reynoldsEfficiencyLoss: 0.05, flowSpeedExponent: E.flowSpeedExponent.value
};

/**
 * Variable convergent–divergent exhaust nozzle (GAF T.O.: primary and secondary nozzles linked by a
 * synchronisation unit; the secondary is set for complete expansion to ambient pressure). Exit/throat
 * area ratio follows the full-expansion ratio for the nozzle pressure ratio (γ = 1.3) up to the
 * estimated mechanical limit; throat range sized from this cycle's sea-level MIL / max-AB flow.
 */
function fullExpansionSchedule(): Table1D {
  const g = 1.3, bp: number[] = [], v: number[] = [];
  for (let npr = 1.9; npr <= 12.01; npr += 0.5) {
    const m = Math.sqrt((2 / (g - 1)) * (npr ** ((g - 1) / g) - 1));
    const ratio = (1 / m) * ((2 / (g + 1)) * (1 + ((g - 1) / 2) * m * m)) ** ((g + 1) / (2 * (g - 1)));
    bp.push(npr); v.push(Math.min(E.nozzleMaxExitAreaRatio.value, Math.max(1, ratio)));
  }
  return { breakpoints: bp, values: v };
}

const SLS = { temperatureK: 288.15, pressurePa: 101325, mach: 0 };
function sizeNozzle(milN: number, abN: number): TurbofanDesign {
  const cal = (d: TurbofanDesign): TurbofanDesign => ({ ...d, ...calibrate(d, milN, abN) });
  let design = cal({ ...BASE, nozzle: idealNozzle(E.nozzleThrustCoefficient.value) });
  for (let i = 0; i < 4; i++) {
    const mil = solveCycle(design, SLS, 1, 0).nozzle.requiredThroatAreaM2, ab = solveCycle(design, SLS, 1, 1).nozzle.requiredThroatAreaM2;
    design = cal({ ...BASE, nozzle: variableConvergentDivergentNozzle({
      minThroatAreaM2: mil * E.nozzleClosedThroatFractionOfMil.value, maxThroatAreaM2: ab * E.nozzleOpenThroatFractionOfMaxAb.value,
      exitAreaRatioClosed: 1, exitAreaRatioOpen: E.nozzleMaxExitAreaRatio.value, thrustCoefficient: E.nozzleThrustCoefficient.value,
      exitAreaRatioByPressureRatio: fullExpansionSchedule()
    }) });
  }
  return design;
}

/** RD-33 cycle with design temperatures DERIVED from the published ratings (normal power mode, NPM). */
export const RD33_DESIGN: TurbofanDesign = sizeNozzle(E.militaryThrustN.value, E.maxAfterburnerThrustN.value);
/** Limited power mode (LPM, set by the ground crew): lower EGT limit → the published LPM ratings. */
export const RD33_LPM_DESIGN: TurbofanDesign = sizeNozzle(E.limitedPowerMilitaryThrustN.value, E.limitedPowerMaxAfterburnerThrustN.value);
export type Rd33PowerMode = "NPM" | "LPM";

export const RD33_CONTROL: FadecSchedule = {
  afterburnerDetentThrottle: E.afterburnerDetentThrottle.value, idleSpeed: E.idleSpeed.value, maxPhysicalSpeed: 1, maxCorrectedSpeed: 1.04,
  accelRatePerS: E.accelRatePerS.value, decelRatePerS: E.decelRatePerS.value,
  afterburnerMinSpeedFraction: E.afterburnerMinSpeedFraction.value, afterburnerLightDelayS: E.afterburnerLightDelayS.value, afterburnerLightDuringAcceleration: true,
  // GAF T.O.: below MIL the primary nozzle is fully open at IDLE and closes as the throttle advances (linear: estimated).
  dryNozzleMinPosition: { breakpoints: [0, 1], values: [1, 0] }, afterburnerRatePerS: 1.5,
  backup: { maxPhysicalSpeed: 0.95, accelRatePerS: 0.05, afterburnerInhibited: true, nozzleClosed: false }
};

const y = E.lateralOffsetM.value;
export function mig29Engines(mode: Rd33PowerMode = "NPM"): readonly EngineInstallation[] {
  const design = mode === "LPM" ? RD33_LPM_DESIGN : RD33_DESIGN;
  return [
    { id: "left", design, control: RD33_CONTROL, positionBodyM: [-4, -y, 0], thrustAxisBody: [1, 0, 0] },
    { id: "right", design, control: RD33_CONTROL, positionBodyM: [-4, y, 0], thrustAxisBody: [1, 0, 0] }
  ];
}
export const MIG29_ENGINES: readonly EngineInstallation[] = mig29Engines("NPM");
