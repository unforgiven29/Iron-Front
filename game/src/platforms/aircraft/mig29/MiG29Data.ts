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
  cgFractionMac: P(0.293, "MAC fraction", "estimated", EST, "Zero-fuel CG, chosen so the CG is ≈25.5 % MAC at the GAF chart weight (13,000 kg, ≈2,000 kg fuel); fuel in the tanks moves the actual CG (MiG29FuelSystem)"),
  /** CG at which the static margins below apply: the GAF appendix charts are drawn for CG 25.5 % MAC. */
  aeroReferenceCgFractionMac: P(0.255, "MAC fraction", "primary-published", GAF_TO, "Fig. A8-13 'CG = 25.5 % MAC'; the fitted lift/drag data refer to this CG")
});

/** Aerodynamic model constants (component method; see MiG29Aerodynamics.ts). */
/**
 * Mach correction on the analytic lift-curve slope (multiplier, linear between nodes; 1 below
 * M 0.85). DERIVED: fitted to the 7 g angle-of-attack curves of GAF T.O. 1F-MIG29-1 fig. A8-13
 * (assumed 13,000 kg). See tests/unit/MiG29Lift.test.ts.
 */
export const MIG29_LIFT_SLOPE_MACH_FACTOR: { m: number; f: number }[] = [{ m: 0.85, f: 1 }, { m: 0.98, f: 1.613 }, { m: 1.17, f: 1.028 }, { m: 1.7, f: 0.844 }];

