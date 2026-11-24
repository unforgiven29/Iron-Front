/**
 * F-16C Block 50 package parameters other than aerodynamic tables, each with provenance.
 *
 * Status vocabulary follows docs/data-standards (technical-parameter schema). Unit conversions
 * are exact; nothing else is derived silently. Anything not available from a cited source is
 * marked "estimated" or "unknown" with a reason, never presented as Block 50 data.
 */

export type ParameterStatus = "primary-published" | "secondary-reported" | "derived" | "estimated" | "unknown";

export interface Parameter<T = number> {
  readonly value: T;
  readonly unit: string;
  readonly status: ParameterStatus;
  readonly source: string;
  readonly note?: string;
}

const FT = 0.3048;
const SLUG = 14.593902937;
const SLUG_FT2 = SLUG * FT * FT;
const LBF = 4.4482216152605;

const SL = "Stevens & Lewis (2003) App. A F-16 model, from NASA TP-1538 (1979)";
const SL_NOTE = "Early F-16 test configuration; not Block 50 specific";

export const F16_GEOMETRY = Object.freeze({
  wingAreaM2: { value: 300 * FT * FT, unit: "m²", status: "secondary-reported", source: SL, note: "300 ft² reference area" } as Parameter,
  spanM: { value: 30 * FT, unit: "m", status: "secondary-reported", source: SL, note: "30 ft reference span" } as Parameter,
  meanChordM: { value: 11.32 * FT, unit: "m", status: "secondary-reported", source: SL, note: "11.32 ft mean aerodynamic chord" } as Parameter,
  referenceCgFractionMac: { value: 0.35, unit: "MAC fraction", status: "secondary-reported", source: SL, note: "Moment reference of the aero tables" } as Parameter
});

export const F16_MASS = Object.freeze({
  massKg: { value: (20500 / 32.174) * SLUG, unit: "kg", status: "secondary-reported", source: SL, note: `20,500 lbf test weight; ${SL_NOTE}. Fixed: fuel burn does not yet change mass or inertia.` } as Parameter,
  ixxKgM2: { value: 9496 * SLUG_FT2, unit: "kg·m²", status: "secondary-reported", source: SL, note: SL_NOTE } as Parameter,
  iyyKgM2: { value: 55814 * SLUG_FT2, unit: "kg·m²", status: "secondary-reported", source: SL, note: SL_NOTE } as Parameter,
  izzKgM2: { value: 63100 * SLUG_FT2, unit: "kg·m²", status: "secondary-reported", source: SL, note: SL_NOTE } as Parameter,
  ixzKgM2: { value: 982 * SLUG_FT2, unit: "kg·m²", status: "secondary-reported", source: SL, note: "Product of inertia Jxz (body FRD); tensor entry is -Jxz" } as Parameter,
  emptyMassKg: { value: 8936, unit: "kg", status: "primary-published", source: "USAF F-16 fact sheet ('weight without fuel', 19,700 lb)", note: "Family-level figure; pilot, gun ammunition and stores are not added. Total mass = this + fuel." } as Parameter,
  cgFractionMac: { value: 0.35, unit: "MAC fraction", status: "secondary-reported", source: SL, note: "Nominal CG used for the published trim checks" } as Parameter,
  engineAngularMomentum: { value: Number.NaN, unit: "kg·m²/s", status: "unknown", source: "none", note: "F110-GE-129 rotor angular momentum not publicly available; gyroscopic engine coupling not modelled" } as Parameter
});

/** Surface limits and first-order actuator model used by the source simulation. */
export const F16_ACTUATORS = Object.freeze({
  elevatorLimitDeg: { value: 25, unit: "deg", status: "secondary-reported", source: SL } as Parameter,
  aileronLimitDeg: { value: 21.5, unit: "deg", status: "secondary-reported", source: SL } as Parameter,
  rudderLimitDeg: { value: 30, unit: "deg", status: "secondary-reported", source: SL } as Parameter,
  elevatorRateDegS: { value: 60, unit: "deg/s", status: "secondary-reported", source: SL } as Parameter,
  aileronRateDegS: { value: 80, unit: "deg/s", status: "secondary-reported", source: SL } as Parameter,
  rudderRateDegS: { value: 120, unit: "deg/s", status: "secondary-reported", source: SL } as Parameter,
  bandwidthRadS: { value: 20.2, unit: "rad/s", status: "secondary-reported", source: SL, note: "First-order actuator lag; real ISA hydraulics not modelled" } as Parameter
});

/**
 * F110-GE-129 engine cycle inputs for the shared mixed-flow turbofan model
 * (physics/propulsion/MixedFlowTurbofan.ts). Published ratings and cycle figures are used where
 * public; component efficiencies, fan pressure ratio and dynamics are estimates for the engine
 * class; turbine-inlet and afterburner temperatures are DERIVED by calibrating sea-level-static
 * thrust to the published dry and afterburning ratings.
 */
