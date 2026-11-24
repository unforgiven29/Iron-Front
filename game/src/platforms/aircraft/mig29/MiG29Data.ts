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

/** Primary source: German Air Force flight manual, Section 1 (MiG-29G / 9.12-family export airframe). */
export const GAF_TO = "GAF T.O. 1F-MIG29-1, Section 1 (MiG-29G, 9.12 family); applicability to product 9.13 not verified";
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
  emptyMassKg: P(11001, "kg", "primary-published", GAF_TO, "Operating weight including pilot (MiG-29G); the 9.13 spine tank is not included"),
  internalFuelKg: P(14454 - 11001, "kg", "derived", GAF_TO, "Operating weight with full internal fuel (14,454 kg) minus operating weight"),
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
  rollPowerPerDeg: P(0.0014, "Cl per deg of equivalent aileron", "estimated", EST),
  differentialStabilatorRollPerDeg: P(0.0018, "Cl per deg of differential taileron", "estimated", EST),
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
  militaryThrustN: P(5040 * 9.80665, "N", "primary-published", GAF_TO, "5,040 kp MIL, standard day sea-level static, normal power mode (NPM); 4,680 kp in low power mode"),
  maxAfterburnerThrustN: P(8300 * 9.80665, "N", "primary-published", GAF_TO, "8,300 kp max AB, standard day SL static, NPM; min AB 5,600 kp; 7,520 kp in low power mode"),
  idleThrustN: P(180 * 9.80665, "N", "primary-published", GAF_TO, "180 kp idle, SL static"),
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

/** Controls: mechanical linkage, feel-control unit and SAU, from the GAF flight manual where stated. */
export const MIG29_CONTROLS = Object.freeze({
  /** Tailerons: 35° trailing-edge up (nose up) / 15° down; package convention elevator + = nose down. */
  stabilatorNoseUpDeg: P(35, "deg", "primary-published", GAF_TO, "Full authority (feel-unit rod extended)"),
  stabilatorNoseDownDeg: P(15, "deg", "primary-published", GAF_TO),
  /** Feel-control unit (ARU) authority reduction: minimum 17°45' up / 5°45' down near the ground at 470–650 KTAS. */
  stabilatorMinNoseUpDeg: P(17.75, "deg", "primary-published", GAF_TO, "Rod fully retracted"),
  stabilatorMinNoseDownDeg: P(5.75, "deg", "primary-published", GAF_TO, "Rod fully retracted"),
  feelUnitRetractStartKtas: P(215, "KTAS", "primary-published", GAF_TO, "Below 3,000 ft the rod position depends on speed only"),
  feelUnitRetractedKtas: P(470, "KTAS", "primary-published", GAF_TO),
  feelUnitExtendStartKtas: P(650, "KTAS", "primary-published", GAF_TO),
  feelUnitExtendedKtas: P(810, "KTAS", "primary-published", GAF_TO),
  feelUnitLowAltitudeFt: P(3000, "ft", "primary-published", GAF_TO, "Above this, retraction is smaller"),
  feelUnitFullAuthorityFt: P(30000, "ft", "primary-published", GAF_TO, "Always fully extended (full authority) above this"),
  differentialStabilatorDeg: P(5, "deg", "primary-published", GAF_TO, "±5° differential taileron for roll; disabled when the LEF are extended"),
  aileronUpDeg: P(25, "deg", "primary-published", GAF_TO, "Neutral is 5° up"),
  aileronDownDeg: P(15, "deg", "primary-published", GAF_TO),
  aileronLimitDeg: P(20, "deg", "derived", GAF_TO, "Equivalent antisymmetric travel (25 up + 15 down)/2 used by the roll model"),
  aileronReductionAlphaDeg: P(18, "deg", "primary-published", GAF_TO, "Aileron authority reduced above this AoA; reduction law not published (estimated linear to 50 % at 26°)"),
  rudderLimitDeg: P(25, "deg", "primary-published", GAF_TO),
  stabilatorRateDegS: P(45, "deg/s", "estimated", EST),
  aileronRateDegS: P(80, "deg/s", "estimated", EST),
  rudderRateDegS: P(80, "deg/s", "estimated", EST),
  lefMaxDeg: P(20, "deg", "estimated", EST, "LEF deflection angle not given in Section 1; LEF are locked fully in or fully out"),
  lefExtendAlphaDeg: P(8.7, "deg", "primary-published", GAF_TO, "Extend at ≥8.7° AoA below the Mach-sensor switch point"),
  lefRetractAlphaDeg: P(7, "deg", "primary-published", GAF_TO),
  lefMachLimit: P(0.8, "Mach", "primary-published", GAF_TO, "Exact switch point depends on the installed Mach sensor"),
  maxAlphaLefInDeg: P(15, "deg", "primary-published", GAF_TO, "AoA limiter: maximum AoA with LEF retracted"),
  maxAlphaLefOutDeg: P(26, "deg", "primary-published", GAF_TO, "AoA limiter: maximum AoA with LEF extended"),
  kickerGainDegPerDeg: P(3, "deg taileron per deg over the limit", "estimated", EST, "Pitch kicker pushes stick and tailerons nose down; pilot override force (17 kp) not modelled"),
  pitchTrimAuthority: P(0.8, "fraction of authority", "primary-published", GAF_TO, "Trim authority: pitch 80 %, roll 60 %, yaw 60 %"),
  pitchDamperDegPerDegS: P(0.25, "deg per deg/s", "estimated", GAF_TO, "SAU damper mode exists; gain estimated"),
  rollDamperDegPerDegS: P(0.05, "deg per deg/s", "estimated", GAF_TO, "SAU damper mode exists; gain estimated"),
  yawDamperDegPerDegS: P(0.6, "deg per deg/s", "estimated", GAF_TO, "SAU damper mode exists; gain estimated"),
  autoTrimRateDegS: P(1.0, "deg/s", "estimated", EST, "Stands in for the pilot's trim button")
});

export const MIG29_HYDRAULICS = Object.freeze({
  nominalPressurePa: P(21e6, "Pa", "primary-published", GAF_TO, "Main and boost systems, pumps operate between 190 and 220 kp/cm² (mid-band); relief 240; low warning 100"),
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
