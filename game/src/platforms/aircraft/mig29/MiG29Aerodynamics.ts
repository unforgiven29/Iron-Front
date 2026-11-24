/**
 * MiG-29 aerodynamic model — ESTIMATED, component/textbook method (no MiG-29 wind-tunnel data is
 * public; see MiG29Data.ts header). Structurally independent of the F-16 table model: here the
 * coefficients are built analytically.
 *
 *  - Lift: DATCOM/Helmbold lift-curve slope subsonic, linear supersonic theory 4/√(M²−1)
 *    (bounded by the subsonic value), smooth blend M 0.9–1.2; plus Polhamus-type vortex lift
 *    Kv·sin²α·cosα for the LERX/wing; leading-edge flaps add lift; past the stall α the attached
 *    model blends to flat-plate normal force 1.2·sin α.
 *  - Drag: CD0(M) (estimated drag rise) + K·CL², K = 1/(πAe) subsonic, 1/CLα supersonic (no
 *    leading-edge suction); separated flow adds the flat-plate component.
 *  - Pitch: Cm = −SM(M)·CL + Cmδe·δe·η(M) + Cmq·q·c/2V (static margin moves aft supersonic).
 *  - Lateral-directional: constant estimated derivatives, Cnβ reduced at high α.
 *  - Ground effect: shared physics/aerodynamics/GroundEffect.ts.
 * Surface conventions in THIS package: elevator + = trailing edge down (nose down), aileron + =
 * roll right, rudder + = nose left. Degrees.
 */
import { groundEffect, type WingPlanform } from "../../../physics/aerodynamics/GroundEffect.js";
import type { AeroModel, AeroOutput } from "../common/AircraftDefinition.js";
import { MIG29_AERO as A, MIG29_GEOMETRY as G } from "./MiG29Data.js";

const DEG = Math.PI / 180;
const S = G.wingAreaM2.value, B = G.spanM.value, C = G.meanChordM.value;
const AR = (B * B) / S;
const SWEEP = G.midChordSweepDeg.value * DEG;
const WING: WingPlanform = { spanM: B, aspectRatio: AR, midChordSweepRad: SWEEP };
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

function helmbold(mach: number): number {
  const b2 = Math.max(0.05, 1 - Math.min(0.9, mach) ** 2), t = Math.tan(SWEEP);
  return (2 * Math.PI * AR) / (2 + Math.sqrt(4 + AR * AR * (b2 + t * t)));
}

/** Lift-curve slope, per rad. */
export function liftSlope(mach: number): number {
  const sub = helmbold(mach);
  const sup = (m: number) => Math.min(helmbold(0.9), (4 / Math.sqrt(m * m - 1)) * 0.95);
  if (mach <= 0.9) return sub;
  if (mach >= 1.2) return sup(mach);
  return helmbold(0.9) + (sup(1.2) - helmbold(0.9)) * smooth((mach - 0.9) / 0.3);
}

export function zeroLiftDrag(mach: number): number {
  const s = A.zeroLiftDragSubsonic.value, p = A.zeroLiftDragPeak.value, m2 = A.zeroLiftDragM2.value;
  if (mach <= 0.85) return s;
  if (mach <= 1.2) return s + (p - s) * smooth((mach - 0.85) / 0.35);
  return p + (m2 - p) * Math.min(1, (mach - 1.2) / 0.8);
}

export function staticMargin(mach: number): number {
  return A.staticMarginSubsonic.value + (A.staticMarginSupersonic.value - A.staticMarginSubsonic.value) * smooth((mach - 0.85) / 0.45);
}

export function mig29Aerodynamics(): AeroModel {
  return {
    id: "mig29.estimated-component-method",
    compute: (input): AeroOutput => {
      const a = input.alphaRad, b = input.betaRad, M = Math.max(0, input.mach);
      const V = Math.max(1, input.trueAirspeedMps);
      const [p, q, r] = input.ratesRadps;
      const s = input.surfaces;
      const ge = groundEffect(WING, input.heightAboveGroundM, M);
      const cla = liftSlope(M) * ge.liftSlopeFactor;
      const eta = liftSlope(M) / liftSlope(0.2); // control effectiveness follows the lift slope (estimated)

      // Lift and drag in stability axes.
      const sa = Math.sin(a), ca = Math.cos(a);
      const lef = Math.max(0, s["lef"] ?? 0);
      const attachedCl = cla * sa * ca + G.lerxVortexLiftFactor.value * Math.abs(sa) * sa * ca + A.lefLiftPerDeg.value * lef * smooth((Math.abs(a) / DEG - 8) / 10);
      const stall = A.stallAlphaDeg.value + 0.2 * lef;
      const sep = smooth((Math.abs(a) / DEG - stall) / 6);
      const flatCn = 1.2 * sa;
      const cl = attachedCl * (1 - sep) + flatCn * ca * sep;
      const K = M <= 0.9 ? 1 / (Math.PI * AR * A.oswaldEfficiency.value) : M >= 1.2 ? 1 / liftSlope(M) : (1 / (Math.PI * AR * A.oswaldEfficiency.value)) + ((1 / liftSlope(1.2)) - (1 / (Math.PI * AR * A.oswaldEfficiency.value))) * smooth((M - 0.9) / 0.3);
      const gear = Math.max(0, Math.min(1, s["gear"] ?? 0));
      const brake = Math.max(0, Math.min(1, (s["speedbrake"] ?? 0) / 60));
      const cd = zeroLiftDrag(M) + K * ge.inducedDragFactor * attachedCl * attachedCl * (1 - sep) + flatCn * sa * sep
        + A.speedbrakeDrag.value * brake + A.gearDrag.value * gear;

      // Moments.
      const elev = (s["elevator"] ?? 0) * DEG, ail = s["aileron"] ?? 0, rud = s["rudder"] ?? 0;
      const c2v = C / (2 * V), b2v = B / (2 * V);
      const cm = -staticMargin(M) * cl + A.stabilatorPowerPerRad.value * elev * eta + A.pitchDampingPerRad.value * q * c2v - 0.05 * sep;
      const cnb = A.yawStabilityPerRad.value * (1 - 0.8 * smooth((Math.abs(a) / DEG - 20) / 15));
      const cy = A.sideForcePerRad.value * b + 0.003 * -rud * eta;
      const cRoll = A.dihedralEffectPerRad.value * b + A.rollDampingPerRad.value * p * b2v + 0.1 * r * b2v + A.rollPowerPerDeg.value * ail * eta * (1 - 0.5 * smooth((Math.abs(a) / DEG - 15) / 15));
      const cn = cnb * b + A.yawDampingPerRad.value * r * b2v - 0.05 * p * b2v + A.rudderPowerPerDeg.value * rud * eta - 0.0001 * ail;

      const qS = input.dynamicPressurePa * S;
      const reasons: string[] = [];
      if (Math.abs(a) > 45 * DEG) reasons.push("alpha beyond the estimated model range (45°)");
      if (M > 2.3) reasons.push(`Mach ${M.toFixed(2)} beyond the estimated model range`);
      return {
        forceBodyN: [qS * (-cd * ca + cl * sa), qS * cy, qS * (-cl * ca - cd * sa)],
        momentBodyNm: [qS * B * cRoll, qS * C * cm, qS * B * cn],
        outsideEnvelope: reasons.length > 0,
        envelopeReasons: reasons
      };
    }
  };
}
