/**
 * MiG-29 hydraulics, electrical system, accessory drives and landing gear — this package's own
 * installations on the shared modules (systems/hydraulics, systems/electrical,
 * physics/ground-handling). Per GAF T.O. 1F-MIG29-1:
 *  - The airframe accessory gearbox (GBX) drives BOTH hydraulic pumps and BOTH generators. It is
 *    normally driven by the RH engine; a freewheel clutch selects the LH engine when its RPM exceeds
 *    the RH by ≥7 %. One engine out therefore keeps all hydraulic and electrical power.
 *  - Main and boost systems, 19–22 MPa, relief 24 MPa, accumulators 8 MPa precharge; full control
 *    on either system. A fuel-driven emergency pump feeds the boost system when both systems are
 *    below 10 MPa, with both engines at ≥85 % RPM; its low delivery gives severely degraded control.
 *  - AC: 30 kVA generator → AC bus; on loss, the DC/AC converter PTO (1.5 kVA) feeds essential
 *    AC loads and the non-essential ones (incl. the AFCS) are shed. DC: 12 kW generator → DC bus;
 *    on loss, the batteries feed it and the damping (SAU) etc. drop out.
 * Sizes of pumps/actuators/loads/battery capacity: estimated (MiG29Data.ts).
 */
import type { LandingGearSpec, WheelSpec } from "../../../physics/ground-handling/LandingGear.js";
import type { HydraulicInstallation } from "../../../systems/hydraulics/HydraulicNetwork.js";
import type { DriveContext } from "../common/AircraftDefinition.js";
import type { ElectricalInstallation } from "../../../systems/electrical/ElectricalNetwork.js";
import { MIG29_ELECTRICAL as E, MIG29_GEAR as G, MIG29_HYDRAULICS as H } from "./MiG29Data.js";

const circuit = (id: string) => ({ id, nominalPressurePa: H.nominalPressurePa.value, fluidVolumeM3: 0.014, bulkModulusPa: 1.5e9, leakageM3sPerPa: 2.5e-5 / H.nominalPressurePa.value, reliefPressurePa: H.reliefPressurePa.value });
const pump = (id: string, circuitId: string, engineId: string, flowFraction = 1) => ({ id, circuitId, ratedFlowM3s: H.pumpRatedFlowM3s.value * flowFraction, compensatorPressurePa: H.nominalPressurePa.value * 1.03, compensatorBandPa: H.nominalPressurePa.value * 0.06, drive: { kind: "engine" as const, engineId, ratedSpeedFraction: 1 } });
const hingeLoad = { loadFractionAtReference: H.hingeLoadFractionAtReference.value, referenceDynamicPressurePa: H.hingeReferenceDynamicPressurePa.value };
const dual = { chambers: [{ circuitId: "main", displacementM3PerDeg: H.displacementM3PerDeg.value }, { circuitId: "booster", displacementM3PerDeg: H.displacementM3PerDeg.value }], hingeLoad };
const mainOnly = { chambers: [{ circuitId: "main", displacementM3PerDeg: H.displacementM3PerDeg.value }], hingeLoad };

export const MIG29_HYDRAULIC_INSTALLATION: HydraulicInstallation = {
  circuits: [circuit("main"), circuit("booster")],
  pumps: [pump("pump.main", "main", "gbx"), pump("pump.booster", "booster", "gbx"), pump("pump.emergency", "booster", "emergencyPump", H.emergencyPumpFlowFraction.value)],
  accumulators: [
    { id: "acc.main", circuitId: "main", gasVolumeM3: 0.0012, prechargePa: H.accumulatorPrechargePa.value },
    { id: "acc.booster", circuitId: "booster", gasVolumeM3: 0.0012, prechargePa: H.accumulatorPrechargePa.value }
  ],
  actuators: { elevator: dual, aileron: dual, differentialStabilator: dual, rudder: dual, lef: mainOnly, speedbrake: mainOnly }
};

