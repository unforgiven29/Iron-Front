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

const DEG = Math.PI / 180;
const BP = "BP-29";
const OS = "open-source figure (public references), not verified against a primary document";

/** CD0 vs Mach (body reference area): Fleeman ch.2 slender-missile shape, level FITTED (×1.5) with the motor to BP-29 fig.17 (R-27R). */
const CD_BODY = { mach: [0.5, 0.9, 1.1, 1.5, 2.5, 4.0], cd: [0.53, 0.6, 1.12, 0.93, 0.68, 0.53] };

const R27_SARH = { kind: "sarh" as const, gimbalRad: 50 * DEG, antennaDiameterM: 0.2, noiseFigureDb: 6, bandwidthHz: 400, lockSnrDb: 13 };

const common = {
  responseS: { value: 0.15, source: "ESTIMATED airframe/autopilot time constant", status: "estimated" as const },
  cd0: { value: CD_BODY, source: "ESTIMATED (typical slender missile, Fleeman ch.2)", status: "estimated" as const }
};

export const R27R: MissileSpec = {
  id: "r27r", display: "R27R", ...common,
  launchMassKg: { value: 253, source: `${BP} p.22: launch mass 253 kg`, status: "published" },
  diameterM: { value: 0.23, source: OS, status: "estimated" },
  motor: { value: [{ durationS: 3, thrustN: 30600, propellantKg: 39 }, { durationS: 3.5, thrustN: 10200, propellantKg: 15 }], source: "FITTED boost–sustain motor (Isp ≈ 235 s) with the drag level to BP-29 fig.17: 10 km head-on ≈35 km, tail ≈16 km, 1 km head-on ≈15 km (model: 36.7 / 15.2 / 18.1)", status: "estimated" },
  aero: { value: { k: 0.12, clMax: 9 }, source: "ESTIMATED (body + X-wing lift on body reference area)", status: "estimated" },
  maxG: { value: 25, source: `ESTIMATED; ${BP} p.22 gives target g up to 8`, status: "estimated" },
  guidance: { value: { navConstant: 4, safeSeparationS: 0.4, maxFlightS: 60, midcourse: "inertial+radio" }, source: `${BP} p.22: 0.4 s safety manoeuvre, then inertial guidance with radio correction until seeker lock; 60 s guided flight`, status: "published" },
  seeker: { value: R27_SARH, source: "ESTIMATED semi-active seeker (9B-1101K class): gimbal, antenna, receiver", status: "estimated" },
  fuze: { value: { armingTimeS: 1.0, radiusM: 15 }, source: "ESTIMATED radar proximity fuze", status: "estimated" },
  warhead: { value: { massKg: 39, lethalRadiusM: 11 }, source: `${OS} (39 kg expanding-rod warhead); lethal radius ESTIMATED`, status: "estimated" },
  offBoresight: false
};

export const R27ER: MissileSpec = {
  ...R27R, id: "r27er", display: "R27ER",
  launchMassKg: { value: 350, source: OS, status: "estimated" },
  diameterM: { value: 0.26, source: `${OS} (larger motor section)`, status: "estimated" },
  motor: { value: [{ durationS: 4, thrustN: 40000, propellantKg: 68 }, { durationS: 5, thrustN: 11900, propellantKg: 26 }], source: "ESTIMATED: R-27R motor scaled by the extra 97 kg of the ER", status: "estimated" },
  guidance: { value: { ...R27R.guidance.value, maxFlightS: 75 }, source: "ESTIMATED", status: "estimated" }
};

export const R27T: MissileSpec = {
  ...R27R, id: "r27t", display: "R27T",
  launchMassKg: { value: 245, source: OS, status: "estimated" },
  guidance: { value: { ...R27R.guidance.value, midcourse: "inertial" }, source: "ESTIMATED: IR version locks before launch; inertial only if the seeker loses the target", status: "estimated" },
  seeker: { value: { kind: "ir", gimbalRad: 55 * DEG, fovRad: 1.5 * DEG, apertureM: 0.12, neiWm2: 6e-7, lockSnr: 5, lockOnAfterLaunch: false }, source: "ESTIMATED 9B-1032 class cooled IR seeker; NEI set for ≈15 km tail lock on a fighter at military power", status: "estimated" }
};

