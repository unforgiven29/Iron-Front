/**
 * MiG-29 hydraulics and landing gear on the shared modules (systems/hydraulics,
 * physics/ground-handling). Two systems — main and booster — each with one pump on a DIFFERENT
 * engine (so an engine-out leaves one system), both feeding the primary surfaces; utilities on the
 * main system. No emergency power unit is modelled. Topology and pressure per the GAF T.O.
 * description; pump/actuator sizes estimated (MiG29Data.ts).
 */
import type { LandingGearSpec, WheelSpec } from "../../../physics/ground-handling/LandingGear.js";
import type { HydraulicInstallation } from "../../../systems/hydraulics/HydraulicNetwork.js";
import { MIG29_GEAR as G, MIG29_HYDRAULICS as H } from "./MiG29Data.js";

const circuit = (id: string) => ({ id, nominalPressurePa: H.nominalPressurePa.value, fluidVolumeM3: 0.014, bulkModulusPa: 1.5e9, leakageM3sPerPa: 2.5e-5 / H.nominalPressurePa.value, reliefPressurePa: 1.2 * H.nominalPressurePa.value });
const pump = (id: string, circuitId: string, engineId: string) => ({ id, circuitId, ratedFlowM3s: H.pumpRatedFlowM3s.value, compensatorPressurePa: H.nominalPressurePa.value * 1.03, compensatorBandPa: H.nominalPressurePa.value * 0.06, drive: { kind: "engine" as const, engineId, ratedSpeedFraction: 1 } });
const hingeLoad = { loadFractionAtReference: H.hingeLoadFractionAtReference.value, referenceDynamicPressurePa: H.hingeReferenceDynamicPressurePa.value };
const dual = { chambers: [{ circuitId: "main", displacementM3PerDeg: H.displacementM3PerDeg.value }, { circuitId: "booster", displacementM3PerDeg: H.displacementM3PerDeg.value }], hingeLoad };
const mainOnly = { chambers: [{ circuitId: "main", displacementM3PerDeg: H.displacementM3PerDeg.value }], hingeLoad };

export const MIG29_HYDRAULIC_INSTALLATION: HydraulicInstallation = {
  circuits: [circuit("main"), circuit("booster")],
  pumps: [pump("pump.main", "main", "left"), pump("pump.booster", "booster", "right")],
  accumulators: [
    { id: "acc.main", circuitId: "main", gasVolumeM3: 0.0012, prechargePa: 0.35 * H.nominalPressurePa.value },
    { id: "acc.booster", circuitId: "booster", gasVolumeM3: 0.0012, prechargePa: 0.35 * H.nominalPressurePa.value }
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
  transitTimeS: 8, // GAF T.O.: extension 7–8 s, retraction 9–10 s (single transit time) gearCircuitId: "main", brakeCircuitId: "main", steeringCircuitId: "main",
  maxSinkRateMps: G.maxSinkRateMps.value, restCgHeightM: z - 0.11,
  // Estimated strike points: nose, tail (≈13° tail-strike pitch), wingtips, belly.
  airframePointsBodyM: [[8.5, 0, 0.7], [-8, 0, 0.1], [0, -5.6, 1.1], [0, 5.6, 1.1], [0, 0, 1.3]]
};
