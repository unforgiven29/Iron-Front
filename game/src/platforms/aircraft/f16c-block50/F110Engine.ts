/**
 * F110-GE-129 engine for the F-16C Block 50: gas-path design (the plant, with its inlet and
 * nozzle components) and FADEC schedule (the control), fed by the provenance-tagged values in
 * F16Data.ts.
 *
 * Shared code used: physics/propulsion/MixedFlowTurbofan.ts (cycle + rotor),
 * physics/propulsion/components/{Inlet,Nozzle}.ts and physics/propulsion/Fadec.ts (control).
 * Another aircraft supplies its own objects built from the same parts.
 */
import { pitotInlet } from "../../../physics/propulsion/components/Inlet.js";
import { idealNozzle, variableConvergentDivergentNozzle } from "../../../physics/propulsion/components/Nozzle.js";
import type { FadecSchedule } from "../../../physics/propulsion/Fadec.js";
import { calibrate, solveCycle, type TurbofanDesign } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import { F16_ENGINE, F16_ENGINE_CONTROL } from "./F16Data.js";

const E = F16_ENGINE, C = F16_ENGINE_CONTROL;
const SLS = { temperatureK: 288.15, pressurePa: 101325, mach: 0 };

const BASE: Omit<TurbofanDesign, "nozzle"> = {
  airflowKgS: E.airflowKgS.value,
  bypassRatio: E.bypassRatio.value,
  overallPressureRatio: E.overallPressureRatio.value,
  fanPressureRatio: E.fanPressureRatio.value,
  fanEfficiency: 0.86, compressorEfficiency: 0.86, turbineEfficiency: 0.89, burnerEfficiency: 0.99, afterburnerEfficiency: 0.9,
  turbineInletTemperatureK: 1600, afterburnerMaxTemperatureK: 2000,
  rotorTimeConstantS: E.rotorTimeConstantS.value,
  inlet: pitotInlet(E.inletSubsonicRecovery.value),
  installationLossFraction: E.installationLossFraction.value,
  reynoldsEfficiencyLoss: E.reynoldsEfficiencyLoss.value
};

const calibrated = (d: TurbofanDesign): TurbofanDesign => ({ ...d, ...calibrate(d, E.militaryThrustN.value, E.maxAfterburnerThrustN.value) });

/**
 * Nozzle sizing (DERIVED): the F110's real throat areas are not public, so the throat range is
 * sized from the calibrated cycle itself: closed = a fraction of the area sea-level-static MIL
 * flow needs, open = a margin over what max afterburner needs. Iterated because the calibrated
 * temperatures and the nozzle depend on each other.
 */
function sizeNozzle(): TurbofanDesign {
  let design = calibrated({ ...BASE, nozzle: idealNozzle(E.nozzleThrustCoefficient.value) });
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
        thrustCoefficient: E.nozzleThrustCoefficient.value
      })
    });
  }
  return design;
}

/** F110 cycle with design temperatures DERIVED from the published SLS dry/AB ratings and a sized C-D nozzle. */
export const F110_DESIGN: TurbofanDesign = sizeNozzle();

/** F110 FADEC schedule: PRI (digital) and SEC (hydromechanical backup) behaviour. */
export const F110_CONTROL: FadecSchedule = {
  afterburnerDetentThrottle: E.afterburnerDetentThrottle.value,
  idleSpeed: C.idleSpeed.value,
  maxPhysicalSpeed: 1,
  maxCorrectedSpeed: C.maxCorrectedSpeed.value,
  accelRatePerS: C.accelRatePerS.value,
  decelRatePerS: C.decelRatePerS.value,
  maxCompressorExitTemperatureK: E.maxCompressorExitTemperatureK.value,
  // Turbine limit DERIVED: the calibrated MIL turbine inlet temperature plus an estimated margin.
  maxTurbineInletTemperatureK: F110_DESIGN.turbineInletTemperatureK + C.turbineTemperatureMarginK.value,
  minBurnerPressurePa: C.minBurnerPressurePa.value,
  afterburnerMinSpeedFraction: C.afterburnerMinSpeedFraction.value,
  afterburnerMinBurnerPressurePa: C.afterburnerMinBurnerPressurePa.value,
  afterburnerLightDelayS: C.afterburnerLightDelayS.value,
  afterburnerRatePerS: C.afterburnerRatePerS.value,
  // SEC: no separate speed cap — the closed nozzle limits the engine through the nozzle-area limiter.
  backup: { maxPhysicalSpeed: 1, accelRatePerS: C.secAccelRatePerS.value, afterburnerInhibited: C.secAfterburnerInhibited.value === 1, nozzleClosed: C.secNozzleClosed.value === 1 }
};
