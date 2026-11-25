/**
 * Soviet air-to-air missiles carried by the MiG-29 (9.12/9.13 era): R-27R, R-27ER, R-27T, R-27ET,
 * R-60M, R-73A. Data for the shared missile model (game/src/weapons/missiles/Missile.ts).
 *
 * Sources: BP-29 (MiG-29 combat employment manual) pp. 21–24 — R-27R (253 kg, 60 s guided flight,
 * launch zones fig.17, ППС 50–60 / ЗПС 16–18 km, min 1.2 / 0.5 km) and R-60M (45 kg, 23 s, ±2.5°
 * seeker field, ППС 2.5–12 / ЗПС 1.5–9 km, min 0.6 / 0.3 km, target up to 8 g). Other values are
 * open-source figures (publicly quoted masses/diameters) or ESTIMATED; motors for the R-27R and R-60M
 * are sized so the shared flyout reproduces the BP-29 launch zones (checked in Missiles.test.ts),
 * the others are scaled from them by their published masses. Status is stated per value.
 */
import type { MissileSpec } from "../missiles/Missile.js";
import type { SarhSeekerProfile } from "../../sensors/weapon-seeker/SemiActiveSeeker.js";

const DEG = Math.PI / 180;
const BP = "BP-29";
const OS = "open-source figure (public references), not verified against a primary document";

/**
 * 9B-1101K semi-active radar seeker (R-27R / R-27ER). No primary hardware source is in the project:
 * every value is ESTIMATED from the missile's size and the class of seeker, and labelled so. The
 * illumination it works with is the N019's published one (RLPK slides 7, 56).
 */
export const SEEKER_9B1101K: SarhSeekerProfile = {
  id: "9b-1101k", designation: "9B-1101K",
  aperture: { value: { diameterM: 0.2, taperExponent: 1, farSidelobeFloorDb: 30 }, source: "ESTIMATED: dish ≈0.2 m in the 0.23 m body; gives ≈11° beam at 3 cm", status: "estimated" },
  gimbal: { value: { maxRad: 50 * DEG, rateRadS: 20 * DEG }, source: "ESTIMATED gimbal limit and tracking rate", status: "estimated" },
  noiseFigureDb: { value: 6, source: "ESTIMATED", status: "estimated" },
  lossesDb: { value: 4, source: "ESTIMATED radome, plumbing, processing", status: "estimated" },
  coherentS: { value: 0.02, source: "ESTIMATED Doppler filter integration (50 Hz filters)", status: "estimated" },
  velocityGate: { value: { widthMps: 15, searchSpanMps: 150, searchRateMpsPerS: 300 }, source: "ESTIMATED speed gate and search around the preset Doppler", status: "estimated" },
  falseAlarmProbability: { value: 1e-6, source: "ESTIMATED", status: "estimated" },
  confirmHits: { value: 3, source: "ESTIMATED", status: "estimated" },
  memoryS: { value: 1.5, source: "ESTIMATED track memory", status: "estimated" },
  rearConeRad: { value: 70 * DEG, source: "ESTIMATED rear reference-antenna cone", status: "estimated" },
  monopulseK: { value: 1.6, source: "Typical monopulse slope (Sherman, 'Monopulse Principles')", status: "estimated" }
};

const R27_SARH = { kind: "sarh" as const, gimbalRad: 50 * DEG, profile: SEEKER_9B1101K };

const E = (source: string) => ({ source: `ESTIMATED: ${source}`, status: "estimated" as const });
const PUB = (source: string) => ({ source, status: "published" as const });

/**
 * R-27 airframe (R / T): 4.08 m × 0.23 m (open-source); mid-body "butterfly" control surfaces and
 * fixed tail fins with ailerons. Planform dimensions ESTIMATED from published three-view drawings.
 */
const R27_GEOMETRY = {
  lengthM: 4.08, diameterM: 0.23, noseLengthM: 0.55, nozzleExitAreaM2: 0.022,
  surfaces: [
    { name: "control surfaces", spanM: 0.97, rootChordM: 0.42, tipChordM: 0.12, leadingEdgeM: 1.3, movable: true, thicknessRatio: 0.04 },
    { name: "tail fins", spanM: 0.77, rootChordM: 0.5, tipChordM: 0.25, leadingEdgeM: 3.5, movable: false, thicknessRatio: 0.04 }
  ]
};
/** R-27E (ER / ET): longer motor section, 4.78 m, 0.26 m motor diameter (open-source). */
const R27E_GEOMETRY = { ...R27_GEOMETRY, lengthM: 4.78, diameterM: 0.26, nozzleExitAreaM2: 0.03, surfaces: [R27_GEOMETRY.surfaces[0]!, { ...R27_GEOMETRY.surfaces[1]!, leadingEdgeM: 4.2 }] };

const R27_CONTROL = { maxDeflectionRad: 25 * DEG, rateRadS: 200 * DEG, lagS: 0.02, maxAlphaRad: 25 * DEG };