export const MIG29_AERO = Object.freeze({
  zeroLiftDragSubsonic: P(0.026, "-", "derived", "GAF T.O. 1F-MIG29-1 fig. A8-3 (sustained g, max AB NPM, clean, 13,000 kg): least-squares fit", "Fitted jointly with e and the drag-rise peak; Raymer estimate was 0.021"),
  zeroLiftDragPeak: P(0.055, "-", "derived", "GAF T.O. 1F-MIG29-1 fig. A8-3 (sustained g, max AB NPM, clean, 13,000 kg): least-squares fit", "Raymer typical value was 0.046"),
  zeroLiftDragM2: P(0.040, "-", "estimated", EST),
  oswaldEfficiency: P(0.65, "-", "derived", "GAF T.O. 1F-MIG29-1 fig. A8-3 (sustained g, max AB NPM, clean, 13,000 kg): least-squares fit", "Effective value absorbing trim drag and high-alpha losses; Raymer estimate was 0.80"),
  highLiftDragBreakCl: P(0.9, "CL", "derived", "GAF T.O. 1F-MIG29-1 fig. A8-3 (sustained g, max AB NPM, clean, 13,000 kg): least-squares fit", "Raymer two-segment drag polar form (separation above the break CL)"),
  highLiftDragFactor: P(0.5, "ΔCD per (CL − CLbreak)²", "derived", "GAF T.O. 1F-MIG29-1 fig. A8-3 (sustained g, max AB NPM, clean, 13,000 kg): least-squares fit", "Raymer two-segment drag polar form"),
  zeroLiftAlphaDeg: P(0, "deg", "derived", "GAF fig. A8-13 7 g curves: a non-zero offset worsened the fit at every altitude", "Body AoA at zero lift (camber/incidence)"),
  /** Unsteady separation (Goman–Khrabrov) and vortex breakdown: ESTIMATED from the literature range (no MiG-29 identification published). */
  separationLagChords: P(12, "c/V", "estimated", "Goman & Khrabrov 1994; fighter identifications report τ1 ≈ 10–30 c/V", "Relaxation time of the separation state"),
  separationDelayChords: P(4, "c/V", "estimated", "Goman & Khrabrov 1994", "Delay τ2 applied through dα/dt"),
  vortexBurstOnsetDeg: P(26, "deg", "estimated", EST, "LERX vortex breakdown reaches the wing; set at the AoA limit so the fitted steady lift (fig. A8-13, ≤26°) is unchanged"),
  vortexBurstWidthDeg: P(12, "deg", "estimated", EST),
  vortexLagChords: P(6, "c/V", "estimated", EST, "Burst-point convection lag"),
  buffetOnsetClLowMach: P(1.1, "CL", "estimated", EST, "Shock-buffet onset CL below M0.6"),
  buffetOnsetClM095: P(0.6, "CL", "estimated", EST, "Shock-buffet onset CL at M0.95"),
  groundEffectTailSensitivity: P(0.4, "-", "estimated", "DATCOM ground-effect downwash change; tail volume estimate", "ΔCm = −k(1−φ)CL"),
  stallAlphaDeg: P(20.2, "deg", "derived", "GAF T.O. 1F-MIG29-1 fig. A8-13: 9 g at 26° AoA at M0.54 SL / M0.64 9,840 ft / M0.74 16,400 ft (assumed 13,000 kg)", "Lift-break onset with LEF retracted; +0.2° per degree of LEF; Polhamus vortex factor kept at 1.0"),
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
  idleSpeed: P(0.663, "fraction", "primary-published", GAF_TO, "Fig. 1-4 'Function of the NH speed controller': ground idle ≈66 % NH at CIT 15 °C (NH taken as the cycle's physical speed fraction)"),
  flowSpeedExponent: P(2.96, "-", "derived", GAF_TO, "Generic-map part-speed airflow exponent fitted so the published 66 % NH ground idle gives the published 180 kp idle thrust (open nozzle)"),
  accelRatePerS: P(0.08, "fraction/s", "derived", GAF_TO, "Gives IDLE → MAX AB in ≈5 s in flight; the manual gives 3–7 s"),
  decelRatePerS: P(0.12, "fraction/s", "estimated", EST),
  afterburnerMinSpeedFraction: P(0.74, "fraction of max speed", "primary-published", GAF_TO, "AB will not ignite below 72–76 % RPM during a throttle burst (mid value; NH % taken as the cycle's physical speed fraction)"),
  afterburnerLightDelayS: P(2.5, "s", "primary-published", GAF_TO, "Time for ignition of AB is 2 to 3 sec"),
  limitedPowerMilitaryThrustN: P(4680 * 9.80665, "N", "primary-published", GAF_TO, "LPM: ECU limits max EGT ≈20 °C lower; MIL 4,680 kp"),
  limitedPowerMaxAfterburnerThrustN: P(7520 * 9.80665, "N", "primary-published", GAF_TO, "LPM max AB 7,520 kp"),
  intakeRampOpenKias: P(108, "KIAS", "primary-published", GAF_TO, "Forward ramp retracts to fully open at ≈108 KIAS on takeoff; extends (closes the duct) below 108 KIAS after landing"),
  louverModeRecovery: P(0.93, "pt2/pt0", "estimated", EST, "Total-pressure recovery when breathing through the upper wing-root louvers (ramps closed); not published"),
  nozzleThrustCoefficient: P(0.97, "Cfg", "estimated", EST, "Variable C-D nozzle gross thrust coefficient"),
  nozzleClosedThroatFractionOfMil: P(1.0, "-", "estimated", EST, "Minimum primary area ≈ what sea-level MIL flow needs"),
  nozzleOpenThroatFractionOfMaxAb: P(1.08, "-", "estimated", EST, "Maximum primary area: margin over sea-level max-AB need"),
  nozzleMaxExitAreaRatio: P(1.8, "A9/A8", "estimated", EST, "Mechanical limit of the secondary (divergent) nozzle"),
  afterburnerDetentThrottle: P(0.77, "throttle fraction", "estimated", EST),
  minAfterburnerFraction: P(0.206, "afterburner fraction", "derived", GAF_TO, "Solved so the uninstalled SL static cycle at max speed gives the published min AB thrust, 5,600 kp (NPM). Without it, light AB gave less thrust than MIL at +6–13 % fuel")
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
  kickerPitchRateLeadS: P(0.5, "s", "estimated", EST, "Pitch kicker triggers on AoA, pitch rate or a combination (GAF T.O.): AoA + lead·q reaching the limit"),
  structuralLimitSubsonicG: P(9, "g", "secondary-reported", "Russian MiG-29 manual fig. 6.1 (strength limit)", "Below M 0.85"),
  structuralLimitSupersonicG: P(7, "g", "secondary-reported", "Russian MiG-29 manual fig. 6.1 (strength limit)", "Above M 0.85"),
  pitchTrimAuthority: P(0.8, "fraction of authority", "primary-published", GAF_TO, "Trim authority: pitch 80 %, roll 60 %, yaw 60 %"),
  pitchDamperDegPerDegS: P(0.25, "deg per deg/s", "estimated", GAF_TO, "SAU damper mode exists; gain estimated"),
  rollDamperDegPerDegS: P(0.05, "deg per deg/s", "estimated", GAF_TO, "SAU damper mode exists; gain estimated"),
  yawDamperDegPerDegS: P(0.6, "deg per deg/s", "estimated", GAF_TO, "SAU damper mode exists; gain estimated"),
  autoTrimRateDegS: P(1.0, "deg/s", "estimated", EST, "Stands in for the pilot's trim button")
});

