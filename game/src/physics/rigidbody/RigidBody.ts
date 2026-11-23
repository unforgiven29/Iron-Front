/**
 * Rigid-body 6-DoF state, force/moment accumulation and fixed-step integration.
 *
 * Owner: physics/rigidbody. Platform-neutral: it knows nothing about aircraft, engines or
 * aerodynamics. Domain systems submit force/moment contributions. The environment supplies
 * gravitational acceleration. This module sums them deterministically and integrates.
 *
 * Conventions:
 * - World frame: local ENU (x east, y north, z up), metres, origin per scenario.
 * - Body frame: FRD (x forward, y right, z down), origin at the centre of gravity.
 * - Attitude: unit quaternion [x, y, z, w] mapping body FRD vectors into world ENU.
 * - Angular velocity: body FRD axes, rad/s.
 *
 * Integration: classical 4th-order Runge-Kutta over one fixed step. Forces and moments are
 * held constant across the step (zero-order hold), because domain systems evaluate them once
 * per tick. Rotational dynamics use Euler's equations including the gyroscopic term
 * omega x (I omega). The attitude quaternion is renormalized after every step.
 *
 * Not modelled here (owned elsewhere or future slices): contacts and constraints, mass-property
 * change within a step, Earth rotation and curvature, relativistic or aeroelastic effects.
 */
import type { Quaternion, Vector3 } from "../../core/coordinates/CoordinateFrames.js";

export type Matrix3 = readonly [Vector3, Vector3, Vector3];

export interface MassProperties {
  /** kg, > 0. */
  readonly massKg: number;
  /** Inertia tensor about the CG in body FRD axes, kg·m². Symmetric, positive definite, physically realizable. */
  readonly inertiaKgM2: Matrix3;
}

export interface RigidBodyState {
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  /** Body FRD -> world ENU. */
  readonly bodyToWorld: Quaternion;
  readonly angularVelocityBodyRadps: Vector3;
}

export interface ForceContribution {
  /** Stable producer id; contributions are summed in id order. Duplicate ids are rejected. */
  readonly sourceId: string;
  /** Frame the force vector is expressed in. */
  readonly frame: "world.enu" | "body.frd";
  readonly forceN: Vector3;
  /** Application point relative to the CG, body FRD, metres. Omit for a force through the CG. */
  readonly applicationPointBodyM?: Vector3;
}

export interface MomentContribution {
  readonly sourceId: string;
  readonly frame: "world.enu" | "body.frd";
  readonly momentNm: Vector3;
}

export interface StepInput {
  readonly forces: readonly ForceContribution[];
  readonly moments?: readonly MomentContribution[];
  /** Gravitational acceleration at the body, world ENU, m/s². Supplied by the environment owner. */
  readonly gravityEnuMps2: Vector3;
}

export interface NetLoads {
  /** Net external force (excluding gravity), world ENU, N. */
  readonly forceEnuN: Vector3;
  /** Net moment about the CG, body FRD, N·m. */
  readonly momentBodyNm: Vector3;
}

// ---------- small vector helpers (private to the physics owner) ----------
const add = (a: Vector3, b: Vector3): Vector3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vector3, s: number): Vector3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vector3, b: Vector3): Vector3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mulMV = (m: Matrix3, v: Vector3): Vector3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
];
const finite = (v: readonly number[]): boolean => v.every(Number.isFinite);

function quatMul(a: Quaternion, b: Quaternion): Quaternion {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}
const quatAdd = (a: Quaternion, b: Quaternion): Quaternion => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
const quatScale = (a: Quaternion, s: number): Quaternion => [a[0] * s, a[1] * s, a[2] * s, a[3] * s];
function quatNormalize(q: Quaternion): Quaternion {
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!Number.isFinite(n) || n < 1e-12) throw new RangeError("Attitude quaternion degenerated to zero or non-finite.");
  return quatScale(q, 1 / n);
}
const conj = (q: Quaternion): Quaternion => [-q[0], -q[1], -q[2], q[3]];
/** Rotate v by unit quaternion q. */
export function rotateVector(q: Quaternion, v: Vector3): Vector3 {
  const r = quatMul(quatMul(q, [v[0], v[1], v[2], 0]), conj(q));
  return [r[0], r[1], r[2]];
}

/** Inverse of a symmetric positive-definite 3x3 matrix. */
function invert3(m: Matrix3): Matrix3 {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const inv = 1 / det;
  return [
    [A * inv, -(b * i - c * h) * inv, (b * f - c * e) * inv],
    [B * inv, (a * i - c * g) * inv, -(a * f - c * d) * inv],
    [C * inv, -(a * h - b * g) * inv, (a * e - b * d) * inv]
  ];
}

