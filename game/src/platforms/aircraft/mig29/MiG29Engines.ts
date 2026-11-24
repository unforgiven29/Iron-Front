/**
 * Twin RD-33 installation on the SHARED propulsion modules (generic-map MixedFlowTurbofan + Fadec).
 * Unlike the F-16's F110 (GE deck tables), no RD-33 deck is public: the generic component-map
 * cycle is calibrated to the family-level ratings (uninstalled), with an efficient variable-ramp
 * inlet (MIL-E-5008B recovery) and an ideal nozzle with an estimated thrust coefficient.
 */
import { milE5008bInlet } from "../../../physics/propulsion/components/Inlet.js";
import { idealNozzle } from "../../../physics/propulsion/components/Nozzle.js";
import type { FadecSchedule } from "../../../physics/propulsion/Fadec.js";
import { calibrate, type TurbofanDesign } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import type { EngineInstallation } from "../common/AircraftDefinition.js";
import { MIG29_ENGINE as E } from "./MiG29Data.js";

const BASE: TurbofanDesign = {
  airflowKgS: E.airflowKgS.value, bypassRatio: E.bypassRatio.value, overallPressureRatio: E.overallPressureRatio.value, fanPressureRatio: E.fanPressureRatio.value,
  fanEfficiency: 0.85, compressorEfficiency: 0.85, turbineEfficiency: 0.88, burnerEfficiency: 0.99, afterburnerEfficiency: 0.9,
  turbineInletTemperatureK: 1500, afterburnerMaxTemperatureK: 2000, rotorTimeConstantS: 0.35,
  inlet: milE5008bInlet(), nozzle: idealNozzle(0.97),
  installationLossFraction: E.installationLossFraction.value, reynoldsEfficiencyLoss: 0.05
};

/** RD-33 cycle with design temperatures DERIVED from the published (family) ratings. */
export const RD33_DESIGN: TurbofanDesign = { ...BASE, ...calibrate(BASE, E.militaryThrustN.value, E.maxAfterburnerThrustN.value) };

export const RD33_CONTROL: FadecSchedule = {
  afterburnerDetentThrottle: E.afterburnerDetentThrottle.value, idleSpeed: E.idleSpeed.value, maxPhysicalSpeed: 1, maxCorrectedSpeed: 1.04,
  accelRatePerS: E.accelRatePerS.value, decelRatePerS: E.decelRatePerS.value,
  afterburnerMinSpeedFraction: 0.97, afterburnerLightDelayS: 0.5, afterburnerRatePerS: 1.5,
  backup: { maxPhysicalSpeed: 0.95, accelRatePerS: 0.05, afterburnerInhibited: true, nozzleClosed: false }
};

const y = E.lateralOffsetM.value;
export const MIG29_ENGINES: readonly EngineInstallation[] = [
  { id: "left", design: RD33_DESIGN, control: RD33_CONTROL, positionBodyM: [-4, -y, 0], thrustAxisBody: [1, 0, 0] },
  { id: "right", design: RD33_DESIGN, control: RD33_CONTROL, positionBodyM: [-4, y, 0], thrustAxisBody: [1, 0, 0] }
];