const mainX = -G.wheelbaseM.value * G.noseLoadFraction.value, z = G.contactBelowCgM.value;
const tyre = { rollingFriction: 0.02, peakFriction: 0.6, corneringStiffnessPerRad: 6 };
const main = (id: string, y: number): WheelSpec => ({ id, contactPointBodyM: [mainX, y, z], strokeM: 0.3, springNPerM: G.springNPerM.value, damperNsPerM: G.damperNsPerM.value, ...tyre, brake: { maxForceN: G.brakeMaxForceN.value, antiSkidFraction: 0.8 } });

export const MIG29_LANDING_GEAR: LandingGearSpec = {
  wheels: [
    { id: "nose", contactPointBodyM: [mainX + G.wheelbaseM.value, 0, z], strokeM: 0.25, springNPerM: G.noseSpringNPerM.value, damperNsPerM: G.noseDamperNsPerM.value, ...tyre, steering: { maxAngleDeg: 31, rateDegS: 30 } /* GAF T.O.: high (taxi) mode 31°, low mode 8° not modelled */ },
    main("left", -G.wheelTrackM.value / 2), main("right", G.wheelTrackM.value / 2)
  ],
  transitTimeS: 8, /* GAF T.O.: extension 7–8 s, retraction 9–10 s (single transit time) */ gearCircuitId: "main", brakeCircuitId: "main", steeringCircuitId: "main",
  maxSinkRateMps: G.maxSinkRateMps.value, restCgHeightM: z - 0.11,
  // Estimated strike points: nose, tail (≈13° tail-strike pitch), wingtips, belly.
  airframePointsBodyM: [[8.5, 0, 0.7], [-8, 0, 0.1], [0, -5.6, 1.1], [0, 5.6, 1.1], [0, 0, 1.3]]
};

/** Accessory drives: the GBX follows the RH engine unless the LH is ≥7 % faster; the emergency pump latches on dual low pressure. */
export function mig29AccessoryDrives(): (ctx: DriveContext) => Readonly<Record<string, number>> {
  let emergencyLatched = false;
  return (ctx) => {
    const lh = ctx.engineSpeed("left"), rh = ctx.engineSpeed("right");
    const gbx = lh >= rh + H.gearboxEngineSelectMargin.value ? lh : rh;
    const low = H.lowPressurePa.value;
    if (ctx.hydraulicPressurePa("main") < low && ctx.hydraulicPressurePa("booster") < low) emergencyLatched = true;
    if (ctx.hydraulicPressurePa("main") > 0.9 * H.nominalPressurePa.value) emergencyLatched = false; // normal supply restored
    const emergencyPump = emergencyLatched && Math.min(lh, rh) >= H.emergencyPumpMinEngineSpeed.value ? 1 : 0;
    return { gbx, emergencyPump };
  };
}

export const MIG29_ELECTRICAL_INSTALLATION: ElectricalInstallation = {
  sources: [
    { id: "gen.dc", kind: "generator", driveId: "gbx", minDriveFraction: E.generatorMinDriveFraction.value, ratedPowerW: E.dcGeneratorW.value },
    { id: "gen.ac", kind: "generator", driveId: "gbx", minDriveFraction: E.generatorMinDriveFraction.value, ratedPowerW: E.acGeneratorW.value },
    { id: "battery", kind: "battery", capacityAh: E.batteryCapacityAh.value, nominalVoltage: E.batteryVoltage.value },
    { id: "pto", kind: "converter", inputBusId: "dc", ratedPowerW: E.ptoConverterW.value, efficiency: 0.8 }
  ],
  buses: [
    { id: "dc", sources: ["gen.dc", "battery"], essentialLoadW: E.dcEssentialLoadW.value, sheddableLoadW: E.dcSheddableLoadW.value, shedOn: ["battery"] },
    { id: "ac", sources: ["gen.ac", "pto"], essentialLoadW: E.acEssentialLoadW.value, sheddableLoadW: E.acSheddableLoadW.value, shedOn: ["pto"] }
  ]
};
