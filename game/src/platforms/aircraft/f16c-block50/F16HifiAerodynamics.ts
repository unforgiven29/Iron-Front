/**
 * F-16 high-fidelity aerodynamic assembly and leading-edge flap (LEF) schedule.
 *
 * Assembly follows the University of Minnesota nlplant "hifi" equations over the NASA TP-1538
 * tables in HifiAeroData.ts (see that file for provenance and applicability). Differences from
 * that code, each deliberate and documented:
 * - Aileron normalised by 20° (the tables are increments at 20° aileron); the source code
 *   divides by 21.5°, which mixes the surface limit with the table's reference deflection.
 * - Out-of-table inputs are held at the edge and flagged, not extrapolated.
 * - Deep-stall Cm increment is zero, as in the source (no data).
 */
import { lookupND } from "../../../physics/aerodynamics/Tables.js";
import { F16_GEOMETRY } from "./F16Data.js";
import type { AeroInput, AeroOutput } from "./F16FlightModel.js";
import { HIFI } from "./HifiAeroData.js";

const RAD = 180 / Math.PI;

export interface HifiAeroInput extends AeroInput {
  /** Achieved leading-edge flap deflection, deg (0 = retracted, 25 = full down). */
  readonly lefDeg: number;
  /**
   * Multipliers on control-surface increments (1 = low-speed tables). Used for Mach effects on
   * control power, which the low-speed data does not contain.
   */
  readonly controlEffectiveness?: { readonly pitch: number; readonly roll: number; readonly yaw: number };
}

export function f16HifiAerodynamics(input: HifiAeroInput): AeroOutput {
  const S = F16_GEOMETRY.wingAreaM2.value, b = F16_GEOMETRY.spanM.value, c = F16_GEOMETRY.meanChordM.value;
  const xcgr = F16_GEOMETRY.referenceCgFractionMac.value;
  const a = input.alphaRad * RAD, beta = input.betaRad * RAD;
  const el = input.surfaces.elevatorDeg;
  const dail = input.surfaces.aileronDeg / 20;
  const drud = input.surfaces.rudderDeg / 30;
  const dlef = 1 - Math.max(0, Math.min(25, input.lefDeg)) / 25;
  const V = Math.max(input.trueAirspeedMps, 0.1);
  const [p, q, r] = input.ratesRadps;
  let clamped = false;
  const L = (t: (typeof HIFI)[keyof typeof HIFI], ...x: number[]) => { const v = lookupND(t, x); clamped ||= v.clamped; return v.value; };

  // Base coefficients and their values at zero stabilator (for increments).
  const eff = input.controlEffectiveness ?? { pitch: 1, roll: 1, yaw: 1 };
  // Stabilator: the tables are nonlinear in deflection, so its increment over zero deflection is scaled.
  const Cx0 = L(HIFI.Cx, a, beta, 0), Cz0 = L(HIFI.Cz, a, beta, 0), Cm0 = L(HIFI.Cm, a, beta, 0);
  const Cx = Cx0 + (L(HIFI.Cx, a, beta, el) - Cx0) * eff.pitch;
  const Cz = Cz0 + (L(HIFI.Cz, a, beta, el) - Cz0) * eff.pitch;
  const Cm = Cm0 + (L(HIFI.Cm, a, beta, el) - Cm0) * eff.pitch;
  const Cy = L(HIFI.Cy, a, beta), Cn = L(HIFI.Cn, a, beta, el), Cl = L(HIFI.Cl, a, beta, el);
  const Cn0 = L(HIFI.Cn, a, beta, 0), Cl0 = L(HIFI.Cl, a, beta, 0);
  const CxLef = L(HIFI.Cx_lef, a, beta), CzLef = L(HIFI.Cz_lef, a, beta), CmLef = L(HIFI.Cm_lef, a, beta);
  const CyLef = L(HIFI.Cy_lef, a, beta), CnLef = L(HIFI.Cn_lef, a, beta), ClLef = L(HIFI.Cl_lef, a, beta);
  const dCxLef = CxLef - Cx0, dCzLef = CzLef - Cz0, dCmLef = CmLef - Cm0;
  const dCyLef = CyLef - Cy, dCnLef = CnLef - Cn0, dClLef = ClLef - Cl0;

  // Damping and their LEF increments.
  const cxq = L(HIFI.CXq, a) + L(HIFI.delta_CXq_lef, a) * dlef;
  const czq = L(HIFI.CZq, a) + L(HIFI.delta_CZq_lef, a) * dlef;
  const cmq = L(HIFI.CMq, a) + L(HIFI.delta_CMq_lef, a) * dlef;
  const cyr = L(HIFI.CYr, a) + L(HIFI.delta_CYr_lef, a) * dlef, cyp = L(HIFI.CYp, a) + L(HIFI.delta_CYp_lef, a) * dlef;
  const cnr = L(HIFI.CNr, a) + L(HIFI.delta_CNr_lef, a) * dlef, cnp = L(HIFI.CNp, a) + L(HIFI.delta_CNp_lef, a) * dlef;
  const clr = L(HIFI.CLr, a) + L(HIFI.delta_CLr_lef, a) * dlef, clp = L(HIFI.CLp, a) + L(HIFI.delta_CLp_lef, a) * dlef;

  // Control increments.
  // (The "aileron" tables are TP-1538's combined roll control: flaperons with differential tail at 4:1.)
  const dCyR = (L(HIFI.Cy_r30, a, beta) - Cy) * eff.yaw, dCnR = (L(HIFI.Cn_r30, a, beta) - Cn0) * eff.yaw, dClR = (L(HIFI.Cl_r30, a, beta) - Cl0) * eff.yaw;
  const dCyA0 = L(HIFI.Cy_a20, a, beta) - Cy, dCnA0 = L(HIFI.Cn_a20, a, beta) - Cn0, dClA0 = L(HIFI.Cl_a20, a, beta) - Cl0;
  const dCyA = dCyA0 * eff.roll, dCnA = dCnA0 * eff.roll, dClA = dClA0 * eff.roll;
  const dCyALef = (L(HIFI.Cy_a20_lef, a, beta) - CyLef - dCyA0) * eff.roll;
  const dCnALef = (L(HIFI.Cn_a20_lef, a, beta) - CnLef - dCnA0) * eff.roll;
  const dClALef = (L(HIFI.Cl_a20_lef, a, beta) - ClLef - dClA0) * eff.roll;

  const dCnBeta = L(HIFI.delta_CNbeta, a), dClBeta = L(HIFI.delta_CLbeta, a), dCm = L(HIFI.delta_Cm, a), etaEl = L(HIFI.eta_el, el);

  const c2V = c / (2 * V), b2V = b / (2 * V);
  const cxT = Cx + dCxLef * dlef + c2V * cxq * q;
  const czT = Cz + dCzLef * dlef + c2V * czq * q;
  const cmT = Cm * etaEl + czT * (xcgr - input.cgFractionMac) + dCmLef * dlef + c2V * cmq * q + dCm;
  const cyT = Cy + dCyLef * dlef + (dCyA + dCyALef * dlef) * dail + dCyR * drud + b2V * (cyr * r + cyp * p);
  const cnT = Cn + dCnLef * dlef - cyT * (xcgr - input.cgFractionMac) * (c / b) + (dCnA + dCnALef * dlef) * dail + dCnR * drud
    + b2V * (cnr * r + cnp * p) + dCnBeta * beta;
  const clT = Cl + dClLef * dlef + (dClA + dClALef * dlef) * dail + dClR * drud + b2V * (clr * r + clp * p) + dClBeta * beta;

  const reasons: string[] = [];
  if (clamped) reasons.push("table input outside breakpoints (held at edge)");
  if (input.mach > 0.6) reasons.push(`Mach ${input.mach.toFixed(2)} above the low-speed dataset (no compressibility data)`);
  const qS = input.dynamicPressurePa * S;
  return {
    coefficients: { cx: cxT, cy: cyT, cz: czT, cl: clT, cm: cmT, cn: cnT },
    forceBodyN: [qS * cxT, qS * cyT, qS * czT],
    momentBodyNm: [qS * b * clT, qS * c * cmT, qS * b * cnT],
    outsideEnvelope: reasons.length > 0,
    envelopeReasons: reasons
  };
}

