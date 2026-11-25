/**
 * KOLS (quantum optical locating station) of the OEPrNK-29E — IRST + laser rangefinder profile.
 * Behaviour/performance from BP-29 (MiG-29 combat employment manual, 2nd ed.); hardware ESTIMATED.
 * One value is FITTED: the effective detector D* (detector plus the 1980s processing threshold),
 * chosen so a fighter at maximum dry power seen tail-on against clear sky above 5 km is detected at
 * 12–18 km (BP-29 p.18). The ground-background figure (6–10 km, p.18) then follows from the physics
 * (brighter, more structured background) and is an independent check (MiG29Sensors.test.ts).
 */
import type { IrstProfile } from "../../../../sensors/irst/ScanningIrst.js";
import { DEG } from "../../../../sensors/common/ScanGeometry.js";

const BP = "BP-29";

export const KOLS_PROFILE: IrstProfile = {
  id: "kols.oeprnk29e",
  designation: "KOLS (OEPrNK-29E)",
  apertureDiameterM: { value: 0.09, source: "ESTIMATED from the ball-head size ahead of the windscreen", status: "estimated" },
  opticsTransmission: { value: 0.6, source: "ESTIMATED (window + optics)", status: "estimated" },
  detectorDStar: { value: 4e7, source: "FITTED effective D* (cm·Hz^½/W) to BP-29 p.18 12–18 km sky-background tail detection", status: "fitted" },
  pixelIfovRad: { value: 2e-3, source: "ESTIMATED instantaneous field of one element", status: "estimated" },
  pixelPitchM: { value: 100e-6, source: "ESTIMATED (focal length 50 mm)", status: "estimated" },
  swathRad: { value: 4 * DEG, source: `${BP} p.19 fig.14: 4° scanned strip`, status: "published" },
  scanRateRadS: { value: 100 * DEG, source: "ESTIMATED head scan rate", status: "estimated" },
  barTurnaroundS: { value: 0.1, source: "ESTIMATED", status: "estimated" },
  slewRateRadS: { value: 150 * DEG, source: "ESTIMATED", status: "estimated" },
  clutterContrastFraction: { value: 0.02, source: "ESTIMATED residual background structure after spatial filtering (2 % of background radiance)", status: "estimated" },
  falseAlarmProbability: { value: 1e-7, source: "ESTIMATED per pixel", status: "estimated" },
  trackGimbal: { value: { azMaxRad: 30 * DEG, elMinRad: -15 * DEG, elMaxRad: 30 * DEG }, source: `${BP} p.19 fig.14: autotrack zone ±30° az, −15/+30° el`, status: "published" },
  maxTrackRateRadS: { value: 30 * DEG, source: `${BP} p.21: track limit 30°/s, faster LOS breaks lock`, status: "published" },
  sunExclusionRad: { value: 15 * DEG, source: `${BP} p.21: track lost toward the sun within 15°`, status: "published" },
  acquisitionTimeS: { value: 1.0, source: "ESTIMATED", status: "estimated" },
  trackMemoryS: { value: 1.5, source: "ESTIMATED", status: "estimated" },
  laser: { value: { minRangeM: 200, maxRangeM: 6500, sigmaM: 3 }, source: `${BP} p.18: laser ranging 200 m to 3–6.5 km, error ≤ 3 m`, status: "published" }
};
