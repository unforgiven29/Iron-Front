/**
 * MiG-29 (product 9.13 working baseline) package parameters, each with provenance.
 *
 * READ FIRST: docs/platform-reference-program/aircraft/MiG-29-product-9-13.md. No verified
 * product 9.13 aerodynamic database, RD-33 series map or control-system schematic is public.
 * This package is a BOUNDED, CLEARLY LABELLED APPROXIMATION: published family-level geometry
 * and ratings where they exist ("secondary-reported", applicability to 9.13 unverified), and
 * textbook methods (DATCOM/Helmbold, Raymer/Roskam) for everything else ("estimated"). Nothing
 * here comes from the F-16 package or from DCS.
 */

export type ParameterStatus = "primary-published" | "secondary-reported" | "derived" | "estimated" | "unknown";
export interface Parameter<T = number> {
  readonly value: T;
  readonly unit: string;
  readonly status: ParameterStatus;
  readonly source: string;
  readonly note?: string;
}

const FAMILY = "Published MiG-29 family figures (e.g. U.S. Army WEG / reference works); product 9.13 applicability not verified";
const EST = "project estimate";
const P = (value: number, unit: string, status: ParameterStatus, source: string, note?: string): Parameter => ({ value, unit, status, source, ...(note ? { note } : {}) });

export const MIG29_GEOMETRY = Object.freeze({
  wingAreaM2: P(38, "m²", "secondary-reported", FAMILY),
  spanM: P(11.36, "m", "secondary-reported", FAMILY),
  lengthM: P(17.32, "m", "secondary-reported", FAMILY),
  meanChordM: P(38 / 11.36, "m", "derived", "S/b (reference chord for coefficients)"),
  midChordSweepDeg: P(35, "deg", "estimated", EST, "From the ≈42° leading-edge sweep and taper"),
  lerxVortexLiftFactor: P(1.0, "-", "estimated", "Polhamus leading-edge-suction analogy, applied to the LERX/wing", "Size of the nonlinear vortex-lift term")
});

export const MIG29_MASS = Object.freeze({
  emptyMassKg: P(11000, "kg", "secondary-reported", FAMILY, "Family-level empty mass; pilot, gun ammunition and stores not added"),
  internalFuelKg: P(4300 * 0.785, "kg", "derived", "U.S. Army WEG 4,300 L internal fuel × 0.785 kg/L (jet fuel)", "Family-level volume; 9.13 spine tank not verified"),
  /** Radii of gyration (Roskam's non-dimensional estimates for twin-engine fighters). */
  rollGyrationRadius: P(0.25, "fraction of span", "estimated", "Roskam, Airplane Design Part V, fighter class"),
  pitchGyrationRadius: P(0.36, "fraction of length", "estimated", "Roskam, fighter class"),
  yawGyrationRadius: P(0.44, "fraction of (span+length)/2", "estimated", "Roskam, fighter class"),
  cgFractionMac: P(0.25, "MAC fraction", "estimated", EST, "Moment reference of this aero model")
});

/** Aerodynamic model constants (component method; see MiG29Aerodynamics.ts). */
export const MIG29_AERO = Object.freeze({
  zeroLiftDragSubsonic: P(0.021, "-", "estimated", "Raymer equivalent-skin-friction method, twin-engine fighter class"),
  zeroLiftDragPeak: P(0.046, "-", "estimated", "Typical fighter wave-drag rise to M≈1.2 (Raymer)"),
  zeroLiftDragM2: P(0.040, "-", "estimated", EST),
  oswaldEfficiency: P(0.80, "-", "estimated", "Raymer, swept low-aspect-ratio wing"),
  stallAlphaDeg: P(28, "deg", "estimated", EST, "Attached + vortex lift break; flight-manual AoA limits not used"),
  staticMarginSubsonic: P(0.05, "MAC fraction", "estimated", EST, "Conventionally stable; no relaxed stability"),
  staticMarginSupersonic: P(0.20, "MAC fraction", "estimated", "Aerodynamic-centre shift to ≈half chord supersonic (textbook)"),
  stabilatorPowerPerRad: P(-0.65, "Cm per rad", "estimated", "Tail volume × tail lift slope estimate"),
  pitchDampingPerRad: P(-5.0, "Cmq (per rad, c/2V)", "estimated", EST),
  rollPowerPerDeg: P(0.0016, "Cl per deg (ailerons + differential stabilators)", "estimated", EST),
  rollDampingPerRad: P(-0.30, "Clp (per rad, b/2V)", "estimated", EST),
  yawStabilityPerRad: P(0.12, "Cnβ per rad", "estimated", EST, "Twin vertical tails"),
  dihedralEffectPerRad: P(-0.10, "Clβ per rad", "estimated", EST),
  sideForcePerRad: P(-0.80, "CYβ per rad", "estimated", EST),
  yawDampingPerRad: P(-0.30, "Cnr (per rad, b/2V)", "estimated", EST),
  rudderPowerPerDeg: P(-0.0014, "Cn per deg (both rudders, + = nose left)", "estimated", EST),
  speedbrakeDrag: P(0.06, "ΔCD at full", "estimated", EST, "Upper and lower panels"),
  gearDrag: P(0.022, "ΔCD gear down", "estimated", EST),
  lefLiftPerDeg: P(0.004, "ΔCLmax per deg of LEF", "estimated", EST)
});