export const R27R: MissileSpec = {
  id: "r27r", display: "R27R", offBoresight: false,
  geometry: { value: R27_GEOMETRY, ...E("open-source length/diameter; planform from drawings") },
  mass: { value: { launchKg: 253, cgLaunchM: 2.05, cgBurnoutM: 1.85, iyyLaunchKgM2: 350, iyyBurnoutKgM2: 270 }, source: `${BP} p.22: launch mass 253 kg; CG and pitch inertia ESTIMATED (uniform-rod inertia, motor aft)`, status: "published" },
  motor: { value: { ignitionDelayS: 0.15, phases: [{ durationS: 3, thrustVacN: 49500, propellantKg: 58 }, { durationS: 3.5, thrustVacN: 16500, propellantKg: 23 }] }, source: "FITTED with dragFactor to BP-29 fig.17 (10 km head-on ≈35 / tail ≈16 / 1 km head-on ≈15 km → model 35.7 / 14.5 / 16.1); Isp ≈ 240 s vacuum", status: "estimated" },
  dragFactor: { value: 2.5, source: "FITTED with the motor to BP-29 fig.17: installed drag (protuberances, rail lugs, control gaps, interference) over the clean-geometry estimate", status: "estimated" },
  control: { value: R27_CONTROL, ...E("fin limits, actuator rate/lag, max α") },
  autopilot: { value: { omegaRadS: 14, zeta: 0.7 }, ...E("short-period design point") },
  maxG: { value: 25, ...E("") },
  battery: { value: { lifeS: 60 }, ...PUB(`${BP} p.22: guided flight time 60 s (taken as the on-board power life)`) },
  guidance: { value: { navConstant: 4, safeSeparationS: 0.4, midcourse: "inertial+radio" }, ...PUB(`${BP} p.22: 0.4 s safety manoeuvre, then inertial guidance with radio correction until seeker lock`) },
  seeker: { value: R27_SARH, source: "9B-1101K semi-active seeker (SEEKER_9B1101K; values ESTIMATED)", status: "estimated" },
  fuze: { value: { armingDistanceM: 300, radiusM: 15, selfDestruct: true }, ...E("radar proximity fuze; arming after ≈300 m safe separation; self-destruct at end of power") },
  ins: { value: { gyroDriftDegPerMin: 1.0, accelBiasMps2: 0.03 }, ...E("strapdown IMU class for midcourse (gyro drift, accelerometer bias)") },
  warhead: { value: { massKg: 39, lethalRadiusM: 11 }, source: `${OS} (39 kg expanding-rod warhead); lethal radius ESTIMATED`, status: "estimated" }
};

export const R27ER: MissileSpec = {
  ...R27R, id: "r27er", display: "R27ER",
  geometry: { value: R27E_GEOMETRY, ...E("open-source length/diameter; planform from drawings") },
  mass: { value: { launchKg: 350, cgLaunchM: 2.45, cgBurnoutM: 2.1, iyyLaunchKgM2: 640, iyyBurnoutKgM2: 470 }, source: `${OS} (350 kg); CG/inertia ESTIMATED`, status: "estimated" },
  motor: { value: { ignitionDelayS: 0.15, phases: [{ durationS: 4.5, thrustVacN: 72000, propellantKg: 122 }, { durationS: 6, thrustVacN: 21000, propellantKg: 50 }] }, ...E("R-27R fitted motor grown by most of the extra 97 kg (larger motor section)") },
  battery: { value: { lifeS: 75 }, ...E("") }
};

const R27T_SEEKER = { value: { kind: "ir" as const, gimbalRad: 55 * DEG, fovRad: 1.5 * DEG, apertureM: 0.12, neiWm2: 6e-7, lockSnr: 5, lockOnAfterLaunch: false }, ...E("9B-1032 class cooled IR seeker; NEI for ≈15 km tail lock on a fighter at military power") };

export const R27T: MissileSpec = {
  ...R27R, id: "r27t", display: "R27T",
  mass: { value: { ...R27R.mass.value, launchKg: 245 }, source: `${OS} (245 kg)`, status: "estimated" },
  guidance: { value: { ...R27R.guidance.value, midcourse: "inertial" }, ...E("IR version locks before launch; inertial only if the seeker loses the target") },
  seeker: R27T_SEEKER,
  seekerCoolingS: { value: 3, ...E("detector cool-down after selection") }
};

export const R27ET: MissileSpec = {
  ...R27ER, id: "r27et", display: "R27ET",
  mass: { value: { ...R27ER.mass.value, launchKg: 343 }, source: `${OS} (343 kg)`, status: "estimated" },
  guidance: { value: { ...R27ER.guidance.value, midcourse: "inertial" }, ...E("") },
  seeker: R27T_SEEKER,
  seekerCoolingS: { value: 3, ...E("") }
};

