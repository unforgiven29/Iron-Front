/**
 * F-16C Block 50 reduced-table aerodynamic assembly, F110 cycle design and inertia tensor.
 *
 * Owner: F-16 platform package. These are F-16-specific: the shared physics code knows nothing
 * about them, and the MiG-29 will have its own, structurally independent model.
 * Aero data provenance: see AeroData.ts (provisional, early-F-16 low-speed tables).
 */
import { lookup1D, lookup2D } from "../../../physics/aerodynamics/Tables.js";
import { calibrate, type TurbofanDesign } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import { CM, CN_BETA, CL_BETA, CX, CZ0, DAMPING, DCL_DA, DCL_DR, DCN_DA, DCN_DR, F16_AERO_PROVENANCE } from "./AeroData.js";
import { F16_ENGINE, F16_GEOMETRY, F16_MASS } from "./F16Data.js";

const RAD = 180 / Math.PI;

export interface SurfaceDeflections {
  /** Symmetric stabilator ("elevator"), deg, positive trailing edge down (nose down). */
  readonly elevatorDeg: number;
  /** Differential roll surface command, deg, source sign convention (positive rolls left). */
  readonly aileronDeg: number;
  /** Rudder, deg, source sign convention (positive yaws nose left). */
  readonly rudderDeg: number;
}

export interface AeroInput {
  readonly alphaRad: number;
  readonly betaRad: number;
  readonly trueAirspeedMps: number;
  readonly dynamicPressurePa: number;
  readonly mach: number;
  /** Body rates p, q, r (rad/s). */
  readonly ratesRadps: readonly [number, number, number];
  readonly surfaces: SurfaceDeflections;
  /** CG position as a fraction of MAC. */
  readonly cgFractionMac: number;
}

export interface AeroOutput {
  readonly coefficients: { readonly cx: number; readonly cy: number; readonly cz: number; readonly cl: number; readonly cm: number; readonly cn: number };
  /** Body FRD force (N) and moment (N·m) about the actual CG. */
  readonly forceBodyN: readonly [number, number, number];
  readonly momentBodyNm: readonly [number, number, number];
  /** True when the condition is outside the dataset's validated envelope (values are edge-held). */
  readonly outsideEnvelope: boolean;
  readonly envelopeReasons: readonly string[];
}

/** Total body-axis aero forces and moments, after Stevens & Lewis App. A assembly. */
export function f16Aerodynamics(input: AeroInput): AeroOutput {
  const S = F16_GEOMETRY.wingAreaM2.value, b = F16_GEOMETRY.spanM.value, c = F16_GEOMETRY.meanChordM.value;
  const xcgr = F16_GEOMETRY.referenceCgFractionMac.value;
  const alpha = input.alphaRad * RAD, beta = input.betaRad * RAD;
  const { elevatorDeg: el, aileronDeg, rudderDeg } = input.surfaces;
  const da = aileronDeg / 20, dr = rudderDeg / 30;
  const V = Math.max(input.trueAirspeedMps, 0.1);
  const [p, q, r] = input.ratesRadps;
  let clamped = false;
  const L1 = (t: Parameters<typeof lookup1D>[0], x: number) => { const v = lookup1D(t, x); clamped ||= v.clamped; return v.value; };
  const L2 = (t: Parameters<typeof lookup2D>[0], row: number, col: number) => { const v = lookup2D(t, row, col); clamped ||= v.clamped; return v.value; };

  const cxq = L1(DAMPING.cxq, alpha), cyr = L1(DAMPING.cyr, alpha), cyp = L1(DAMPING.cyp, alpha), czq = L1(DAMPING.czq, alpha);
  const clr = L1(DAMPING.clr, alpha), clp = L1(DAMPING.clp, alpha), cmq = L1(DAMPING.cmq, alpha), cnr = L1(DAMPING.cnr, alpha), cnp = L1(DAMPING.cnp, alpha);
  const cBar2V = c / (2 * V), b2V = b / (2 * V);

  const cx = L2(CX, el, alpha) + cBar2V * cxq * q;
  const cz = L1(CZ0, alpha) * (1 - (beta / 57.3) ** 2) - (0.19 * el) / 25 + cBar2V * czq * q;
  const cm = L2(CM, el, alpha) + cz * (xcgr - input.cgFractionMac) + cBar2V * cmq * q;
  const cy = -0.02 * beta + 0.021 * da + 0.086 * dr + b2V * (cyr * r + cyp * p);
  const sb = Math.sign(beta);
  const cn = L2(CN_BETA, Math.abs(beta), alpha) * sb + L2(DCN_DA, beta, alpha) * da + L2(DCN_DR, beta, alpha) * dr
    + b2V * (cnr * r + cnp * p) - cy * (xcgr - input.cgFractionMac) * (c / b);
  const cl = L2(CL_BETA, Math.abs(beta), alpha) * sb + L2(DCL_DA, beta, alpha) * da + L2(DCL_DR, beta, alpha) * dr + b2V * (clr * r + clp * p);

  const reasons: string[] = [];
  if (clamped) reasons.push("table input outside breakpoints (held at edge)");
  if (input.mach > F16_AERO_PROVENANCE.envelope.machMax) reasons.push(`Mach ${input.mach.toFixed(2)} above the low-speed dataset (no compressibility data)`);
  const qS = input.dynamicPressurePa * S;
  return {
    coefficients: { cx, cy, cz, cl, cm, cn },
    forceBodyN: [qS * cx, qS * cy, qS * cz],
    momentBodyNm: [qS * b * cl, qS * c * cm, qS * b * cn],
    outsideEnvelope: reasons.length > 0,
    envelopeReasons: reasons
  };
}

const F110_DESIGN_BASE: TurbofanDesign = {
  airflowKgS: F16_ENGINE.airflowKgS.value,
  bypassRatio: F16_ENGINE.bypassRatio.value,
  overallPressureRatio: F16_ENGINE.overallPressureRatio.value,
  fanPressureRatio: F16_ENGINE.fanPressureRatio.value,
  fanEfficiency: 0.86, compressorEfficiency: 0.86, turbineEfficiency: 0.89, burnerEfficiency: 0.99, afterburnerEfficiency: 0.9, nozzleVelocityCoefficient: 0.98,
  turbineInletTemperatureK: 1600, afterburnerMaxTemperatureK: 2000,
  idleCorrectedSpeed: F16_ENGINE.idleCorrectedSpeed.value,
  spoolUpTimeConstantS: F16_ENGINE.spoolUpTimeConstantS.value,
  spoolDownTimeConstantS: F16_ENGINE.spoolDownTimeConstantS.value,
  afterburnerLightDelayS: F16_ENGINE.afterburnerLightDelayS.value,
  afterburnerRatePerS: 2
};

/** F110 cycle with design temperatures DERIVED from the published SLS dry/AB ratings. */
export const F110_DESIGN: TurbofanDesign = { ...F110_DESIGN_BASE, ...calibrate(F110_DESIGN_BASE, F16_ENGINE.militaryThrustN.value, F16_ENGINE.maxAfterburnerThrustN.value) };

/** Inertia tensor about the CG in body FRD from the source's Jx, Jy, Jz, Jxz. */
export function f16InertiaTensor(): [[number, number, number], [number, number, number], [number, number, number]] {
  const m = F16_MASS;
  return [[m.ixxKgM2.value, 0, -m.ixzKgM2.value], [0, m.iyyKgM2.value, 0], [-m.ixzKgM2.value, 0, m.izzKgM2.value]];
}
