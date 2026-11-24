/**
 * F-16 compressibility and supersonic corrections layered on the low-speed NASA TP-1538 tables.
 *
 * DATA (M >= 1.6): NASA TP-3355 (Fox & Forrest, 1993), "Supersonic Aerodynamic Characteristics
 * of an Advanced F-16 Derivative Aircraft Configuration", F-16C model (1/15 scale, S = 300 ft^2
 * full-scale reference, CG 0.35c), figures 30–31, read from the published plots (≈ ±3 % reading
 * uncertainty):
 *   CDmin: M1.6 0.051, M1.8 0.050, M2.0 0.0485, M2.16 0.048
 *   CLα (per deg): M1.6 0.068, M1.8 0.058, M2.0 0.052, M2.16 0.048
 *   M1.6 polar: CD ≈ 0.051 at CL 0, ≈ 0.112 at CL 0.5 → lift-dependent factor K ≈ 0.24
 *   M1.6 pitching moment at 0.35c: dCm/dCL ≈ −0.255 (aerodynamic centre ≈ 25 % MAC aft of CG)
 * The wind-tunnel model is an F-16C configuration but not a verified Block 50 production fit.
 *
 * ESTIMATED: the transonic region (M 0.85–1.6) has no public F-16 data. It is a smooth
 * interpolation between the low-speed tables (M ≈ 0.2) and the M 1.6 data, with drag rise
 * starting at M 0.85 and reaching the supersonic level by M 1.2. Subsonic lift-curve-slope growth
 * uses the DATCOM/Helmbold relation for AR 3.0, Λ(c/2) ≈ 32° (planform values: estimated).
 * Control-surface effectiveness with Mach (ESTIMATED, no public F-16 data): each control's
 * increment is scaled by the same lift-curve-slope ratio as the wing (liftScale). The all-moving
 * stabilator and the flaperons are lifting surfaces whose effectiveness follows their own
 * lift-curve slope: rising subsonic (Prandtl–Glauert/Helmbold), and falling supersonic in
 * proportion to the measured TP-3355 trend (≈ 1/√(M²−1)).
 */
import { f16HifiAerodynamics } from "./F16HifiAerodynamics.js";

const DEG = Math.PI / 180;

interface Point { readonly m: number; readonly v: number }
const interp = (pts: readonly Point[], m: number): number => {
  if (m <= (pts[0] as Point).m) return (pts[0] as Point).v;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Point, b = pts[i] as Point;
    if (m <= b.m) return a.v + ((b.v - a.v) * (m - a.m)) / (b.m - a.m);
  }
  return (pts[pts.length - 1] as Point).v;
};

/** TP-3355 F-16C measured values. */
export const TP3355_F16C = Object.freeze({
  cdMin: [{ m: 1.6, v: 0.051 }, { m: 1.8, v: 0.05 }, { m: 2.0, v: 0.0485 }, { m: 2.16, v: 0.048 }] as const,
  clAlphaPerDeg: [{ m: 1.6, v: 0.068 }, { m: 1.8, v: 0.058 }, { m: 2.0, v: 0.052 }, { m: 2.16, v: 0.048 }] as const,
  inducedK16: 0.24,
  dCmdCL16: -0.255
});

/** Low-speed reference characteristics DERIVED from the hifi tables (clean, β = 0, q = 0, LEF 0). */
export const LOW_SPEED_REFERENCE = (() => {
  const at = (alphaDeg: number) => {
    const o = f16HifiAerodynamics({ alphaRad: alphaDeg * DEG, betaRad: 0, trueAirspeedMps: 70, dynamicPressurePa: 3000, mach: 0.2, ratesRadps: [0, 0, 0], surfaces: { elevatorDeg: 0, aileronDeg: 0, rudderDeg: 0 }, cgFractionMac: 0.35, lefDeg: 0 }).coefficients;
    const a = alphaDeg * DEG;
    return { cl: -o.cz * Math.cos(a) + o.cx * Math.sin(a), cd: -o.cx * Math.cos(a) - o.cz * Math.sin(a), cm: o.cm };
  };
  const p0 = at(0), p4 = at(4), p8 = at(8);
  const clAlphaPerDeg = (p4.cl - p0.cl) / 4;
  // Fit CD = CDmin + K·(CL − CL0)² through α = 0, 4, 8°.
  const cl0 = p0.cl;
  const k = ((p8.cd - p0.cd) - (p4.cd - p0.cd)) / ((p8.cl - cl0) ** 2 - (p4.cl - cl0) ** 2);
  const cdMin = p4.cd - k * (p4.cl - cl0) ** 2;
  const dCmdCL = (p4.cm - p0.cm) / (p4.cl - p0.cl);
  return { clAlphaPerDeg, cdMin, k, cl0, dCmdCL };
})();

