/**
 * Landing gear, tyres, brakes and nose-wheel steering (owner: physics/ground-handling; spec in
 * physics/ground-handling/README.md). Platform-neutral: the aircraft package supplies wheel
 * positions, strut, tyre, brake and steering data with provenance, and which hydraulic circuit
 * powers each function.
 *
 * Per step, for every wheel with the gear down and locked:
 *  - Strut: the wheel's contact point (fully extended, body frame) is placed in the world; its
 *    penetration below the ground is the strut compression δ. Normal force N = k·δ + c·(sink
 *    rate), never pulling; beyond the stroke a stiff bottoming spring acts.
 *  - Tyre: forces in the ground plane along the wheel's heading (body x turned by the steering
 *    angle). Rolling resistance μr·N and brake force (≤ μ_peak·N: ideal anti-skid) oppose the
 *    rolling velocity; side force = cornering stiffness × slip angle, saturating at μ_peak·N and
 *    reduced by the longitudinal force on a friction circle. Anti-skid holds braking to a fraction
 *    of μ_peak·N, so a braking wheel keeps some side grip (at the full limit it would have none and
 *    the aircraft would ground-loop). Low-speed regularisation (tanh)
 *    lets a braked aircraft stand still without chatter.
 *  - Forces are returned in the world frame with their body-frame application points; the rigid
 *    body integrates the aircraft. Nothing here moves the aircraft directly.
 * Gear extension/retraction and steering move only as fast as their hydraulic supply allows.
 * A touchdown sink rate above the structural limit collapses the gear; airframe points touching
 * the ground are a crash.
 *
 * Not modelled: wheel spin inertia and spin-up, tyre relaxation, runway surface classes and
 * contamination, brake temperature, gear door sequencing, emergency extension, shimmy, tyre
 * failure, ground effect (aero owner).
 */
import type { Quaternion, Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { rotateVector } from "../rigidbody/RigidBody.js";

export interface WheelSpec {
  readonly id: string;
  /** Tyre contact point with the strut fully extended, body FRD from the CG, m. */
  readonly contactPointBodyM: Vector3;
  readonly strokeM: number;
  readonly springNPerM: number;
  readonly damperNsPerM: number;
  readonly rollingFriction: number;
  readonly peakFriction: number;
  /** Side force per radian of slip angle, as a multiple of the normal load. */
  readonly corneringStiffnessPerRad: number;
  /** Brake force limit and anti-skid efficiency: braking is held to this fraction of the tyre's friction limit. */
  readonly brake?: { readonly maxForceN: number; readonly antiSkidFraction: number };
  readonly steering?: { readonly maxAngleDeg: number; readonly rateDegS: number };
}

export interface LandingGearSpec {
  readonly wheels: readonly WheelSpec[];
  /** Full extension or retraction time with full hydraulic supply, s. */
  readonly transitTimeS: number;
  /** Hydraulic circuits for gear actuation, brakes and steering (fraction of nominal pressure is read from the network). */
  readonly gearCircuitId?: string;
  readonly brakeCircuitId?: string;
  readonly steeringCircuitId?: string;
  /** Touchdown sink rate the gear survives, m/s. */
  readonly maxSinkRateMps: number;
  /** CG height above flat ground at rest on the gear (for ground starts), m. */
  readonly restCgHeightM?: number;
  /** Airframe points that must never touch the ground (nose, tail, wingtips, belly), body FRD, m. */
  readonly airframePointsBodyM: readonly Vector3[];
}

export interface GearInputs {
  readonly handleDown: boolean;
  /** 0..1. */
  readonly brakes: number;
  /** −1..1, positive = steer right. */
  readonly steering: number;
  /** Fraction of nominal pressure on a circuit (1 when the aircraft has no hydraulic model). */
  readonly hydraulicFraction: (circuitId: string | undefined) => number;
}

export interface BodyKinematics {
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  readonly bodyToWorld: Quaternion;
  readonly angularVelocityBodyRadps: Vector3;
}

export interface WheelState {
  readonly id: string;
  readonly weightOnWheel: boolean;
  readonly compressionM: number;
  readonly normalForceN: number;
  readonly steeringDeg: number;
}

export interface GearStepResult {
  readonly forces: readonly { readonly sourceId: string; readonly frame: "world.enu"; readonly forceN: Vector3; readonly applicationPointBodyM: Vector3 }[];
  readonly wheels: readonly WheelState[];
  /** 0 = up, 1 = down; locked only at 1. */
  readonly extension: number;
  readonly weightOnWheels: boolean;
  readonly crash?: string;
}

const dot = (a: Vector3, b: Vector3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vector3, b: Vector3): Vector3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a: Vector3, b: Vector3): Vector3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vector3, k: number): Vector3 => [a[0] * k, a[1] * k, a[2] * k];

export class LandingGear {
  private extension = 1;
  private steeringDeg = 0;
  private wasCompressed = new Set<string>();
  private last: GearStepResult;

  public constructor(public readonly spec: LandingGearSpec) {
    this.last = { forces: [], wheels: [], extension: 1, weightOnWheels: false };
  }