export const R27ET: MissileSpec = {
  ...R27ER, id: "r27et", display: "R27ET",
  launchMassKg: { value: 343, source: OS, status: "estimated" },
  guidance: { value: { ...R27ER.guidance.value, midcourse: "inertial" }, source: "ESTIMATED", status: "estimated" },
  seeker: R27T.seeker
};

export const R60M: MissileSpec = {
  id: "r60m", display: "R60M", ...common,
  launchMassKg: { value: 45, source: `${BP} p.24: launch mass 45 kg`, status: "published" },
  diameterM: { value: 0.12, source: OS, status: "estimated" },
  motor: { value: [{ durationS: 3.5, thrustN: 5500, propellantKg: 8.5 }], source: "ESTIMATED single-grain motor; with the fitted drag the model gives 16 km head-on / 7 km tail at 10 km vs BP-29 p.24 12 / 9 km (head-on in reality limited by the seeker; known mismatch)", status: "estimated" },
  aero: { value: { k: 0.1, clMax: 12 }, source: "ESTIMATED (canard dogfight missile)", status: "estimated" },
  maxG: { value: 40, source: "ESTIMATED", status: "estimated" },
  responseS: { value: 0.1, source: "ESTIMATED", status: "estimated" },
  guidance: { value: { navConstant: 4, safeSeparationS: 0.3, maxFlightS: 23, midcourse: "none" }, source: `${BP} p.24: 23 s guided flight; passive IR homing from launch`, status: "published" },
  seeker: { value: { kind: "ir", gimbalRad: 20 * DEG, fovRad: 2.5 * DEG, apertureM: 0.06, neiWm2: 2.2e-6, lockSnr: 5, lockOnAfterLaunch: false }, source: `${BP} p.24: instantaneous field ±2.5°; gimbal and sensitivity ESTIMATED (≈8 km tail lock on a fighter)`, status: "estimated" },
  fuze: { value: { armingTimeS: 0.5, radiusM: 5 }, source: "ESTIMATED optical proximity fuze", status: "estimated" },
  warhead: { value: { massKg: 3.5, lethalRadiusM: 3 }, source: `${OS} (3.5 kg rod warhead); lethal radius ESTIMATED`, status: "estimated" },
  offBoresight: false
};

export const R73A: MissileSpec = {
  id: "r73a", display: "R73", ...common,
  launchMassKg: { value: 105, source: OS, status: "estimated" },
  diameterM: { value: 0.17, source: OS, status: "estimated" },
  motor: { value: [{ durationS: 5, thrustN: 11000, propellantKg: 24 }], source: "ESTIMATED", status: "estimated" },
  aero: { value: { k: 0.1, clMax: 16 }, source: "ESTIMATED (thrust-vectoring + canard control gives very high usable lift)", status: "estimated" },
  maxG: { value: 40, source: "ESTIMATED", status: "estimated" },
  responseS: { value: 0.08, source: "ESTIMATED", status: "estimated" },
  guidance: { value: { navConstant: 4, safeSeparationS: 0.3, maxFlightS: 40, midcourse: "none" }, source: "ESTIMATED", status: "estimated" },
  seeker: { value: { kind: "ir", gimbalRad: 45 * DEG, fovRad: 2 * DEG, apertureM: 0.08, neiWm2: 1e-6, lockSnr: 5, lockOnAfterLaunch: false }, source: `${OS}: ±45° off-boresight with the helmet sight; sensitivity ESTIMATED (≈12 km tail lock)`, status: "estimated" },
  fuze: { value: { armingTimeS: 0.5, radiusM: 6 }, source: "ESTIMATED laser/radar proximity fuze", status: "estimated" },
  warhead: { value: { massKg: 7.4, lethalRadiusM: 4 }, source: `${OS} (7.4 kg); lethal radius ESTIMATED`, status: "estimated" },
  offBoresight: true
};

export const SOVIET_AAM = { R27R, R27ER, R27T, R27ET, R60M, R73A } as const;