/** DATCOM/Helmbold subsonic lift-curve slope ratio relative to M = 0.2 (estimated planform). */
function subsonicLiftRatio(mach: number): number {
  const A = 3.0, tanL = Math.tan(32 * DEG);
  const slope = (m: number) => {
    const b2 = 1 - m * m;
    return A / (2 + Math.sqrt(4 + A * A * (b2 + tanL * tanL)));
  };
  return slope(Math.min(mach, 0.9)) / slope(0.2);
}

export interface CompressibilityFactors {
  /** Multiplier on the attached-flow lift increment. */
  readonly liftScale: number;
  /** Added minimum drag coefficient. */
  readonly deltaCdMin: number;
  /** Added lift-dependent drag factor. */
  readonly deltaK: number;
  /** Aerodynamic-centre aft shift as a dCm/dCL increment (negative = more stable). */
  readonly deltaDCmdCL: number;
  /** "measured" (TP-3355 range), "estimated" (transonic/subsonic method) or "low-speed". */
  readonly basis: "low-speed" | "estimated" | "measured";
}

export function compressibilityFactors(mach: number): CompressibilityFactors {
  const ref = LOW_SPEED_REFERENCE;
  const M = Math.max(0, mach);
  // Supersonic targets from TP-3355; held constant above M 2.16 (beyond data: flagged elsewhere).
  const superLift = interp(TP3355_F16C.clAlphaPerDeg, M) / ref.clAlphaPerDeg;
  const superCd = interp(TP3355_F16C.cdMin, M) - ref.cdMin;
  const superK = TP3355_F16C.inducedK16 - ref.k;
  const superCm = TP3355_F16C.dCmdCL16 - ref.dCmdCL;

  if (M <= 0.6) return { liftScale: subsonicLiftRatio(M), deltaCdMin: 0, deltaK: 0, deltaDCmdCL: 0, basis: M <= 0.3 ? "low-speed" : "estimated" };
  if (M >= 1.6) return { liftScale: superLift, deltaCdMin: superCd, deltaK: superK, deltaDCmdCL: superCm, basis: M <= 2.16 ? "measured" : "estimated" };

  // Transonic blend (estimated). Lift slope: subsonic growth to M 0.9, then toward the M 1.6 value.
  const sub09 = subsonicLiftRatio(0.9);
  const liftScale = M <= 0.9 ? subsonicLiftRatio(M) : sub09 + (superLift - sub09) * smooth((M - 0.9) / 0.7);
  // Drag rise from M 0.85, reaching the supersonic level by M 1.2.
  const rise = smooth((M - 0.85) / 0.35);
  // Aerodynamic-centre shift mostly across M 0.85–1.3.
  const acShift = smooth((M - 0.85) / 0.45);
  return { liftScale, deltaCdMin: superCd * rise, deltaK: superK * rise, deltaDCmdCL: superCm * acShift, basis: "estimated" };
}

/** Mach multipliers on control-surface increments (ESTIMATED; see file header). */
export function controlEffectiveness(mach: number): { readonly pitch: number; readonly roll: number; readonly yaw: number } {
  const k = compressibilityFactors(mach).liftScale;
  return { pitch: k, roll: k, yaw: k };
}

/** C1-continuous 0→1 ramp. */
function smooth(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/**
 * Apply compressibility to low-speed body-axis coefficients at angle of attack α.
 * Lift is scaled only for the attached-flow part (blended out between α 12° and 20°, where the
 * low-speed separated-flow data is kept); drag and pitching-moment increments follow the
 * stability-axis lift coefficient at every alpha.
 */
export function applyCompressibility(c: { cx: number; cz: number; cm: number }, alphaRad: number, mach: number): { cx: number; cz: number; cm: number } {
  const f = compressibilityFactors(mach);
  if (f.basis === "low-speed") return c;
  const ca = Math.cos(alphaRad), sa = Math.sin(alphaRad);
  let cl = -c.cz * ca + c.cx * sa;
  let cd = -c.cx * ca - c.cz * sa;
  const attached = 1 - smooth((Math.abs(alphaRad) / DEG - 12) / 8);
  const ref = LOW_SPEED_REFERENCE;
  cl = ref.cl0 + (cl - ref.cl0) * (1 + (f.liftScale - 1) * attached);
  cd += f.deltaCdMin + f.deltaK * (cl - ref.cl0) ** 2;
  // The aerodynamic-centre shift is applied at every alpha (not faded with attached flow): fading
  // it would remove supersonic stability above ~15° α and create an artificial pitch-up.
  const cm = c.cm + f.deltaDCmdCL * (cl - ref.cl0);
  return { cx: -cd * ca + cl * sa, cz: -cl * ca - cd * sa, cm };
}