  public reset(down: boolean): void {
    this.extension = down ? 1 : 0;
    this.steeringDeg = 0;
    this.wasCompressed.clear();
  }

  public get state(): GearStepResult {
    return this.last;
  }

  public step(dt: number, body: BodyKinematics, groundHeightM: (x: number, y: number) => number | undefined, input: GearInputs): GearStepResult {
    const s = this.spec;
    const locked = this.extension >= 1;

    const forces: GearStepResult["forces"][number][] = [];
    const wheels: WheelState[] = [];
    let crash: string | undefined;
    const up: Vector3 = [0, 0, 1];
    for (const w of s.wheels) {
      // Steering (hydraulically powered, rate-limited).
      let steer = 0;
      if (w.steering) {
        const cmd = Math.max(-1, Math.min(1, input.steering)) * w.steering.maxAngleDeg;
        const rate = w.steering.rateDegS * input.hydraulicFraction(s.steeringCircuitId);
        this.steeringDeg += Math.max(-rate * dt, Math.min(rate * dt, cmd - this.steeringDeg));
        steer = this.steeringDeg;
      }
      const worldOffset = rotateVector(body.bodyToWorld, w.contactPointBodyM);
      const p = add(body.positionEnuM, worldOffset);
      const ground = groundHeightM(p[0], p[1]);
      const penetration = ground === undefined ? -1 : ground - p[2];
      if (penetration <= 0) { this.wasCompressed.delete(w.id); wheels.push({ id: w.id, weightOnWheel: false, compressionM: 0, normalForceN: 0, steeringDeg: steer }); continue; }
      if (!locked) { crash ??= this.extension > 0 ? "landing gear not locked down at touchdown" : "gear-up landing"; continue; }
      const v = add(body.velocityEnuMps, rotateVector(body.bodyToWorld, cross(body.angularVelocityBodyRadps, w.contactPointBodyM)));
      if (!this.wasCompressed.has(w.id) && -v[2] > s.maxSinkRateMps) crash ??= `landing gear collapsed: sink rate ${(-v[2]).toFixed(1)} m/s at touchdown`;
      this.wasCompressed.add(w.id);
      const bottoming = penetration > w.strokeM ? (penetration - w.strokeM) * w.springNPerM * 20 : 0;
      const N = Math.max(0, w.springNPerM * Math.min(penetration, w.strokeM) + bottoming - w.damperNsPerM * v[2]);
      // Wheel heading in the ground plane.
      const s0 = (steer * Math.PI) / 180;
      const headingWorld = rotateVector(body.bodyToWorld, [Math.cos(s0), Math.sin(s0), 0]);
      const fwdRaw: Vector3 = [headingWorld[0], headingWorld[1], 0];
      const len = Math.hypot(fwdRaw[0], fwdRaw[1]) || 1;
      const fwd = scale(fwdRaw, 1 / len);
      const right: Vector3 = cross(fwd, up); // right of travel direction in ENU
      const vLong = dot(v, fwd), vLat = dot(v, right);
      const muN = w.peakFriction * N;
      const brake = w.brake ? Math.min(Math.max(0, Math.min(1, input.brakes)) * w.brake.maxForceN * input.hydraulicFraction(s.brakeCircuitId), w.brake.antiSkidFraction * muN) : 0;
      const fLong = -(w.rollingFriction * N + brake) * Math.tanh(vLong / 0.3);
      const slip = Math.atan2(vLat, Math.abs(vLong) + 1);
      const latCap = Math.sqrt(Math.max(0, muN * muN - fLong * fLong));
      const fLat = -Math.max(-latCap, Math.min(latCap, w.corneringStiffnessPerRad * N * slip));
      const force = add(add(scale(up, N), scale(fwd, fLong)), scale(right, fLat));
      forces.push({ sourceId: `gear.${w.id}`, frame: "world.enu", forceN: force, applicationPointBodyM: w.contactPointBodyM });
      wheels.push({ id: w.id, weightOnWheel: true, compressionM: penetration, normalForceN: N, steeringDeg: steer });
    }
    for (const pt of s.airframePointsBodyM) {
      const p = add(body.positionEnuM, rotateVector(body.bodyToWorld, pt));
      const ground = groundHeightM(p[0], p[1]);
      if (ground !== undefined && p[2] < ground) { crash ??= "airframe struck the ground"; break; }
    }
    // Gear actuation (after contact, so the squat-switch interlock uses this step's weight on wheels).
    const wow = wheels.some((w) => w.weightOnWheel);
    const target = input.handleDown || wow ? 1 : 0;
    const gearRate = input.hydraulicFraction(s.gearCircuitId) / s.transitTimeS;
    if (target > this.extension) this.extension = Math.min(1, this.extension + gearRate * dt);
    else if (target < this.extension) this.extension = Math.max(0, this.extension - gearRate * dt);
    this.last = { forces, wheels, extension: this.extension, weightOnWheels: wow, ...(crash ? { crash } : {}) };
    return this.last;
  }
}