export const MIG29_HYDRAULICS = Object.freeze({
  reliefPressurePa: P(24e6, "Pa", "primary-published", GAF_TO, "Relief valves open at 240 kp/cm²"),
  accumulatorPrechargePa: P(8e6, "Pa", "primary-published", GAF_TO, "Both accumulators charged with nitrogen at 80 kp/cm²"),
  lowPressurePa: P(10e6, "Pa", "primary-published", GAF_TO, "Emergency pump auto-start (both systems) and low-pressure threshold, 100 kp/cm²"),
  emergencyPumpMinEngineSpeed: P(0.85, "fraction", "primary-published", GAF_TO, "Emergency pump supports basic control at an RPM of both engines of at least 85 % (fuel-pressure driven)"),
  emergencyPumpFlowFraction: P(0.15, "fraction of a main pump", "estimated", EST, "'Delivery rate permits only severely degraded aircraft control'"),
  gearboxEngineSelectMargin: P(0.07, "fraction", "primary-published", GAF_TO, "GBX normally driven by the RH engine; LH engine drives it if its RPM exceeds RH by 7 % or more (freewheel clutch)"),
  nominalPressurePa: P(21e6, "Pa", "primary-published", GAF_TO, "Main and boost systems, pumps operate between 190 and 220 kp/cm² (mid-band); relief 240; low warning 100"),
  pumpRatedFlowM3s: P(1.6e-3, "m³/s", "estimated", EST, "One pump per system, on separate engines"),
  displacementM3PerDeg: P(1.4e-5, "m³/deg", "estimated", EST),
  hingeLoadFractionAtReference: P(0.5, "-", "estimated", EST),
  hingeReferenceDynamicPressurePa: P(60_000, "Pa", "estimated", EST),
  pressureLimiterPa: P(13e6, "Pa", "primary-published", GAF_TO, "Main-system pressure limiter and isolation valve: below 130 kp/cm² it disconnects all systems except the flight controls (one chamber of tailerons, ailerons, rudders, flaps/LEF, AOA limiter)"),
  pumpMinPressurePa: P(19e6, "Pa", "primary-published", GAF_TO, "Pumps operate between 190 and 220 kp/cm²"),
  speedbrakeBlowBackKias: P(540, "kt", "primary-published", GAF_TO, "Speedbrake blow-back protects actuators and surfaces above 540 KIAS"),
  reservoirM3: P(0.008, "m³", "estimated", EST, "Reservoirs inside fuel tank 3, air-pressurised, two-chamber (feed at negative g); contents not given"),
  heatCapacityJPerK: P(4e4, "J/K", "estimated", EST),
  fuelCoolingWPerK: P(600, "W/K", "estimated", EST, "Reservoirs in fuel tank 3: 'adequate cooling by heat exchange with fuel'; no thermal bypass")
});