/** Eigenvalues of a symmetric 3x3 matrix (closed form). */
function symmetricEigenvalues(m: Matrix3): [number, number, number] {
  const p1 = m[0][1] ** 2 + m[0][2] ** 2 + m[1][2] ** 2;
  if (p1 === 0) return [m[0][0], m[1][1], m[2][2]].sort((x, y) => x - y) as [number, number, number];
  const q = (m[0][0] + m[1][1] + m[2][2]) / 3;
  const p2 = (m[0][0] - q) ** 2 + (m[1][1] - q) ** 2 + (m[2][2] - q) ** 2 + 2 * p1;
  const p = Math.sqrt(p2 / 6);
  const B: Matrix3 = [
    [(m[0][0] - q) / p, m[0][1] / p, m[0][2] / p],
    [m[1][0] / p, (m[1][1] - q) / p, m[1][2] / p],
    [m[2][0] / p, m[2][1] / p, (m[2][2] - q) / p]
  ];
  const detB = B[0][0] * (B[1][1] * B[2][2] - B[1][2] * B[2][1]) - B[0][1] * (B[1][0] * B[2][2] - B[1][2] * B[2][0]) + B[0][2] * (B[1][0] * B[2][1] - B[1][1] * B[2][0]);
  const r = Math.max(-1, Math.min(1, detB / 2));
  const phi = Math.acos(r) / 3;
  const e1 = q + 2 * p * Math.cos(phi);
  const e3 = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
  const e2 = 3 * q - e1 - e3;
  return [e3, e2, e1];
}

/** Returns problems with mass properties; empty means valid. */
export function validateMassProperties(mp: MassProperties): string[] {
  const problems: string[] = [];
  if (!Number.isFinite(mp.massKg) || mp.massKg <= 0) problems.push(`massKg must be finite and > 0 (got ${mp.massKg}).`);
  const I = mp.inertiaKgM2;
  if (I.length !== 3 || I.some((row) => row.length !== 3 || !finite(row))) {
    problems.push("inertiaKgM2 must be a finite 3x3 matrix.");
    return problems;
  }
  const tol = 1e-9 * Math.max(1, Math.abs(I[0][0]), Math.abs(I[1][1]), Math.abs(I[2][2]));
  if (Math.abs(I[0][1] - I[1][0]) > tol || Math.abs(I[0][2] - I[2][0]) > tol || Math.abs(I[1][2] - I[2][1]) > tol) {
    problems.push("inertiaKgM2 must be symmetric.");
    return problems;
  }
  const [l1, l2, l3] = symmetricEigenvalues(I);
  if (l1 <= 0) {
    problems.push(`inertiaKgM2 must be positive definite (smallest principal moment ${l1}).`);
  } else if (l1 + l2 < l3 * (1 - 1e-9)) {
    problems.push(`inertiaKgM2 principal moments [${l1}, ${l2}, ${l3}] violate the triangle inequality; no physical mass distribution has them.`);
  }
  return problems;
}

export function validateState(s: RigidBodyState): string[] {
  const problems: string[] = [];
  if (!finite(s.positionEnuM)) problems.push("positionEnuM must be finite.");
  if (!finite(s.velocityEnuMps)) problems.push("velocityEnuMps must be finite.");
  if (!finite(s.angularVelocityBodyRadps)) problems.push("angularVelocityBodyRadps must be finite.");
  const n = Math.hypot(...s.bodyToWorld);
  if (!finite(s.bodyToWorld) || Math.abs(n - 1) > 1e-6) problems.push(`bodyToWorld must be a unit quaternion (|q| = ${n}).`);
  return problems;
}

/** Deterministically sum contributions (id order) into world force and body moment about the CG. */
export function sumLoads(bodyToWorld: Quaternion, forces: readonly ForceContribution[], moments: readonly MomentContribution[] = []): NetLoads {
  const ids = new Set<string>();
  const checkId = (id: string): void => {
    if (ids.has(id)) throw new RangeError(`Duplicate load contribution id "${id}".`);
    ids.add(id);
  };
  const worldToBody = conj(bodyToWorld);
  let forceEnu: Vector3 = [0, 0, 0];
  let momentBody: Vector3 = [0, 0, 0];
  for (const f of [...forces].sort((a, b) => (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0))) {
    checkId(f.sourceId);
    if (!finite(f.forceN) || (f.applicationPointBodyM && !finite(f.applicationPointBodyM))) {
      throw new RangeError(`Force "${f.sourceId}" contains non-finite values.`);
    }
    const fBody = f.frame === "body.frd" ? f.forceN : rotateVector(worldToBody, f.forceN);
    const fEnu = f.frame === "world.enu" ? f.forceN : rotateVector(bodyToWorld, f.forceN);
    forceEnu = add(forceEnu, fEnu);
    if (f.applicationPointBodyM) momentBody = add(momentBody, cross(f.applicationPointBodyM, fBody));
  }
  for (const m of [...moments].sort((a, b) => (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0))) {
    checkId(m.sourceId);
    if (!finite(m.momentNm)) throw new RangeError(`Moment "${m.sourceId}" contains non-finite values.`);
    momentBody = add(momentBody, m.frame === "body.frd" ? m.momentNm : rotateVector(worldToBody, m.momentNm));
  }
  return { forceEnuN: forceEnu, momentBodyNm: momentBody };
}

interface Derivative { dp: Vector3; dv: Vector3; dq: Quaternion; dw: Vector3 }

export class RigidBody {
  private stateValue: RigidBodyState;
  private massValue: MassProperties;
  private inverseInertia: Matrix3;

