/**
 * Ground effect on a lifting wing (owner: physics/aerodynamics). Platform-neutral: the aircraft
 * package supplies its wing span, aspect ratio and mid-chord sweep, and the wing's height above
 * the ground; it decides how to apply the factors to its own coefficient model.
 *
 * Method (image-vortex theory):
 *  - Induced drag is multiplied by McCormick's factor φ = (16h/b)² / (1 + (16h/b)²), h = wing
 *    height above ground, b = span (B. W. McCormick, "Aerodynamics, Aeronautics and Flight
 *    Mechanics", 1979). φ → 1 well above a span, → 0 on the ground.
 *  - The ground's image vortex reduces downwash like a larger aspect ratio: A_eff = A/φ. The lift
 *    curve slope then follows the DATCOM/Helmbold relation CLα ∝ A/(2 + √(4 + A²(β² + tan²Λ))),
 *    so the lift increment is the slope ratio at A_eff vs A (bounded at A_eff = 30 for φ → 0).
 * Not modelled: the nose-down pitching-moment change from reduced downwash at the tail (needs
 * tail geometry/downwash data), bank-angle asymmetry (one wingtip lower), and dynamic ground
 * effect (sink-rate dependence).
 */

export interface WingPlanform {
  readonly spanM: number;
  readonly aspectRatio: number;
  /** Mid-chord sweep, rad. */
  readonly midChordSweepRad: number;
}

export interface GroundEffectFactors {
  /** Multiplier on induced drag (0..1). */
  readonly inducedDragFactor: number;
  /** Multiplier on the attached-flow lift-curve slope (≥ 1). */
  readonly liftSlopeFactor: number;
}

const NONE: GroundEffectFactors = { inducedDragFactor: 1, liftSlopeFactor: 1 };

/** McCormick's induced-drag factor. */
export function inducedDragGroundFactor(heightM: number, spanM: number): number {
  if (!(heightM > 0)) return 0;
  const x = (16 * heightM) / spanM;
  return (x * x) / (1 + x * x);
}

function helmboldSlope(aspectRatio: number, mach: number, sweepRad: number): number {
  const b2 = Math.max(0.05, 1 - Math.min(0.95, mach) ** 2);
  const t = Math.tan(sweepRad);
  return aspectRatio / (2 + Math.sqrt(4 + aspectRatio * aspectRatio * (b2 + t * t)));
}

/** Ground-effect factors for a wing at `heightM` above the ground (undefined height: none). */
export function groundEffect(wing: WingPlanform, heightM: number | undefined, mach: number): GroundEffectFactors {
  if (heightM === undefined || !Number.isFinite(heightM) || heightM > 3 * wing.spanM) return NONE;
  const phi = Math.max(1e-3, inducedDragGroundFactor(Math.max(0.05, heightM), wing.spanM));
  const aEff = Math.min(30, wing.aspectRatio / phi);
  return { inducedDragFactor: phi, liftSlopeFactor: helmboldSlope(aEff, mach, wing.midChordSweepRad) / helmboldSlope(wing.aspectRatio, mach, wing.midChordSweepRad) };
}

/**
 * Ground-effect pitching-moment increment (DATCOM approach): near the ground the wing's downwash
 * at the tail falls roughly like the induced-drag factor φ, so the tail sees a higher angle of
 * attack and the aircraft pitches nose-down:  ΔCm = −k · (1 − φ) · CL.  k (> 0) lumps tail volume,
 * tail lift-curve slope and dε/dCL; each package supplies its own estimate.
 */
export function groundEffectPitchIncrement(ge: GroundEffectFactors, cl: number, tailDownwashSensitivity: number): number {
  return -tailDownwashSensitivity * (1 - ge.inducedDragFactor) * cl;
}
