/**
 * Steady-state performance calculator for any AircraftDefinition (shared).
 *
 * For an altitude, Mach number, weight and throttle it trims the aircraft for level 1-g flight
 * using the package's own aero model (solving angle of attack and the pitch-trim surface for
 * lift = weight and zero pitching moment), evaluates installed engine thrust from the shared
 * turbofan cycle at full spool, and returns specific excess power. From that: maximum level
 * speed, best climb rate and ceiling.
 */
import { standardAtmosphere } from "../../../physics/environment/Atmosphere.js";
import { solveCycle } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import type { AircraftDefinition } from "./AircraftDefinition.js";

export interface PerformanceOptions {
  /** Pitch trim surface id (e.g. "elevator") and its limit, degrees. */
  readonly pitchSurfaceId: string;
  readonly pitchSurfaceLimitDeg: number;
  /** Steady-state scheduled devices for a trimmed condition, e.g. leading-edge flaps. */
  readonly devices?: (alphaRad: number, dynamicPressurePa: number, staticPressurePa: number) => Readonly<Record<string, number>>;
}

export interface PerformancePoint {
  readonly altitudeM: number;
  readonly mach: number;
  readonly trimmed: boolean;
  readonly alphaDeg: number;
  readonly trimSurfaceDeg: number;
  readonly thrustN: number;
  readonly dragN: number;
  /** Specific excess power, m/s (= climb rate available at constant speed). */
  readonly specificExcessPowerMps: number;
}

export function levelFlightPoint(def: AircraftDefinition, options: PerformanceOptions, altitudeM: number, mach: number, massKg: number, afterburner = true): PerformancePoint {
  const atm = standardAtmosphere(altitudeM);
  const V = mach * atm.speedOfSoundMps;
  const q = 0.5 * atm.densityKgM3 * V * V;
  const W = massKg * 9.80665;
  const aero = def.createSystems().aero;
  const theta = (atm.temperatureK * (1 + 0.2 * mach * mach)) / 288.15;
  const thrustN = def.engines.reduce((sum, e) => {
    const c = solveCycle(e.design, { temperatureK: atm.temperatureK, pressurePa: atm.pressurePa, mach }, Math.min(1.05, 1 / Math.sqrt(theta)), afterburner ? 1 : 0);
    return sum + Math.max(0, c.netThrustN) * e.thrustAxisBody[0];
  }, 0);
  const forces = (alpha: number, trim: number) => {
    const surfaces = { ...(options.devices?.(alpha, q, atm.pressurePa) ?? {}), [options.pitchSurfaceId]: trim };
    const o = aero.compute({ alphaRad: alpha, betaRad: 0, trueAirspeedMps: V, dynamicPressurePa: q, mach, ratesRadps: [0, 0, 0], surfaces, cgFractionMac: def.mass.cgFractionMac });
    const [fx, , fz] = o.forceBodyN;
    const lift = -fz * Math.cos(alpha) + fx * Math.sin(alpha);
    const drag = -fx * Math.cos(alpha) - fz * Math.sin(alpha);
    return { lift, drag, m: o.momentBodyNm[1] };
  };
  // Newton iteration on (lift + T·sinα − W, M) for (α, trim).
  let alpha = 0.05, trim = 0, ok = false;
  for (let i = 0; i < 40; i++) {
    const f = forces(alpha, trim);
    const r1 = f.lift + thrustN * Math.sin(alpha) - W, r2 = f.m;
    if (Math.abs(r1) < 1e-3 * W && Math.abs(r2) < 1e-3 * q * 27.9 * 3.45) { ok = true; break; }
    const ha = 1e-4, ht = 1e-2;
    const fa = forces(alpha + ha, trim), ft = forces(alpha, trim + ht);
    const j11 = (fa.lift + thrustN * Math.sin(alpha + ha) - W - r1) / ha, j12 = (ft.lift + thrustN * Math.sin(alpha) - W - r1) / ht;
    const j21 = (fa.m - r2) / ha, j22 = (ft.m - r2) / ht;
    const det = j11 * j22 - j12 * j21;
    if (!Number.isFinite(det) || det === 0) break;
    alpha -= (r1 * j22 - r2 * j12) / det;
    trim -= (j11 * r2 - j21 * r1) / det;
    alpha = Math.max(-0.2, Math.min(0.45, alpha));
    trim = Math.max(-options.pitchSurfaceLimitDeg, Math.min(options.pitchSurfaceLimitDeg, trim));
  }
  const f = forces(alpha, trim);
  const trimmed = ok && Math.abs(trim) < options.pitchSurfaceLimitDeg - 1e-6;
  return {
    altitudeM, mach, trimmed,
    alphaDeg: (alpha * 180) / Math.PI,
    trimSurfaceDeg: trim,
    thrustN,
    dragN: f.drag,
    specificExcessPowerMps: trimmed ? ((thrustN * Math.cos(alpha) - f.drag) * V) / W : Number.NaN
  };
}

/** Maximum level-flight Mach at an altitude (highest Mach with Ps ≥ 0), or NaN if none. */
export function maxLevelMach(def: AircraftDefinition, options: PerformanceOptions, altitudeM: number, massKg: number): number {
  let best = Number.NaN;
  for (let m = 0.2; m <= 2.6; m += 0.02) {
    const p = levelFlightPoint(def, options, altitudeM, m, massKg);
    if (p.trimmed && p.specificExcessPowerMps >= 0) best = m;
  }
  if (Number.isNaN(best)) return best;
  // Refine the root between best and best + 0.02.
  let lo = best, hi = best + 0.02;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const p = levelFlightPoint(def, options, altitudeM, mid, massKg);
    if (p.trimmed && p.specificExcessPowerMps >= 0) lo = mid; else hi = mid;
  }
  return lo;
}

/** Best (maximum over Mach) specific excess power at an altitude, m/s. */
export function bestClimbRate(def: AircraftDefinition, options: PerformanceOptions, altitudeM: number, massKg: number): { readonly mps: number; readonly mach: number } {
  let best = { mps: Number.NEGATIVE_INFINITY, mach: Number.NaN };
  for (let m = 0.3; m <= 2.4; m += 0.05) {
    const p = levelFlightPoint(def, options, altitudeM, m, massKg);
    if (p.trimmed && p.specificExcessPowerMps > best.mps) best = { mps: p.specificExcessPowerMps, mach: m };
  }
  return best;
}