const PUBLIC_F110 = "Public F110-GE-129 references (GE Aerospace product data; widely reported); verify against an engine manual";
export const F16_ENGINE = Object.freeze({
  maxAfterburnerThrustN: { value: 29000 * LBF, unit: "N", status: "primary-published", source: "Shaw AFB F-16C fact sheet (Block 50/52)", note: "'over 29,000 lbf' afterburning, sea-level static; lower bound used" } as Parameter,
  militaryThrustN: { value: 17000 * LBF, unit: "N", status: "secondary-reported", source: PUBLIC_F110, note: "Dry (MIL) sea-level static rating" } as Parameter,
  airflowKgS: { value: 270 * 0.45359237, unit: "kg/s", status: "secondary-reported", source: PUBLIC_F110, note: "≈270 lb/s design airflow" } as Parameter,
  bypassRatio: { value: 0.76, unit: "-", status: "secondary-reported", source: PUBLIC_F110 } as Parameter,
  overallPressureRatio: { value: 30.7, unit: "-", status: "secondary-reported", source: PUBLIC_F110 } as Parameter,
  fanPressureRatio: { value: 3.0, unit: "-", status: "estimated", source: "project estimate", note: "Sensitivity checked: 3.0 vs 3.2 changes thrust/TSFC by <1 %" } as Parameter,
  componentEfficiencies: { value: Number.NaN, unit: "-", status: "estimated", source: "project estimate", note: "fan 0.86, compressor 0.86, turbine 0.89, burner 0.99, AB 0.90, nozzle Cv 0.98 — typical for the class" } as Parameter,
  rotorTimeConstantS: { value: 0.3, unit: "s", status: "estimated", source: "project estimate", note: "Spool inertia lag to a FADEC speed demand; the FADEC acceleration schedule dominates the throttle response" } as Parameter,
  afterburnerDetentThrottle: { value: 0.77, unit: "throttle fraction", status: "secondary-reported", source: SL, note: "Throttle position of the MIL/AB break in the source simulation" } as Parameter,
  inletSubsonicRecovery: { value: 0.98, unit: "-", status: "estimated", source: "project estimate", note: "Fixed pitot (normal-shock) inlet; supersonic recovery is exact normal-shock gas dynamics" } as Parameter,
  maxCompressorExitTemperatureK: { value: 1020, unit: "K", status: "derived", source: "Calibrated: the one value that reproduces both published points — sea-level max ≈ M1.2 and 40,000 ft max sustained ≈ M1.89 (F-16 performance references)", note: "Real F110 T3 limit not public. Sensitivity (with C-D nozzle, installation and Reynolds losses): 980 K → SL M1.21 / 40k M1.81; 1000 K → M1.24 / M1.84; 1020 K → M1.27 / M1.87 (chosen)" } as Parameter,
  installationLossFraction: { value: 0.05, unit: "fraction of gross thrust", status: "estimated", source: "project estimate", note: "Typical fighter installation losses (bleed, power extraction, spillage); applied in calibration so the SLS rating is met installed" } as Parameter,
  reynoldsEfficiencyLoss: { value: 0.06, unit: "-", status: "estimated", source: "project estimate", note: "Component efficiency falls by up to ~6 % at very low Reynolds-number index (high altitude); typical magnitude for small turbofans" } as Parameter,
  nozzleThrustCoefficient: { value: 0.98, unit: "-", status: "estimated", source: "project estimate", note: "Gross thrust coefficient Cfg of a fighter C-D nozzle (friction, divergence, leakage); typical 0.97–0.99" } as Parameter,
  nozzleClosedThroatFractionOfMil: { value: 0.9, unit: "fraction of the MIL throat area", status: "estimated", source: "project estimate", note: "Closed (minimum) throat relative to the area the cycle needs at sea-level-static MIL. Real F110 areas not public. Sets how much a closed nozzle (SEC) costs" } as Parameter,
  nozzleOpenThroatFractionOfMaxAb: { value: 1.3, unit: "fraction of the max-AB throat area", status: "estimated", source: "project estimate", note: "Fully open throat relative to the area the cycle needs at sea-level-static max afterburner" } as Parameter,
  nozzleExitAreaRatioClosed: { value: 1.1, unit: "A9/A8", status: "estimated", source: "project estimate", note: "Linked C-D exit/throat ratio at the closed position (dry power)" } as Parameter,
  nozzleExitAreaRatioOpen: { value: 1.3, unit: "A9/A8", status: "estimated", source: "project estimate", note: "Linked C-D exit/throat ratio fully open (afterburner)" } as Parameter,
  internalFuelKg: { value: 3175, unit: "kg", status: "primary-published", source: "USAF F-16 fact sheet", note: "Family-level figure; tank layout/feed not modelled" } as Parameter
});

/**
 * F110-GE-129 engine control. The -129 has a digital electronic primary control with a
 * hydromechanical secondary (backup) control, selected in the cockpit with the ENG CONT switch
 * (PRI/SEC). Schedules and limits below are estimates for the engine class unless noted; the
 * F110 control laws are not public.
 */