export const R60M: MissileSpec = {
  id: "r60m", display: "R60M", offBoresight: false,
  geometry: {
    value: { lengthM: 2.09, diameterM: 0.12, noseLengthM: 0.25, nozzleExitAreaM2: 0.006, surfaces: [
      { name: "canards", spanM: 0.24, rootChordM: 0.12, tipChordM: 0.04, leadingEdgeM: 0.3, movable: true, thicknessRatio: 0.05 },
      { name: "tail fins", spanM: 0.39, rootChordM: 0.25, tipChordM: 0.08, leadingEdgeM: 1.8, movable: false, thicknessRatio: 0.04 }
    ] }, ...E("open-source length/diameter/span; planform from drawings")
  },
  mass: { value: { launchKg: 45, cgLaunchM: 1.0, cgBurnoutM: 0.94, iyyLaunchKgM2: 16.4, iyyBurnoutKgM2: 13 }, source: `${BP} p.24: launch mass 45 kg; CG/inertia ESTIMATED`, status: "published" },
  motor: { value: { ignitionDelayS: 0.05, phases: [{ durationS: 3.5, thrustVacN: 7080, propellantKg: 10.2 }] }, source: "FITTED with dragFactor to BP-29 p.24 rear-hemisphere max 9 km at 10 km (model 9.0); head-on the model reaches 18 km kinematically vs 12 published — the IR seeker's short head-on lock range limits it in play", status: "estimated" },
  dragFactor: { value: 1.5, source: "FITTED with the motor (see motor)", status: "estimated" },
  control: { value: { maxDeflectionRad: 25 * DEG, rateRadS: 300 * DEG, lagS: 0.015, maxAlphaRad: 30 * DEG }, ...E("canard limits") },
  autopilot: { value: { omegaRadS: 20, zeta: 0.7 }, ...E("") },
  maxG: { value: 40, ...E("") },
  battery: { value: { lifeS: 23 }, ...PUB(`${BP} p.24: guided flight time 23 s`) },
  seekerCoolingS: { value: 2, ...E("") },
  guidance: { value: { navConstant: 4, safeSeparationS: 0.3, midcourse: "none" }, ...PUB(`${BP} p.24: passive IR homing from launch`) },
  seeker: { value: { kind: "ir", gimbalRad: 20 * DEG, fovRad: 2.5 * DEG, apertureM: 0.06, neiWm2: 2.2e-6, lockSnr: 5, lockOnAfterLaunch: false }, source: `${BP} p.24: instantaneous field ±2.5°; gimbal and sensitivity ESTIMATED`, status: "estimated" },
  fuze: { value: { armingDistanceM: 150, radiusM: 5, selfDestruct: true }, ...E("optical proximity fuze; arming ≈150 m") },
  warhead: { value: { massKg: 3.5, lethalRadiusM: 3 }, source: `${OS} (3.5 kg rod warhead); lethal radius ESTIMATED`, status: "estimated" }
};

export const R73A: MissileSpec = {
  id: "r73a", display: "R73", offBoresight: true,
  geometry: {
    value: { lengthM: 2.9, diameterM: 0.17, noseLengthM: 0.35, nozzleExitAreaM2: 0.012, surfaces: [
      { name: "canards", spanM: 0.38, rootChordM: 0.16, tipChordM: 0.05, leadingEdgeM: 0.45, movable: true, thicknessRatio: 0.05 },
      { name: "tail fins", spanM: 0.51, rootChordM: 0.3, tipChordM: 0.12, leadingEdgeM: 2.5, movable: false, thicknessRatio: 0.04 }
    ] }, ...E("open-source length/diameter/span; planform from drawings")
  },
  mass: { value: { launchKg: 105, cgLaunchM: 1.45, cgBurnoutM: 1.33, iyyLaunchKgM2: 74, iyyBurnoutKgM2: 58 }, source: `${OS} (105 kg); CG/inertia ESTIMATED`, status: "estimated" },
  motor: { value: { ignitionDelayS: 0.05, phases: [{ durationS: 5, thrustVacN: 12000, propellantKg: 24 }] }, ...E("") },
  control: { value: { maxDeflectionRad: 30 * DEG, rateRadS: 350 * DEG, lagS: 0.015, maxAlphaRad: 40 * DEG, tvcMaxRad: 20 * DEG }, source: `${OS}: canard + gas-dynamic thrust-vector vanes while the motor burns; limits ESTIMATED`, status: "estimated" },
  autopilot: { value: { omegaRadS: 20, zeta: 0.7 }, ...E("") },
  maxG: { value: 40, ...E("") },
  battery: { value: { lifeS: 40 }, ...E("") },
  seekerCoolingS: { value: 2, ...E("") },
  guidance: { value: { navConstant: 4, safeSeparationS: 0.3, midcourse: "none" }, ...E("") },
  seeker: { value: { kind: "ir", gimbalRad: 45 * DEG, fovRad: 2 * DEG, apertureM: 0.08, neiWm2: 1e-6, lockSnr: 5, lockOnAfterLaunch: false }, source: `${OS}: ±45° off-boresight with the helmet sight; sensitivity ESTIMATED`, status: "estimated" },
  fuze: { value: { armingDistanceM: 200, radiusM: 6, selfDestruct: true }, ...E("laser/radar proximity fuze; arming ≈200 m") },
  warhead: { value: { massKg: 7.4, lethalRadiusM: 4 }, source: `${OS} (7.4 kg); lethal radius ESTIMATED`, status: "estimated" }
};

export const SOVIET_AAM = { R27R, R27ER, R27T, R27ET, R60M, R73A } as const;
