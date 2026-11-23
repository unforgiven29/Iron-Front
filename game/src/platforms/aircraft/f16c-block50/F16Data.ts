/**
 * F-16C Block 50 package parameters other than aerodynamic tables, each with provenance.
 *
 * Status vocabulary follows docs/data-standards (technical-parameter schema). Unit conversions
 * are exact; nothing else is derived silently. Anything not available from a cited source is
 * marked "estimated" or "unknown" with a reason, never presented as Block 50 data.
 */

export type ParameterStatus = "primary-published" | "secondary-reported" | "estimated" | "unknown";

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
  idleCorrectedSpeed: { value: 0.72, unit: "fraction", status: "estimated", source: "project estimate", note: "Gives ≈7 % of max thrust at idle" } as Parameter,
  spoolUpTimeConstantS: { value: 1.5, unit: "s", status: "estimated", source: "project estimate" } as Parameter,
  spoolDownTimeConstantS: { value: 1.0, unit: "s", status: "estimated", source: "project estimate" } as Parameter,
  afterburnerLightDelayS: { value: 0.4, unit: "s", status: "estimated", source: "project estimate" } as Parameter,
  afterburnerDetentThrottle: { value: 0.77, unit: "throttle fraction", status: "secondary-reported", source: SL, note: "Throttle position of the MIL/AB break in the source simulation" } as Parameter,
  internalFuelKg: { value: 3175, unit: "kg", status: "primary-published", source: "USAF F-16 fact sheet", note: "Family-level figure; tank layout/feed not modelled" } as Parameter
});

/** Flight-control limits. Gains in F16FlightControls are project-designed, not the F-16 OFP. */
export const F16_FLCS_LIMITS = Object.freeze({
  maxPositiveG: { value: 9, unit: "g", status: "primary-published", source: "USAF F-16 fact sheet ('can withstand up to 9 G's')" } as Parameter,
  maxNegativeG: { value: -3, unit: "g", status: "estimated", source: "project estimate", note: "Commonly cited family limit; Block 50 manual not verified" } as Parameter,
  alphaLimitDeg: { value: 25, unit: "deg", status: "estimated", source: "project estimate", note: "F-16 FLCS AoA limiter is documented in the flight manual family; exact Block 50 value not verified" } as Parameter,
  maxRollRateDegS: { value: 240, unit: "deg/s", status: "estimated", source: "project estimate" } as Parameter
});

/** Every parameter, for listing and audit. */
export function allF16Parameters(): { group: string; name: string; parameter: Parameter }[] {
  const groups = { geometry: F16_GEOMETRY, mass: F16_MASS, actuators: F16_ACTUATORS, engine: F16_ENGINE, flcs: F16_FLCS_LIMITS };
  return Object.entries(groups).flatMap(([group, g]) => Object.entries(g).map(([name, parameter]) => ({ group, name, parameter: parameter as Parameter })));
}
