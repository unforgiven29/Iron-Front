/**
 * Twin RD-33 installation on the SHARED propulsion modules (generic-map MixedFlowTurbofan + Fadec).
 * Unlike the F-16's F110 (GE deck tables), no RD-33 deck is public: the generic component-map
 * cycle is calibrated to the family-level ratings (uninstalled), with an efficient variable-ramp
 * inlet (MIL-E-5008B recovery) and an ideal nozzle with an estimated thrust coefficient.
 */
import { milE5008bRecovery, type InletModel } from "../../../physics/propulsion/components/Inlet.js";
import { idealNozzle } from "../../../physics/propulsion/components/Nozzle.js";
import type { FadecSchedule } from "../../../physics/propulsion/Fadec.js";
import { calibrate, type TurbofanDesign } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import type { EngineInstallation } from "../common/AircraftDefinition.js";
import { MIG29_ENGINE as E } from "./MiG29Data.js";

/**
 * MiG-29 intake (GAF T.O. 1F-MIG29-1, "Engine air intake system"): on the ground below ≈108 KIAS
 * the forward ramp closes the main duct against FOD and the engine breathes through the spring-
 * loaded louvers in the upper wing root (recovery ESTIMATED). Above that, the variable ramps are
 * scheduled on corrected NL, altitude and Mach (schedule chart FO-6 not available): supersonic
 * recovery uses the MIL-E-5008B reference for an efficient multi-shock ramp inlet.
 * Not modelled: intermittent louver opening in flight (M < 0.3 IDLE / < 0.6 MIL), the anti-surge
 * ramp closure, ramp position indication, inlet distortion.
 */
export function mig29Intake(): InletModel {
  const vOpen = E.intakeRampOpenKias.value * 0.514444;
  return {
    kind: "mig29-variable-ramp",
    recovery: (mach, c) => (c?.weightOnWheels && c.equivalentAirspeedMps < vOpen ? E.louverModeRecovery.value : milE5008bRecovery(mach))
  };
}

const BASE: TurbofanDesign = {
  airflowKgS: E.airflowKgS.value, bypassRatio: E.bypassRatio.value, overallPressureRatio: E.overallPressureRatio.value, fanPressureRatio: E.fanPressureRatio.value,
  fanEfficiency: 0.85, compressorEfficiency: 0.85, turbineEfficiency: 0.88, burnerEfficiency: 0.99, afterburnerEfficiency: 0.9,
  turbineInletTemperatureK: 1500, afterburnerMaxTemperatureK: 2000, rotorTimeConstantS: 0.35,
  inlet: mig29Intake(), nozzle: idealNozzle(0.97),
  installationLossFraction: E.installationLossFraction.value, reynoldsEfficiencyLoss: 0.05
};

/** RD-33 cycle with design temperatures DERIVED from the published ratings (normal power mode, NPM). */
export const RD33_DESIGN: TurbofanDesign = { ...BASE, ...calibrate(BASE, E.militaryThrustN.value, E.maxAfterburnerThrustN.value) };
/** Limited power mode (LPM, set by the ground crew): lower EGT limit → the published LPM ratings. */
export const RD33_LPM_DESIGN: TurbofanDesign = { ...BASE, ...calibrate(BASE, E.limitedPowerMilitaryThrustN.value, E.limitedPowerMaxAfterburnerThrustN.value) };
export type Rd33PowerMode = "NPM" | "LPM";

export const RD33_CONTROL: FadecSchedule = {
  afterburnerDetentThrottle: E.afterburnerDetentThrottle.value, idleSpeed: E.idleSpeed.value, maxPhysicalSpeed: 1, maxCorrectedSpeed: 1.04,
  accelRatePerS: E.accelRatePerS.value, decelRatePerS: E.decelRatePerS.value,
  afterburnerMinSpeedFraction: E.afterburnerMinSpeedFraction.value, afterburnerLightDelayS: E.afterburnerLightDelayS.value, afterburnerLightDuringAcceleration: true, afterburnerRatePerS: 1.5,
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
