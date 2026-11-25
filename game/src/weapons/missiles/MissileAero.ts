/**
 * Missile aerodynamics from geometry (owner: weapons/missiles). Coefficients are DERIVED from the
 * airframe's dimensions with standard preliminary-design methods, not entered:
 *
 *  - body normal force: slender-body theory CNα = 2 (per rad, body cross-section reference), plus
 *    viscous cross-flow η·Cdc·(L·d/S)·sin²α for high angle of attack (Jorgensen);
 *  - lifting panels (canards, wings, tails): Helmbold/Diederich subsonic lift slope
 *    2πA / (2 + √(4 + (Aβ)²)), Ackeret supersonic 4/β, blended through the transonic band, with the
 *    wing–body interference factor K = (1 + r/s)² (Pitts–Nielsen–Kaattari, slender approximation);
 *  - centres of pressure: ogive nose 0.46·Ln; panels at the quarter (subsonic) to half (supersonic)
 *    mean aerodynamic chord;
 *  - axial force: skin friction (Fleeman eq. 2.13 form), nose wave drag (Fleeman 2.15), base drag with
 *    the motor off / on, and fin wave + friction drag;
 *  - pitch damping from the panels' lift at their lever arms.
 *
 * Fleeman, "Tactical Missile Design" (2nd ed., AIAA 2006), ch. 2; Nielsen, "Missile Aerodynamics" (1960).
 * These are design-level estimates (±20–30 % typical); they are what a geometry can honestly give.
 */

export interface LiftingSurface {
  readonly name: string;
  /** Tip-to-tip span of one panel pair, including the body diameter, m. */
  readonly spanM: number;
  readonly rootChordM: number;
  readonly tipChordM: number;
  /** Leading edge of the root chord, from the nose, m. */
  readonly leadingEdgeM: number;
  /** All-moving control surface. */
  readonly movable: boolean;
  /** Thickness/chord ratio (wave drag). */
  readonly thicknessRatio: number;
}

export interface MissileGeometry {
  readonly lengthM: number;
  readonly diameterM: number;
  readonly noseLengthM: number;
  /** Nozzle exit area, m² (base drag with motor on; thrust altitude correction). */
  readonly nozzleExitAreaM2: number;
  readonly surfaces: readonly LiftingSurface[];
}

export interface AeroCoefficients {
  /** Normal-force slope of the whole missile with controls neutral, per rad (reference: body cross-section). */
  readonly cnAlpha: number;
  /** Centre of pressure of that normal force, m from the nose. */
  readonly xcpM: number;
  /** Normal force per rad of control deflection, and where it acts, m from the nose. */
  readonly cnDelta: number;
  readonly xControlM: number;
  /** Cross-flow coefficient factor for high α: CN_nl = crossflow · sin|α| · sin α. */
  readonly crossflow: number;
  /** Axial force coefficient, motor off and on. */
  readonly ca0Off: number;
  readonly ca0On: number;
  /** Panel lift slopes and arms for damping: Σ CNα_i, x_i. */
  readonly panels: readonly { readonly cnAlpha: number; readonly xM: number }[];
}

const panelArea = (s: LiftingSurface, d: number) => {
  const exposedSpan = Math.max(0, s.spanM - d);
  return { area: ((s.rootChordM + s.tipChordM) / 2) * exposedSpan, exposedSpan };
};

/** Lift-curve slope of a panel pair (per rad, panel-area reference). */
function panelLiftSlope(aspect: number, mach: number): number {
  const sub = (m: number) => { const b = Math.sqrt(Math.max(1e-3, 1 - m * m)); return (2 * Math.PI * aspect) / (2 + Math.sqrt(4 + (aspect * b) ** 2)); };
  const sup = (m: number) => 4 / Math.sqrt(Math.max(1e-3, m * m - 1));
  if (mach <= 0.85) return sub(mach);
  if (mach >= 1.2) return Math.min(sup(mach), sub(0.85) * 1.3);
  // Transonic blend between the M 0.85 and M 1.2 values.
  const t = (mach - 0.85) / 0.35;
  return sub(0.85) * (1 - t) + Math.min(sup(1.2), sub(0.85) * 1.3) * t;
}

