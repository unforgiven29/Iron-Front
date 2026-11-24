/**
 * F-16C Block 50 landing gear for the shared ground-handling model (physics/ground-handling).
 * Values from F16_GEAR (track/wheelbase published; the rest estimated). Gear actuation, brakes and
 * nose-wheel steering are on hydraulic System B (flight manual, via the repo hydraulics dossier).
 */
import type { LandingGearSpec, WheelSpec } from "../../../physics/ground-handling/LandingGear.js";
import { F16_GEAR as G } from "./F16Data.js";

const mainX = -G.wheelbaseM.value * G.noseLoadFraction.value;
const noseX = mainX + G.wheelbaseM.value;
const z = G.contactBelowCgM.value;
const tyre = { rollingFriction: G.rollingFriction.value, peakFriction: G.peakFriction.value, corneringStiffnessPerRad: G.corneringStiffnessPerRad.value };
const main = (id: string, y: number): WheelSpec => ({ id, contactPointBodyM: [mainX, y, z], strokeM: G.mainStrokeM.value, springNPerM: G.mainSpringNPerM.value, damperNsPerM: G.mainDamperNsPerM.value, ...tyre, brake: { maxForceN: G.brakeMaxForceN.value, antiSkidFraction: G.antiSkidFraction.value } });

export const F16_LANDING_GEAR: LandingGearSpec = {
  wheels: [
    { id: "nose", contactPointBodyM: [noseX, 0, z], strokeM: G.noseStrokeM.value, springNPerM: G.noseSpringNPerM.value, damperNsPerM: G.noseDamperNsPerM.value, ...tyre, steering: { maxAngleDeg: G.nwsMaxAngleDeg.value, rateDegS: G.nwsRateDegS.value } },
    main("left", -G.wheelTrackM.value / 2),
    main("right", G.wheelTrackM.value / 2)
  ],
  transitTimeS: G.transitTimeS.value,
  // Fig 1-33: gear behind the LG isolation valve, brakes on the brake/JFS accumulator branch, NWS on B.
  gearCircuitId: "B.lg", brakeCircuitId: "B.brakes", steeringCircuitId: "B",
  maxSinkRateMps: G.maxSinkRateMps.value,
  restCgHeightM: z - 0.11,
  // Estimated airframe strike points: nose, ventral exhaust/tail (≈14.5° tail-strike pitch, struts extended —
  // above the 13° AoA routinely flown at touchdown and the 13° aerobraking pitch of F-16 procedures), wingtips (≈13° bank), belly.
  airframePointsBodyM: [[7.6, 0, 0.6], [-6.8, 0, 0.116], [0.5, -4.7, 0.9], [0.5, 4.7, 0.9], [0, 0, 1.2]]
};

/** CG height above flat ground with the gear down, at rest (static strut compression included). */
export const F16_REST_CG_HEIGHT_M = z - 0.11;
