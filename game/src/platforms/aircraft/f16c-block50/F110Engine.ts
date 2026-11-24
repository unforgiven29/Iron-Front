/**
 * F110-GE-129 engine for the F-16C Block 50: gas-path design (the plant) and FADEC schedule
 * (the control), both fed by the provenance-tagged values in F16Data.ts.
 *
 * Shared code used: physics/propulsion/MixedFlowTurbofan.ts (cycle + rotor) and
 * physics/propulsion/Fadec.ts (engine control). Another aircraft supplies its own two objects.
 */
import type { FadecSchedule } from "../../../physics/propulsion/Fadec.js";
import { calibrate, type TurbofanDesign } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import { F16_ENGINE, F16_ENGINE_CONTROL } from "./F16Data.js";

const E = F16_ENGINE, C = F16_ENGINE_CONTROL;

const F110_DESIGN_BASE: TurbofanDesign = {
  airflowKgS: E.airflowKgS.value,
  bypassRatio: E.bypassRatio.value,
  overallPressureRatio: E.overallPressureRatio.value,
  fanPressureRatio: E.fanPressureRatio.value,
  fanEfficiency: 0.86, compressorEfficiency: 0.86, turbineEfficiency: 0.89, burnerEfficiency: 0.99, afterburnerEfficiency: 0.9, nozzleVelocityCoefficient: 0.98,
  turbineInletTemperatureK: 1600, afterburnerMaxTemperatureK: 2000,
  rotorTimeConstantS: E.rotorTimeConstantS.value,
  inlet: "pitot-normal-shock",
  inletSubsonicRecovery: E.inletSubsonicRecovery.value,
  installationLossFraction: E.installationLossFraction.value,
  reynoldsEfficiencyLoss: E.reynoldsEfficiencyLoss.value
};

/** F110 cycle with design temperatures DERIVED from the published SLS dry/AB ratings. */
export const F110_DESIGN: TurbofanDesign = { ...F110_DESIGN_BASE, ...calibrate(F110_DESIGN_BASE, E.militaryThrustN.value, E.maxAfterburnerThrustN.value) };

/** F110 FADEC schedule: PRI (digital) and SEC (hydromechanical backup) behaviour. */
export const F110_CONTROL: FadecSchedule = {
  afterburnerDetentThrottle: E.afterburnerDetentThrottle.value,
  idleSpeed: C.idleSpeed.value,
  maxPhysicalSpeed: 1,
  maxCorrectedSpeed: C.maxCorrectedSpeed.value,
  accelRatePerS: C.accelRatePerS.value,
  decelRatePerS: C.decelRatePerS.value,
  maxCompressorExitTemperatureK: E.maxCompressorExitTemperatureK.value,
  minBurnerPressurePa: C.minBurnerPressurePa.value,
  afterburnerMinSpeedFraction: C.afterburnerMinSpeedFraction.value,
  afterburnerMinBurnerPressurePa: C.afterburnerMinBurnerPressurePa.value,
  afterburnerLightDelayS: C.afterburnerLightDelayS.value,
  afterburnerRatePerS: C.afterburnerRatePerS.value,
  backup: { maxPhysicalSpeed: C.secMaxSpeed.value, accelRatePerS: C.secAccelRatePerS.value, afterburnerInhibited: C.secAfterburnerInhibited.value === 1 }
};