  public constructor(massProperties: MassProperties, initial: RigidBodyState) {
    const problems = [...validateMassProperties(massProperties), ...validateState(initial)];
    if (problems.length > 0) throw new RangeError(`Invalid rigid body: ${problems.join(" ")}`);
    this.massValue = massProperties;
    this.inverseInertia = invert3(massProperties.inertiaKgM2);
    this.stateValue = { ...initial, bodyToWorld: quatNormalize(initial.bodyToWorld) };
  }

  public get state(): RigidBodyState {
    return this.stateValue;
  }

  public get massProperties(): MassProperties {
    return this.massValue;
  }

  /** Change mass properties between steps (fuel burn, store release). Validated; never mid-step. */
  public setMassProperties(massProperties: MassProperties): void {
    const problems = validateMassProperties(massProperties);
    if (problems.length > 0) throw new RangeError(`Invalid mass properties: ${problems.join(" ")}`);
    this.massValue = massProperties;
    this.inverseInertia = invert3(massProperties.inertiaKgM2);
  }

  /** Replace state (save/load, scenario placement). */
  public setState(state: RigidBodyState): void {
    const problems = validateState(state);
    if (problems.length > 0) throw new RangeError(`Invalid rigid body state: ${problems.join(" ")}`);
    this.stateValue = { ...state, bodyToWorld: quatNormalize(state.bodyToWorld) };
  }

  /** Advance one fixed step with loads held constant over the step. Returns the loads used. */
  public step(dtSeconds: number, input: StepInput): NetLoads {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) throw new RangeError("dtSeconds must be finite and > 0.");
    if (!finite(input.gravityEnuMps2)) throw new RangeError("gravityEnuMps2 must be finite.");
    const s0 = this.stateValue;
    const loads = sumLoads(s0.bodyToWorld, input.forces, input.moments ?? []);
    const accel = add(scale(loads.forceEnuN, 1 / this.massValue.massKg), input.gravityEnuMps2);
    const I = this.massValue.inertiaKgM2;
    const Iinv = this.inverseInertia;
    const M = loads.momentBodyNm;

    const deriv = (v: Vector3, q: Quaternion, w: Vector3): Derivative => ({
      dp: v,
      dv: accel,
      dq: quatScale(quatMul(q, [w[0], w[1], w[2], 0]), 0.5),
      dw: mulMV(Iinv, add(M, scale(cross(w, mulMV(I, w)), -1)))
    });
    const at = (k: Derivative, h: number) => ({
      v: add(s0.velocityEnuMps, scale(k.dv, h)),
      q: quatAdd(s0.bodyToWorld, quatScale(k.dq, h)),
      w: add(s0.angularVelocityBodyRadps, scale(k.dw, h)),
      p: add(s0.positionEnuM, scale(k.dp, h))
    });

    const h = dtSeconds;
    const k1 = deriv(s0.velocityEnuMps, s0.bodyToWorld, s0.angularVelocityBodyRadps);
    const a2 = at(k1, h / 2);
    const k2 = deriv(a2.v, a2.q, a2.w);
    const a3 = at(k2, h / 2);
    const k3 = deriv(a3.v, a3.q, a3.w);
    const a4 = at(k3, h);
    const k4 = deriv(a4.v, a4.q, a4.w);
    const combine = (x: Vector3, a: Vector3, b: Vector3, c: Vector3, d: Vector3): Vector3 =>
      add(x, scale(add(add(a, scale(b, 2)), add(scale(c, 2), d)), h / 6));

    const next: RigidBodyState = {
      positionEnuM: combine(s0.positionEnuM, k1.dp, k2.dp, k3.dp, k4.dp),
      velocityEnuMps: combine(s0.velocityEnuMps, k1.dv, k2.dv, k3.dv, k4.dv),
      bodyToWorld: quatNormalize(quatAdd(s0.bodyToWorld,
        quatScale(quatAdd(quatAdd(k1.dq, quatScale(k2.dq, 2)), quatAdd(quatScale(k3.dq, 2), k4.dq)), h / 6))),
      angularVelocityBodyRadps: combine(s0.angularVelocityBodyRadps, k1.dw, k2.dw, k3.dw, k4.dw)
    };
    const problems = validateState(next);
    if (problems.length > 0) throw new RangeError(`Integration produced an invalid state (step too large or loads non-physical): ${problems.join(" ")}`);
    this.stateValue = next;
    return loads;
  }

  /** Rotational kinetic energy, J. */
  public rotationalEnergyJ(): number {
    const w = this.stateValue.angularVelocityBodyRadps;
    const Iw = mulMV(this.massValue.inertiaKgM2, w);
    return 0.5 * (w[0] * Iw[0] + w[1] * Iw[1] + w[2] * Iw[2]);
  }

  /** Angular momentum in world ENU, kg·m²/s (conserved when torque-free). */
  public angularMomentumEnu(): Vector3 {
    return rotateVector(this.stateValue.bodyToWorld, mulMV(this.massValue.inertiaKgM2, this.stateValue.angularVelocityBodyRadps));
  }
}