/** RD-33 (each of two). Family-level ratings only; the series and maps are not established for 9.13. */
const RD33 = "Published RD-33 family figures (Klimov; reference works); series/applicability to 9.13 not verified";
export const MIG29_ENGINE = Object.freeze({
  militaryThrustN: P(49_400, "N", "secondary-reported", RD33, "5,040 kgf dry, sea-level static, uninstalled"),
  maxAfterburnerThrustN: P(81_400, "N", "secondary-reported", RD33, "8,300 kgf, sea-level static, uninstalled"),
  airflowKgS: P(76, "kg/s", "secondary-reported", RD33),
  bypassRatio: P(0.49, "-", "secondary-reported", RD33),
  overallPressureRatio: P(21, "-", "secondary-reported", RD33),
  fanPressureRatio: P(3.1, "-", "estimated", EST),
  lateralOffsetM: P(0.56, "m from centreline", "estimated", EST, "Engine thrust lines; produce asymmetric thrust when one engine is out"),
  installationLossFraction: P(0.05, "-", "estimated", EST),
  idleSpeed: P(0.70, "fraction", "estimated", EST),
  accelRatePerS: P(0.08, "fraction/s", "estimated", EST),
  decelRatePerS: P(0.12, "fraction/s", "estimated", EST),
  afterburnerDetentThrottle: P(0.77, "throttle fraction", "estimated", EST)
});

/** Controls: mechanical linkage with SAU augmentation (GAF T.O. 1F-MIG29-1 describes SAU and electro-hydraulic actuation). */
const GAF = "GAF T.O. 1F-MIG29-1 (system description; 9.13 applicability and all numbers unverified)";
export const MIG29_CONTROLS = Object.freeze({
  stabilatorLimitDeg: P(25, "deg", "estimated", EST),
  aileronLimitDeg: P(25, "deg", "estimated", EST),
  rudderLimitDeg: P(25, "deg", "estimated", EST),
  stabilatorRateDegS: P(45, "deg/s", "estimated", EST),
  aileronRateDegS: P(80, "deg/s", "estimated", EST),
  rudderRateDegS: P(80, "deg/s", "estimated", EST),
  lefMaxDeg: P(20, "deg", "estimated", EST, "Automatic leading-edge flaps"),
  lefAlphaOnsetDeg: P(8, "deg", "estimated", EST),
  pitchGearingDegAtLowQ: P(25, "deg stabilator per full stick", "estimated", GAF, "Mechanical gearing reduced with dynamic pressure (artificial feel / gearing mechanism)"),
  pitchDamperDegPerDegS: P(0.25, "deg per deg/s", "estimated", GAF, "SAU pitch-rate damper"),
  rollDamperDegPerDegS: P(0.05, "deg per deg/s", "estimated", GAF, "SAU roll damper"),
  yawDamperDegPerDegS: P(0.6, "deg per deg/s", "estimated", GAF, "SAU yaw damper"),
  aoaLimiterOnsetDeg: P(24, "deg", "estimated", EST, "Stick-pusher-type AoA limiting (the MiG-29 has an AoA/g limiting system; values not verified)"),
  autoTrimRateDegS: P(1.0, "deg/s", "estimated", EST, "Stands in for the pilot's trim button")
});

export const MIG29_HYDRAULICS = Object.freeze({
  nominalPressurePa: P(21e6, "Pa", "secondary-reported", GAF, "Two systems, main and booster, ≈210 kgf/cm²"),
  pumpRatedFlowM3s: P(1.6e-3, "m³/s", "estimated", EST, "One pump per system, on separate engines"),
  displacementM3PerDeg: P(1.4e-5, "m³/deg", "estimated", EST),
  hingeLoadFractionAtReference: P(0.5, "-", "estimated", EST),
  hingeReferenceDynamicPressurePa: P(60_000, "Pa", "estimated", EST)
});

export const MIG29_GEAR = Object.freeze({
  wheelbaseM: P(3.645, "m", "secondary-reported", FAMILY),
  wheelTrackM: P(3.09, "m", "secondary-reported", FAMILY),
  noseLoadFraction: P(0.10, "-", "estimated", EST),
  contactBelowCgM: P(1.9, "m", "estimated", EST),
  springNPerM: P(500_000, "N/m (main)", "estimated", EST),
  damperNsPerM: P(240_000, "N·s/m (main)", "estimated", EST),
  noseSpringNPerM: P(220_000, "N/m", "estimated", EST),
  noseDamperNsPerM: P(80_000, "N·s/m", "estimated", EST),
  brakeMaxForceN: P(55_000, "N per main wheel", "estimated", EST),
  maxSinkRateMps: P(4.6, "m/s", "estimated", EST)
});