export const F16_ENGINE_CONTROL = Object.freeze({
  idleSpeed: { value: 0.72, unit: "fraction of design speed", status: "estimated", source: "project estimate", note: "Gives ≈7 % of max thrust at sea-level idle" } as Parameter,
  maxCorrectedSpeed: { value: 1.05, unit: "fraction", status: "estimated", source: "project estimate", note: "Corrected fan-speed limit" } as Parameter,
  accelRatePerS: { value: 0.08, unit: "fraction/s", status: "estimated", source: "project estimate", note: "Idle → MIL in ≈3.5 s; fighter engines are typically specified idle→MIL in about 4–5 s" } as Parameter,
  decelRatePerS: { value: 0.15, unit: "fraction/s", status: "estimated", source: "project estimate", note: "Limited by lean-blowout margin" } as Parameter,
  turbineTemperatureMarginK: { value: 30, unit: "K", status: "estimated", source: "project estimate", note: "TIT limit = calibrated MIL turbine inlet temperature + this margin. Real F110 FTIT limits are not used: this model's TIT is a generic-map quantity, not measured FTIT" } as Parameter,
  minBurnerPressurePa: { value: 150_000, unit: "Pa", status: "estimated", source: "project estimate", note: "Raises idle at very high altitude (≈19 km and above at low Mach with this generic map) to keep combustion stable" } as Parameter,
  afterburnerMinSpeedFraction: { value: 0.97, unit: "fraction of scheduled MIL speed", status: "estimated", source: "project estimate" } as Parameter,
  afterburnerMinBurnerPressurePa: { value: 100_000, unit: "Pa", status: "estimated", source: "project estimate", note: "Light-off envelope; blocks AB light only at very high altitude/low speed" } as Parameter,
  afterburnerLightDelayS: { value: 0.4, unit: "s", status: "estimated", source: "project estimate" } as Parameter,
  afterburnerRatePerS: { value: 2, unit: "1/s", status: "estimated", source: "project estimate", note: "Zone sequencing simplified to a rate" } as Parameter,
  secNozzleClosed: { value: 1, unit: "boolean", status: "secondary-reported", source: "Public F-16 checklists (ENG CONT – SEC: nozzle closes, NOZ POS < 5 %)", note: "SEC thrust loss then follows from the closed throat via the FADEC nozzle-area limiter; the real SEC thrust is not public" } as Parameter,
  secAccelRatePerS: { value: 0.05, unit: "fraction/s", status: "estimated", source: "project estimate", note: "Hydromechanical backup control: slower, conservative schedule" } as Parameter,
  secAfterburnerInhibited: { value: 1, unit: "boolean", status: "secondary-reported", source: "Widely reported F-16 SEC-mode behaviour (afterburner inhibited); Block 50 flight manual not verified" } as Parameter
});

/** Speedbrakes: split fuselage-mounted panels (F-16 manual family). */
export const F16_SPEEDBRAKE = Object.freeze({
  maxDeflectionDeg: { value: 60, unit: "deg", status: "secondary-reported", source: "F-16 flight manual family (60° max; 43° with gear down)", note: "Gear-down limit not modelled (no gear yet)" } as Parameter,
  rateDegS: { value: 30, unit: "deg/s", status: "estimated", source: "project estimate", note: "≈2 s full travel" } as Parameter,
  dragCoefficientAtFull: { value: 0.075, unit: "ΔCD on S_ref", status: "estimated", source: "project estimate", note: "Two ~1 m² plates at 60° (flat-plate CD≈1.2 on projected area) / 27.9 m² wing; no public F-16 speedbrake drag data" } as Parameter
});

/** Flight-control limits. Gains in F16FlightControls are project-designed, not the F-16 OFP. */
export const F16_FLCS_LIMITS = Object.freeze({
  maxPositiveG: { value: 9, unit: "g", status: "primary-published", source: "USAF F-16 fact sheet ('can withstand up to 9 G's')" } as Parameter,
  maxNegativeG: { value: -3, unit: "g", status: "estimated", source: "project estimate", note: "Commonly cited family limit; Block 50 manual not verified" } as Parameter,
  alphaLimitDeg: { value: 25, unit: "deg", status: "estimated", source: "project estimate", note: "F-16 FLCS AoA limiter is documented in the flight manual family; exact Block 50 value not verified" } as Parameter,
  maxRollRateDegS: { value: 308, unit: "deg/s", status: "secondary-reported", source: "NASA TP-1538 (Nguyen et al., 1979) p. 34 and fig. 64: roll-rate command system, maximum 308°/s", note: "Simulator control system of an F-16-class configuration, not the Block 50 OFP" } as Parameter
});

/** Every parameter, for listing and audit. */
export function allF16Parameters(): { group: string; name: string; parameter: Parameter }[] {
  const groups = { geometry: F16_GEOMETRY, mass: F16_MASS, actuators: F16_ACTUATORS, engine: F16_ENGINE, engineControl: F16_ENGINE_CONTROL, speedbrake: F16_SPEEDBRAKE, flcs: F16_FLCS_LIMITS };
  return Object.entries(groups).flatMap(([group, g]) => Object.entries(g).map(([name, parameter]) => ({ group, name, parameter: parameter as Parameter })));
}