/** Mean aerodynamic chord and its leading-edge station for a trapezoidal panel (straight-taper approximation). */
function mac(s: LiftingSurface): { macM: number; xLeM: number } {
  const lam = s.tipChordM / s.rootChordM;
  const c = (2 / 3) * s.rootChordM * ((1 + lam + lam * lam) / (1 + lam));
  // Assume a swept leading edge reaching the tip chord's leading edge at (root − tip) aft (constant trailing edge).
  const yBar = ((1 + 2 * lam) / (3 * (1 + lam)));
  return { macM: c, xLeM: s.leadingEdgeM + yBar * (s.rootChordM - s.tipChordM) };
}

/** Aerodynamic coefficients of an airframe at a Mach number and altitude (Reynolds effect in friction). */
export function missileAero(g: MissileGeometry, mach: number, altitudeM: number): AeroCoefficients {
  const d = g.diameterM, Sref = (Math.PI * d * d) / 4;
  const M = Math.max(0.3, mach);
  // ---- normal force ----
  const panels: { cnAlpha: number; xM: number; movable: boolean; area: number }[] = [];
  let cnSum = 2, moment = 2 * 0.46 * g.noseLengthM; // body: CNα = 2 at the nose CP
  for (const s of g.surfaces) {
    const { area, exposedSpan } = panelArea(s, d);
    if (area <= 0) continue;
    const aspect = (exposedSpan * exposedSpan) / area;
    const k = (1 + d / s.spanM) ** 2;
    const cn = panelLiftSlope(aspect, M) * (area / Sref) * Math.min(k, 1.8);
    const m = mac(s);
    const frac = M < 1 ? 0.25 : Math.min(0.5, 0.25 + 0.25 * (M - 1) / 1);
    const x = m.xLeM + frac * m.macM;
    panels.push({ cnAlpha: cn, xM: x, movable: s.movable, area });
    cnSum += cn;
    moment += cn * x;
  }
  const movable = panels.filter((p) => p.movable);
  const cnDelta = movable.reduce((a, p) => a + p.cnAlpha, 0) * 0.9; // body carry-over of a deflected panel ≈ 0.9 (Nielsen)
  const xControlM = movable.length ? movable.reduce((a, p) => a + p.cnAlpha * p.xM, 0) / movable.reduce((a, p) => a + p.cnAlpha, 0) : g.lengthM;
  const crossflow = 1.2 * (g.lengthM * d) / Sref * (M > 1 ? 1 : 0.8);

  // ---- axial force ----
  const atm = isaDensityTemp(altitudeM);
  const v = M * Math.sqrt(1.4 * 287.05 * atm.t);
  const qPsf = 0.5 * atm.rho * v * v * 0.020885;
  const lFt = g.lengthM * 3.2808;
  const friction = 0.053 * (g.lengthM / d) * Math.pow(M / Math.max(1, qPsf * lFt), 0.2);
  const fineness = g.noseLengthM / d;
  const wave = M > 1 ? (1.586 + 1.834 / (M * M)) * Math.pow(Math.atan(0.5 / fineness), 1.69) : 0;
  const baseOff = M > 1 ? 0.25 / M : 0.12 + 0.13 * M * M;
  const baseOn = baseOff * Math.max(0, 1 - g.nozzleExitAreaM2 / Sref);
  let fin = 0;
  for (const s of g.surfaces) {
    const { area } = panelArea(s, d);
    const beta = Math.sqrt(Math.max(0.05, Math.abs(M * M - 1)));
    fin += 2 * (area / Sref) * (0.0133 * Math.pow(M / Math.max(1, qPsf * s.rootChordM * 3.28), 0.2) * 2 + (M > 1 ? (4 * s.thicknessRatio ** 2) / beta : 0));
  }
  return {
    cnAlpha: cnSum, xcpM: moment / cnSum, cnDelta, xControlM, crossflow,
    ca0Off: friction + wave + baseOff + fin, ca0On: friction + wave + baseOn + fin,
    panels: panels.map((p) => ({ cnAlpha: p.cnAlpha, xM: p.xM }))
  };
}

function isaDensityTemp(h: number): { rho: number; t: number } {
  const hh = Math.max(0, Math.min(20000, h));
  const t = hh < 11000 ? 288.15 - 0.0065 * hh : 216.65;
  const p = hh < 11000 ? 101325 * (t / 288.15) ** 5.2559 : 22632 * Math.exp(-(hh - 11000) / 6341.6);
  return { rho: p / (287.05 * t), t };
}