export const MIG29_PNEUMATICS = Object.freeze({
  mainChargePa: P(15e6, "Pa", "primary-published", GAF_TO, "Main nitrogen system bottles charged to 150 kp/cm²; not charged in flight"),
  emergencyChargePa: P(15e6, "Pa", "primary-published", GAF_TO, "Emergency nitrogen system bottles charged to 150 kp/cm²; check valves prevent crossfeed with the main system"),
  chuteChargePa: P(6.3e6, "Pa", "primary-published", GAF_TO, "Additional bottle near the drag-chute compartment, 63 kp/cm²"),
  mainVolumeM3: P(0.012, "m³", "estimated", EST, "Main bottle group total water volume; not given in the GAF T.O."),
  emergencyVolumeM3: P(0.006, "m³", "estimated", EST, "Emergency bottle group total water volume; not given"),
  chuteVolumeM3: P(0.002, "m³", "estimated", EST, "Drag-chute bottle water volume; not given"),
  brakePressurePa: P(3e6, "Pa", "estimated", EST, "Normal wheel-brake regulated pressure for full braking; not given"),
  brakeStrokeVolumeM3: P(3e-4, "m³ at brake pressure", "estimated", EST, "Gas per full application, both main wheels"),
  reservoirPressurePa: P(0.25e6, "Pa", "estimated", EST, "Hydraulic reservoir headspace pressurisation (regulated from the main system); value not given"),
  reservoirMakeupM3s: P(2e-6, "m³/s at reservoir pressure", "estimated", EST, "Headspace make-up/venting flow"),
  emergencyGearMinPa: P(6e6, "Pa", "estimated", EST, "Emergency-system pressure for full-rate emergency extension"),
  emergencyNoseTransitS: P(4, "s", "estimated", EST, "Pneumatic nose-gear extension time"),
  emergencyMainTransitS: P(6, "s", "estimated", EST, "Pneumatic main-gear extension time"),
  emergencyGearFlowM3s: P(4e-4, "m³/s at supply pressure", "estimated", EST, "Gas flow while an emergency-extension jack is moving"),
  gasThermalTimeConstantS: P(600, "s", "estimated", EST, "Bottle gas temperature relaxation towards ambient")
});

export const MIG29_ELECTRICAL = Object.freeze({
  acGeneratorW: P(30_000, "VA", "primary-published", GAF_TO, "Three-phase 115/200 V 400 Hz, constant-speed drive on the GBX"),
  dcGeneratorW: P(12_000, "W", "primary-published", GAF_TO, "28.5 V, 400 A, on the GBX"),
  ptoConverterW: P(1_500, "VA", "primary-published", GAF_TO, "DC/AC converter PTO, minimum 1.5 kVA at 115 V"),
  generatorMinDriveFraction: P(0.55, "fraction", "primary-published", GAF_TO, "The engine fault detection unit engages the AC generator when NH exceeds 55 %"),
  batteryVoltage: P(27.6, "V", "primary-published", GAF_TO, "Two silver-zinc batteries, nominal 27.6 V (≥22 V at 200 A); not charged by the generator"),
  batteryCapacityAh: P(90, "Ah (both)", "secondary-reported", "HBL Power Systems aircraft battery listing (silver-zinc 15SCS-45 for MiG-29): 45 Ah each, two batteries", "GAF T.O. gives the type (silver-zinc) and voltage only"),
  transformerW: P(1_500, "VA", "primary-published", GAF_TO, "Transformer: three-phase 36 VAC, maximum 1.5 kVA"),
  pto36W: P(1_000, "VA", "primary-published", GAF_TO, "PTO: three-phase 36 VAC at a minimum of 1 kVA"),
  csdDisconnectRpm: P(14_300, "rpm", "primary-published", GAF_TO, "CSD output shaft 12,000 rpm; automatic disconnect at 14,300–14,500 rpm (465–480 Hz), manual if CSD oil pressure < 1 MPa or oil hot"),
  acEssentialLoadW: P(1_200, "W", "estimated", EST, "Flight-essential AC consumers (must fit the PTO)"),
  acSheddableLoadW: P(14_000, "W", "estimated", EST, "Shed on PTO: INS heaters, radar/sight, IRST/LRF/HMS, probe/windshield heaters, AFCS, armament, IFF encoder (GAF list)"),
  dcEssentialLoadW: P(2_500, "W", "estimated", EST),
  dcSheddableLoadW: P(3_500, "W", "estimated", EST, "Shed on batteries: damping (SAU), NB, … (VIWAS 'Dämpfung aus, NB aus')")
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