/**
 * LEF schedule used with this dataset (NASA TP-1538 / Stevens & Lewis):
 * δLEF = 1.38·(2s+7.25)/(s+7.25)·α − 9.05·q̄/Ps + 1.45 deg, limited to 0…25°, driven through a
 * rate-limited actuator. The lead-lag filter is integrated exactly per step.
 */
export class LefSchedule {
  private filterState = 0; // first-order state of the lead-lag on alpha (deg)
  private position = 0;
  private initialised = false;
  public static readonly rateLimitDegS = 25;
  public static readonly bandwidthRadS = 7.3;

  public get positionDeg(): number {
    return this.position;
  }

  public reset(): void {
    this.initialised = false;
    this.position = 0;
    this.filterState = 0;
  }

  public step(alphaRad: number, dynamicPressurePa: number, staticPressurePa: number, dt: number): number {
    const alphaDeg = alphaRad * RAD;
    // (2s+7.25)/(s+7.25)·α = 2α − x, with ẋ = 7.25·(α − x).
    if (!this.initialised) this.filterState = alphaDeg;
    this.filterState += (alphaDeg - this.filterState) * (1 - Math.exp(-7.25 * dt));
    const command = Math.max(0, Math.min(25, 1.38 * (2 * alphaDeg - this.filterState) - (9.05 * dynamicPressurePa) / staticPressurePa + 1.45));
    if (!this.initialised) { this.position = command; this.initialised = true; }
    const rate = Math.max(-LefSchedule.rateLimitDegS, Math.min(LefSchedule.rateLimitDegS, (command - this.position) * LefSchedule.bandwidthRadS));
    this.position += rate * dt;
    return this.position;
  }
}
