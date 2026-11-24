/**
 * F-16C Block 50 hydraulic installation for the shared hydraulic network
 * (game/src/systems/hydraulics). Topology per the repo dossier
 * (game/modules/planes/F-16/systems/hydraulics.md); sizes from F16_HYDRAULICS (mostly estimated).
 *
 * Modelled: systems A and B, one F110-driven pump each, an FLCS accumulator each, the EPU pump on
 * System A (auto-start on dual low pressure, start delay, finite endurance); stabilator, roll
 * control, rudder and leading-edge flaps fed by both systems (one chamber each), speedbrakes by
 * System A only. Hinge loads scale with q̄ and deflection (estimated; no hinge-moment data).
 * Not modelled: utilities on B (gear, brakes, NWS, gun, refuelling), the brake/JFS accumulator,
 * the EPU's electrical output, reservoirs and cooling.
 */
import type { HydraulicInstallation } from "../../../systems/hydraulics/HydraulicNetwork.js";
import { F16_HYDRAULICS as H } from "./F16Data.js";

const circuit = (id: string) => ({ id, nominalPressurePa: H.nominalPressurePa.value, fluidVolumeM3: H.fluidVolumeM3.value, bulkModulusPa: H.bulkModulusPa.value, leakageM3sPerPa: H.leakageM3sPerPa.value, reliefPressurePa: H.reliefPressurePa.value });
const pump = (id: string, circuitId: string) => ({ id, circuitId, ratedFlowM3s: H.pumpRatedFlowM3s.value, compensatorPressurePa: H.nominalPressurePa.value + H.pumpCompensatorBandPa.value / 2, compensatorBandPa: H.pumpCompensatorBandPa.value, drive: { kind: "engine" as const, engineId: "f110", ratedSpeedFraction: 1 } });
const hingeLoad = { loadFractionAtReference: H.hingeLoadFractionAtReference.value, referenceDynamicPressurePa: H.hingeReferenceDynamicPressurePa.value };
const dual = (d: number) => ({ chambers: [{ circuitId: "A", displacementM3PerDeg: d }, { circuitId: "B", displacementM3PerDeg: d }], hingeLoad });

export const F16_HYDRAULIC_INSTALLATION: HydraulicInstallation = {
  circuits: [circuit("A"), circuit("B")],
  pumps: [
    pump("pump.A", "A"), pump("pump.B", "B"),
    { id: "pump.epu", circuitId: "A", ratedFlowM3s: H.epuPumpFlowM3s.value, compensatorPressurePa: H.nominalPressurePa.value + H.pumpCompensatorBandPa.value / 2, compensatorBandPa: H.pumpCompensatorBandPa.value, drive: { kind: "emergency" } }
  ],
  accumulators: [
    { id: "acc.flcs.A", circuitId: "A", gasVolumeM3: H.flcsAccumulatorGasM3.value, prechargePa: H.flcsAccumulatorPrechargePa.value },
    { id: "acc.flcs.B", circuitId: "B", gasVolumeM3: H.flcsAccumulatorGasM3.value, prechargePa: H.flcsAccumulatorPrechargePa.value }
  ],
  emergencyUnit: { id: "epu", autoStartWhenAllBelowPa: H.epuAutoStartBelowPa.value, autoStartCircuits: ["A", "B"], startDelayS: H.epuStartDelayS.value, enduranceS: H.epuEnduranceS.value },
  actuators: {
    elevator: dual(H.stabilatorDisplacementM3PerDeg.value),
    aileron: dual(H.rollDisplacementM3PerDeg.value),
    rudder: dual(H.rudderDisplacementM3PerDeg.value),
    lef: dual(H.lefDisplacementM3PerDeg.value),
    speedbrake: { chambers: [{ circuitId: "A", displacementM3PerDeg: H.speedbrakeDisplacementM3PerDeg.value }], hingeLoad }
  }
};
