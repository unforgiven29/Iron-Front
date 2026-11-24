/**
 * Unsteady separated-flow and vortex dynamics (owner: physics/aerodynamics). Platform-neutral
 * state models; each aircraft package supplies its own static curves and time constants.
 *
 * 1. Flow attachment (Goman & Khrabrov, J. Aircraft 31(5), 1994): an internal state x ∈ [0, 1]
 *    (1 = fully attached, 0 = fully separated, e.g. the non-dimensional separation-point position)
 *    obeys    τ1 · dx/dt + x = x0(α − τ2 · dα/dt),
 *    with τ1, τ2 in convective time units (c/V). x0 is the STATIC attachment curve. This gives
 *    attached-flow lag, delayed separation in a fast pull (lift overshoot), delayed reattachment
 *    in the recovery (hysteresis loops), and stall that depends on pitch rate and manoeuvre history.
 *    The aerodynamic increment applied to a static model is  ΔCL = CLattached · (x − x0(α)),
 *    so in steady flight (x = x0) the static data are reproduced exactly.
 * 2. Vortex breakdown: the same first-order law for a vortex-lift "intact" fraction v ∈ [0, 1],
 *    with its own static breakdown curve and lag (bursting moving upstream over the wing).
 *
 * Without a time step (quasi-steady callers such as the performance calculator) the states are
 * their static values. Not modelled: hysteresis in the static curve itself, asymmetric (left/right)
 * separation, β-dependence.
 */

export interface LagParameters {
  /** Relaxation time constant, chords travelled (c/V units). */
  readonly tau1Chords: number;
  /** Time delay applied to α through dα/dt, chords travelled. */
  readonly tau2Chords: number;
}

export class LaggedFlowState {
  private x: number | undefined;
  private lastAlpha: number | undefined;

  public constructor(private readonly p: LagParameters) {}

  public reset(): void { this.x = undefined; this.lastAlpha = undefined; }

  /**
   * Advance the state. `staticCurve(α)` returns the steady value in [0, 1]. With dt undefined the
   * state snaps to the static value (quasi-steady use).
   */
  public step(alphaRad: number, staticCurve: (alphaRad: number) => number, chordM: number, airspeedMps: number, dtS?: number): number {
    const steady = staticCurve(alphaRad);
    if (dtS === undefined || dtS <= 0 || airspeedMps < 1) {
      this.x = steady;
      this.lastAlpha = alphaRad;
      return steady;
    }
    const tc = chordM / airspeedMps; // one convective time, s
    const alphaDot = this.lastAlpha === undefined ? 0 : (alphaRad - this.lastAlpha) / dtS;
    this.lastAlpha = alphaRad;
    const target = staticCurve(alphaRad - this.p.tau2Chords * tc * alphaDot);
    const x = this.x ?? steady;
    const tau = Math.max(1e-4, this.p.tau1Chords * tc);
    // Exact discretisation of the first-order lag (stable for any dt).
    const k = 1 - Math.exp(-dtS / tau);
    this.x = Math.max(0, Math.min(1, x + (target - x) * k));
    return this.x;
  }

  public get value(): number | undefined { return this.x; }
}

/** C1-continuous 0→1 ramp. */
export const smoothStep = (x: number): number => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/**
 * Buffet intensity 0..1 from flow state: separation-induced (1 − x beyond light separation) and a
 * transonic shock-buffet onset boundary CL_buffet(M) supplied by the package.
 */
export function buffetIntensity(attachment: number, cl: number, mach: number, onsetCl: (mach: number) => number): number {
  const separation = smoothStep((1 - attachment - 0.1) / 0.6);
  const onset = onsetCl(mach);
  const shock = onset > 0 ? smoothStep((Math.abs(cl) - onset) / (0.4 * onset)) : 0;
  return Math.min(1, Math.max(separation, shock));
}
