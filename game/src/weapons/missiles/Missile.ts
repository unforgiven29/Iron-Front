/**
 * Air-to-air missile flight model (owner: weapons/missiles). One shared model for any missile; every
 * number comes from the missile's catalog entry.
 *
 * 6-DoF rigid body (roll held by the roll autopilot, not simulated): position, velocity, attitude
 * quaternion, pitch and yaw rates. Each sub-step (≤ 5 ms):
 *  - aerodynamics from the airframe GEOMETRY (MissileAero.ts): normal force with α/β incl. high-α
 *    cross-flow, centre of pressure, control force at the control surfaces, axial force (motor on/off),
 *    pitch/yaw damping — moments about the CURRENT centre of gravity;
 *  - motor: boost/sustain phases with vacuum thrust and propellant flow; thrust corrected for ambient
 *    pressure on the nozzle exit (F = F_vac − p_a·A_e); mass, CG and inertia move with the burn;
 *    thrust-vector vanes (where fitted) add control moment while the motor burns;
 *  - control: fin actuators with deflection, rate and first-order lag limits; an acceleration autopilot
 *    that solves the trim angle of attack for the commanded acceleration (from the current derivatives)
 *    and places the short-period dynamics, with α and g limits;
 *  - power: the on-board battery has a fixed life; when it is exhausted guidance, seeker and actuators
 *    stop and the missile flies ballistically;
 *  - guidance: proportional navigation on the seeker line-of-sight rate with gravity compensation;
 *    inertial midcourse toward a predicted intercept before lock-on (radio-corrected for SARH).
 *
 * Not modelled: roll dynamics, aeroelasticity, motor temperature effects, plume, countermeasures.
 */
import type { Quaternion, Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { standardAtmosphere } from "../../physics/environment/Atmosphere.js";
import type { SensorScene } from "../../physics/sensing/SensorScene.js";
import { add, angleBetween, cross, dot, norm, scale, sub, unit } from "../../physics/sensing/SweepGeometry.js";
import { SemiActiveSeeker, type Illumination, type SarhSeekerProfile } from "../../sensors/weapon-seeker/SemiActiveSeeker.js";
import { bistaticDoppler } from "../../physics/radar/RadarPhysics.js";
import { rotateVector } from "../../physics/rigidbody/RigidBody.js";
import { missileAero, type AeroCoefficients, type MissileGeometry } from "./MissileAero.js";

const G = 9.80665;

export interface Sourced<T> { readonly value: T; readonly source: string; readonly status: "published" | "derived" | "estimated" }

export interface MissileSpec {
  readonly id: string;
  /** Short name for displays, e.g. "R27R". */
  readonly display: string;
  readonly geometry: Sourced<MissileGeometry>;
  readonly mass: Sourced<{ readonly launchKg: number; readonly cgLaunchM: number; readonly cgBurnoutM: number; readonly iyyLaunchKgM2: number; readonly iyyBurnoutKgM2: number }>;
  /** Motor: ignition delay after release, then phases with vacuum thrust and propellant used. */
  readonly motor: Sourced<{ readonly ignitionDelayS: number; readonly phases: readonly { readonly durationS: number; readonly thrustVacN: number; readonly propellantKg: number }[] }>;
  readonly control: Sourced<{ readonly maxDeflectionRad: number; readonly rateRadS: number; readonly lagS: number; readonly maxAlphaRad: number; readonly tvcMaxRad?: number }>;
  /** Autopilot short-period design: natural frequency and damping. */
  readonly autopilot: Sourced<{ readonly omegaRadS: number; readonly zeta: number }>;
  readonly maxG: Sourced<number>;
  /**
   * Multiplier on the geometry-derived axial force for what a clean-geometry estimate leaves out
   * (protuberances, rail lugs, control gaps, interference). FITTED per missile where launch-zone data exist.
   */
  readonly dragFactor?: Sourced<number>;
  /** On-board power (thermal battery / turbo-generator) life after activation at launch, s. */
  readonly battery: Sourced<{ readonly lifeS: number }>;
  /** IR seekers: detector cool-down after the weapon is selected, s (absent = no cooling). */
  readonly seekerCoolingS?: Sourced<number>;
  readonly guidance: Sourced<{ readonly navConstant: number; readonly safeSeparationS: number; readonly midcourse: "inertial" | "inertial+radio" | "none" }>;
  readonly seeker: Sourced<
    | { readonly kind: "sarh"; readonly gimbalRad: number; readonly profile: SarhSeekerProfile }
    | { readonly kind: "ir"; readonly gimbalRad: number; readonly fovRad: number; readonly apertureM: number; readonly neiWm2: number; readonly lockSnr: number; readonly lockOnAfterLaunch: boolean }
  >;
  /**
   * Proximity fuze: arms after the missile has flown `armingDistanceM` from the launcher (safe
   * separation); detonates at closest approach within `radiusM`; self-destructs when on-board power ends.
   */
  readonly fuze: Sourced<{ readonly armingDistanceM: number; readonly radiusM: number; readonly selfDestruct: boolean }>;
  /**
   * Inertial measurement unit for midcourse navigation: gyro drift (heading error grows with time) and
   * accelerometer bias (position error grows with t²). Absent = perfect inertial navigation.
   */
  readonly ins?: Sourced<{ readonly gyroDriftDegPerMin: number; readonly accelBiasMps2: number }>;
  readonly warhead: Sourced<{ readonly massKg: number; readonly lethalRadiusM: number }>;
  /** Off-boresight seeker cueing (HMS) possible. */
  readonly offBoresight: boolean;
}

/** What the launcher provides each tick while it can: illumination (SARH) and its target estimate (radio correction). */
export interface LauncherLink {
  /** The launcher radar's illumination this tick (SARH), or null when it is not illuminating. */
  readonly illumination: Illumination | null;
  /** Launcher's target estimate (radio correction), or null. */
  readonly targetEstimate: { readonly positionEnuM: Vector3; readonly velocityEnuMps: Vector3 } | null;
}

export interface MissileState {
  readonly id: string;
  readonly specId: string;
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  /** Body nose direction (ENU). */
  readonly noseEnu: Vector3;
  readonly timeS: number;
  readonly phase: "boost" | "coast" | "dead";
  readonly seekerLocked: boolean;
  readonly alphaRad: number;
  readonly mach: number;
  readonly batteryLeftS: number;
  readonly reason?: string;
}

/** Thrust (vacuum) and propellant flow at time t after release. */
export function motorAt(spec: MissileSpec, t: number): { thrustVacN: number; mdot: number } {
  let t0 = spec.motor.value.ignitionDelayS;
  if (t < t0) return { thrustVacN: 0, mdot: 0 };
  for (const ph of spec.motor.value.phases) {
    if (t < t0 + ph.durationS) return { thrustVacN: ph.thrustVacN, mdot: ph.propellantKg / ph.durationS };
    t0 += ph.durationS;
  }
  return { thrustVacN: 0, mdot: 0 };
}

export const totalPropellantKg = (spec: MissileSpec) => spec.motor.value.phases.reduce((a, p) => a + p.propellantKg, 0);

const qmul = (a: Quaternion, b: Quaternion): Quaternion => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
];
const qnorm = (q: Quaternion): Quaternion => { const n = Math.hypot(q[0], q[1], q[2], q[3]); return [q[0] / n, q[1] / n, q[2] / n, q[3] / n]; };
const conj = (q: Quaternion): Quaternion => [-q[0], -q[1], -q[2], q[3]];

/** Body (FRD) → world quaternion with the nose along `fwd` and wings level. */
export function attitudeFromNose(fwd: Vector3): Quaternion {
  const f = unit(fwd);
  let r = cross(f, [0, 0, 1]);
  if (norm(r) < 1e-6) r = [1, 0, 0];
  r = unit(r);
  const d = cross(f, r);
  // Rotation matrix columns = body axes in world: [f r d].
  const m00 = f[0], m01 = r[0], m02 = d[0], m10 = f[1], m11 = r[1], m12 = d[1], m20 = f[2], m21 = r[2], m22 = d[2];
  const tr = m00 + m11 + m22;
  let q: Quaternion;
  if (tr > 0) { const S = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / S, (m02 - m20) / S, (m10 - m01) / S, 0.25 * S]; }
  else if (m00 > m11 && m00 > m22) { const S = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * S, (m01 + m10) / S, (m02 + m20) / S, (m21 - m12) / S]; }
  else if (m11 > m22) { const S = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / S, 0.25 * S, (m12 + m21) / S, (m02 - m20) / S]; }
  else { const S = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / S, (m12 + m21) / S, 0.25 * S, (m10 - m01) / S]; }
  return qnorm(q);
}

export class Missile {
  private p: Vector3;
  private v: Vector3;
  private q: Quaternion;
  /** Body pitch and yaw rates, rad/s (FRD: q nose-up, r nose-right). */
  private wq = 0;
  private wr = 0;
  private dPitch = 0;
  private dYaw = 0;
  private burned = 0;
  private flown = 0;
  /** Seeded IMU error directions (world unit vectors). */
  private insDirs: [Vector3, Vector3] = [[1, 0, 0], [0, 1, 0]];
  private t = 0;
  private dead: string | null = null;
  private lastLos: Vector3 | null = null;
  private locked = false;
  private closest = Infinity;
  private sarh: SemiActiveSeeker | null = null;
  private sarhRate: Vector3 | null = null;
  private aeroCache: { mach: number; alt: number; c: AeroCoefficients } | null = null;
  private alpha = 0;
  private machNow = 0;
  /** Coarser integration for launch-zone prediction. */
  public fast = false;

  /**
   * @param irCue pre-launch seeker pointing (IR missiles locked on the rail, HMS cue)
   * @param idealTarget launch-zone prediction only: a perfect seeker that sees this point
   */
  public constructor(public readonly id: string, public readonly spec: MissileSpec, positionEnuM: Vector3, velocityEnuMps: Vector3, private readonly link: () => LauncherLink, private readonly irCue: Vector3 | null = null, private readonly idealTarget?: () => Vector3) {
    this.p = [...positionEnuM];
    this.v = [...velocityEnuMps];
    this.q = attitudeFromNose(norm(velocityEnuMps) > 1 ? velocityEnuMps : [0, 1, 0]);
    // IMU error directions, seeded from the missile id (repeatable runs).
    let seed = 0;
    for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const dir = (): Vector3 => { const z = 2 * rnd() - 1, a = 2 * Math.PI * rnd(), r = Math.sqrt(1 - z * z); return [r * Math.cos(a), r * Math.sin(a), z]; };
    this.insDirs = [dir(), dir()];
    const sk = spec.seeker.value;
    if (sk.kind === "sarh" && !idealTarget) {
      this.sarh = new SemiActiveSeeker(sk.profile, id.length * 7919);
      // Pre-launch data: expected line of sight and Doppler (BP-29 p.22: data put into the missile's memory before launch).
      const l = link();
      if (l.targetEstimate) {
        const los = unit(sub(l.targetEstimate.positionEnuM, positionEnuM));
        const fd = l.illumination ? bistaticDoppler(l.illumination.positionEnuM, l.illumination.velocityEnuMps, positionEnuM, velocityEnuMps, l.targetEstimate.positionEnuM, l.targetEstimate.velocityEnuMps, l.illumination.wavelengthM) : 0;
        this.sarh.preset(los, fd);
      }
    }
  }

  /** Seeker status for displays and tests. */
  public get seekerStatus(): string { return this.sarh ? this.sarhStatus : this.locked ? "track" : "search"; }
  private sarhStatus = "off";

  private bodyX(): Vector3 { return rotateVector(this.q, [1, 0, 0]); }
  private toBody(v: Vector3): Vector3 { return rotateVector(conj(this.q), v); }

  public get state(): MissileState {
    const ph = this.dead ? "dead" : motorAt(this.spec, this.t).thrustVacN > 0 ? "boost" : "coast";
    return {
      id: this.id, specId: this.spec.id, positionEnuM: [...this.p], velocityEnuMps: [...this.v], noseEnu: this.bodyX(), timeS: this.t, phase: ph, seekerLocked: this.locked,
      alphaRad: this.alpha, mach: this.machNow, batteryLeftS: Math.max(0, this.spec.battery.value.lifeS - this.t), ...(this.dead ? { reason: this.dead } : {})
    };
  }

  public get alive(): boolean { return !this.dead; }
  public kill(reason: string): void { this.dead = reason; }

  /** Seeker measurement: line of sight to the target (world unit), or null. */
  private seek(scene: SensorScene, link: LauncherLink): Vector3 | null {
    const sk = this.spec.seeker.value;
    const axis = this.bodyX();
    // Point the seeker at the expected target (last LOS, link estimate, or the pre-launch IR cue).
    const cue = this.lastLos ?? (link.targetEstimate ? unit(sub(link.targetEstimate.positionEnuM, this.p)) : this.irCue ?? axis);
    if (angleBetween(cue, axis) > sk.gimbalRad) return null;
    if (this.idealTarget) return unit(sub(this.idealTarget(), this.p));
    if (sk.kind === "ir") {
      let best: { los: Vector3; snr: number } | null = null;
      for (const pt of scene.infrared({ originEnuM: this.p, fieldFrom: cue, fieldTo: cue, fieldHalfRad: sk.fovRad, maxRangeM: 40000 })) {
        const snr = Math.abs(pt.irradianceWm2) / sk.neiWm2;
        if (!best || snr > best.snr) best = { los: pt.losEnu, snr };
      }
      return best && best.snr >= sk.lockSnr ? best.los : null;
    }
    // Semi-active: the 9B-1101K-class seeker model (sensors/weapon-seeker/SemiActiveSeeker).
    const o = this.sarh!.step({ positionEnuM: this.p, velocityEnuMps: this.v, bodyAxis: axis, scene, illumination: link.illumination, cue: link.targetEstimate }, this.dtLast);
    this.sarhStatus = o.status;
    this.sarhRate = o.losRate;
    return o.status === "track" || o.status === "memory" ? o.losEnu : null;
  }
  private dtLast = 0.02;

  /** Mass properties for the current burn state. */
  private massProps(): { m: number; xcg: number; iyy: number } {
    const M = this.spec.mass.value;
    const f = Math.min(1, this.burned / Math.max(1e-6, totalPropellantKg(this.spec)));
    return { m: M.launchKg - this.burned, xcg: M.cgLaunchM + (M.cgBurnoutM - M.cgLaunchM) * f, iyy: M.iyyLaunchKgM2 + (M.iyyBurnoutKgM2 - M.iyyLaunchKgM2) * f };
  }

  private aero(mach: number, alt: number): AeroCoefficients {
    const c = this.aeroCache;
    if (c && Math.abs(c.mach - mach) < 0.03 && Math.abs(c.alt - alt) < 500) return c.c;
    const coeff = missileAero(this.spec.geometry.value, mach, alt);
    this.aeroCache = { mach, alt, c: coeff };
    return coeff;
  }

  public step(scene: SensorScene, dt: number, groundHeightAt: (x: number, y: number) => number): void {
    if (this.dead) return;
    const link = this.link();
    const spec = this.spec;
    const powered = this.t < spec.battery.value.lifeS;
    // ---- guidance (once per call) → commanded acceleration, world ----
    let cmd: Vector3 = [0, 0, 0];
    const G_ = spec.guidance.value;
    const V0 = norm(this.v);
    if (powered && this.t > G_.safeSeparationS) {
      this.dtLast = dt;
      const los = this.seek(scene, link);
      this.locked = !!los;
      if (los) {
        if (this.lastLos) {
          // LOS rate: from the seeker's own track filter when it has one, else by differencing.
          const losRate = this.sarhRate ?? scale(sub(los, this.lastLos), 1 / dt);
          const tgtEst = link.targetEstimate;
          const vc = tgtEst ? -dot(sub(tgtEst.velocityEnuMps, this.v), los) : V0;
          cmd = scale(losRate, G_.navConstant * Math.max(vc, 200));
        }
        this.lastLos = los;
      } else if (G_.midcourse !== "none" && link.targetEstimate) {
        const tg = link.targetEstimate;
        // The missile navigates from its own inertial position estimate, which drifts.
        const rel = sub(tg.positionEnuM, this.navPosition());
        const tgo = norm(rel) / Math.max(300, V0);
        const aim = unit(add(rel, scale(tg.velocityEnuMps, tgo)));
        const fwd = unit(this.v);
        const lat = sub(aim, scale(fwd, dot(aim, fwd)));
        cmd = scale(lat, (3 * V0) / Math.max(1, tgo));
        this.lastLos = null;
      }
      cmd = add(cmd, [0, 0, G]); // gravity compensation
      const n = norm(cmd), lim = spec.maxG.value * G;
      if (n > lim) cmd = scale(cmd, lim / n);
    }
    // ---- 6-DoF sub-steps ----
    const h = this.fast ? 0.01 : 0.004;
    const n = Math.max(1, Math.ceil(dt / h));
    for (let i = 0; i < n && !this.dead; i++) this.integrate(dt / n, cmd, powered);
    this.t += dt;
    const gh = groundHeightAt(this.p[0], this.p[1]);
    if (Number.isFinite(gh) && this.p[2] <= gh) this.dead = "ground";
    else if (this.t > spec.battery.value.lifeS) this.dead = spec.fuze.value.selfDestruct ? "self-destruct" : "battery exhausted";
    else if (motorAt(spec, this.t).thrustVacN === 0 && this.t > spec.motor.value.ignitionDelayS + 1 && norm(this.v) < 200) this.dead = "energy";
  }

  private integrate(h: number, cmdWorld: Vector3, powered: boolean): void {
    const spec = this.spec;
    const atm = standardAtmosphere(Math.min(80000, Math.max(0, this.p[2])));
    const V = Math.max(1, norm(this.v));
    const mach = V / atm.speedOfSoundMps;
    this.machNow = mach;
    const qd = 0.5 * atm.densityKgM3 * V * V;
    const g = spec.geometry.value;
    const d = g.diameterM, S = (Math.PI * d * d) / 4;
    const c = this.aero(mach, this.p[2]);
    const mp = this.massProps();
    const motor = motorAt(spec, this.t);
    const thrust = motor.thrustVacN > 0 ? Math.max(0, motor.thrustVacN - atm.pressurePa * g.nozzleExitAreaM2) : 0;
    this.burned = Math.min(totalPropellantKg(spec), this.burned + motor.mdot * h);

    // Air-relative angles in the body frame. α: nose above the velocity (pitch plane); β: nose left of it.
    const vb = this.toBody(this.v);
    const alpha = Math.atan2(vb[2], vb[0]);
    const betaN = -Math.atan2(vb[1], Math.hypot(vb[0], vb[2])); // "nose-right" sideslip, the yaw-plane analogue of α
    this.alpha = Math.hypot(alpha, betaN);

    // ---- autopilot (per channel): trim α for the commanded acceleration, short-period placement ----
    const cmdB = this.toBody(cmdWorld);
    const ctl = spec.control.value;
    const ap = spec.autopilot.value;
    const tvcLever = g.lengthM - mp.xcg;
    const channel = (angle: number, rate: number, accel: number, current: number): number => {
      if (!powered) return current * Math.max(0, 1 - h / 0.2); // fins centre when power is lost
      const Na = qd * S * c.cnAlpha, Ma = qd * S * c.cnAlpha * (mp.xcg - c.xcpM);
      const tvc = ctl.tvcMaxRad && thrust > 0 ? thrust * tvcLever : 0;
      const Md = qd * S * c.cnDelta * (mp.xcg - c.xControlM) + tvc;
      const Nd = qd * S * c.cnDelta;
      if (Math.abs(Md) < 1e-6) return 0;
      const k = -Ma / Md;
      const Neff = Na + Nd * k;
      const aCmd = accel;
      let angleCmd = Neff > 1 ? (mp.m * aCmd) / Neff : 0;
      angleCmd = Math.max(-ctl.maxAlphaRad, Math.min(ctl.maxAlphaRad, angleCmd));
      // Desired moment: I·(−ω²(α−αc) − 2ζω·rate) ; δ from M = Ma·α + Md·δ.
      const mDes = mp.iyy * (-(ap.omegaRadS ** 2) * (angle - angleCmd) - 2 * ap.zeta * ap.omegaRadS * rate);
      const lim = ctl.tvcMaxRad && thrust > 0 ? Math.max(ctl.maxDeflectionRad, ctl.tvcMaxRad) : ctl.maxDeflectionRad;
      void aCmd;
      return Math.max(-lim, Math.min(lim, (mDes - Ma * angle) / Md));
    };
    const target = (dCur: number, dCmd: number) => {
      const lagged = dCur + (dCmd - dCur) * Math.min(1, h / ctl.lagS);
      const step = Math.max(-ctl.rateRadS * h, Math.min(ctl.rateRadS * h, lagged - dCur));
      return dCur + step;
    };
    this.dPitch = target(this.dPitch, channel(alpha, this.wq, -cmdB[2], this.dPitch));
    this.dYaw = target(this.dYaw, channel(betaN, this.wr, cmdB[1], this.dYaw));

    // ---- forces and moments (body FRD) ----
    const tvcActive = !!ctl.tvcMaxRad && thrust > 0;
    const finP = tvcActive ? 0 : this.dPitch, finY = tvcActive ? 0 : this.dYaw;
    const cnP = c.cnAlpha * alpha + c.crossflow * Math.sin(Math.abs(alpha)) * Math.sin(alpha);
    const cnY = c.cnAlpha * betaN + c.crossflow * Math.sin(Math.abs(betaN)) * Math.sin(betaN);
    const upForce = qd * S * (cnP + c.cnDelta * finP);
    const rightForce = qd * S * (cnY + c.cnDelta * finY);
    const ca = (thrust > 0 ? c.ca0On : c.ca0Off) * (spec.dragFactor?.value ?? 1);
    const fx = thrust * Math.cos(tvcActive ? Math.hypot(this.dPitch, this.dYaw) : 0) - qd * S * ca;
    const tvcUp = tvcActive ? thrust * Math.sin(this.dPitch) : 0, tvcRight = tvcActive ? thrust * Math.sin(this.dYaw) : 0;
    const fb: Vector3 = [fx, rightForce, -upForce];
    // Pitch moment (nose-up +): normal forces at their stations about the CG; TVC at the nozzle; damping.
    const cmq = -2 * c.panels.reduce((a, pn) => a + pn.cnAlpha * ((pn.xM - mp.xcg) / d) ** 2, 0);
    const mPitch = qd * S * (cnP * (mp.xcg - c.xcpM) + c.cnDelta * finP * (mp.xcg - c.xControlM)) + tvcUp * tvcLever + qd * S * d * cmq * ((this.wq * d) / (2 * V));
    const mYaw = qd * S * (cnY * (mp.xcg - c.xcpM) + c.cnDelta * finY * (mp.xcg - c.xControlM)) + tvcRight * tvcLever + qd * S * d * cmq * ((this.wr * d) / (2 * V));
    this.wq += (mPitch / mp.iyy) * h;
    this.wr += (mYaw / mp.iyy) * h;
    // Attitude: ω_body = (0, q, r).
    const dq = qmul(this.q, [0, this.wq * 0.5 * h, this.wr * 0.5 * h, 0]);
    this.q = qnorm([this.q[0] + dq[0], this.q[1] + dq[1], this.q[2] + dq[2], this.q[3] + dq[3]]);
    // Translation.
    const fw = rotateVector(this.q, fb);
    const acc = add(scale(fw, 1 / mp.m), [0, 0, -G]);
    this.v = add(this.v, scale(acc, h));
    this.p = add(this.p, scale(this.v, h));
    this.flown += norm(this.v) * h;
  }

  /** Inertial position estimate: true position plus accumulated IMU error (bias ½·b·t², drift θ(t)·distance flown). */
  public navPosition(): Vector3 {
    const ins = this.spec.ins?.value;
    if (!ins || this.idealTarget) return this.p;
    const biasErr = 0.5 * ins.accelBiasMps2 * this.t * this.t;
    const driftErr = ((ins.gyroDriftDegPerMin * Math.PI) / 180 / 60) * this.t * this.flown;
    return add(this.p, add(scale(this.insDirs[0], biasErr), scale(this.insDirs[1], driftErr)));
  }

  /** Distance flown since release, m (fuze arming). */
  public get distanceFlownM(): number { return this.flown; }

  /** Proximity fuze input from the world: distance to the nearest target this tick. Returns true to detonate. */
  public fuze(distanceM: number): boolean {
    if (this.dead || this.flown < this.spec.fuze.value.armingDistanceM) return false;
    const r = this.spec.fuze.value.radiusM;
    if (distanceM < r && distanceM > this.closest) return true; // passed the point of closest approach
    if (distanceM < r * 0.3) return true;
    this.closest = Math.min(this.closest, distanceM);
    return false;
  }
}

/**
 * Launch zone by simulation: fly the missile against a target moving at constant velocity from the
 * current geometry, scaled along the line of sight, and bisect for the longest and shortest ranges
 * at which it passes within the lethal radius with the guidance it would have (ideal seeker).
 */
export function launchZone(spec: MissileSpec, launch: { positionEnuM: Vector3; velocityEnuMps: Vector3 }, target: { losEnu: Vector3; velocityEnuMps: Vector3 }): { maxM: number; minM: number } {
  const hits = (rangeM: number): boolean => {
    let tp: Vector3 = add(launch.positionEnuM, scale(target.losEnu, rangeM));
    const truth = (): LauncherLink => ({ illumination: null, targetEstimate: { positionEnuM: tp, velocityEnuMps: target.velocityEnuMps } });
    const ideal: SensorScene = {
      sunDirectionEnu: [0, 0, 1],
      radar: () => [],
      radarClutter: () => [],
      infrared: () => []
    };
    const m = new Missile("dlz", spec, launch.positionEnuM, launch.velocityEnuMps, truth, null, () => tp);
    const dt = 0.05;
    m.fast = true;
    let best = Infinity;
    let r0 = sub(m.state.positionEnuM, tp);
    for (let t = 0; t < spec.battery.value.lifeS + 5 && m.alive; t += dt) {
      tp = add(tp, scale(target.velocityEnuMps, dt));
      m.step(ideal, dt, () => -1e9);
      const r1 = sub(m.state.positionEnuM, tp);
      const d = closestApproach(r0, r1);
      r0 = r1;
      best = Math.min(best, d);
      if (d < spec.warhead.value.lethalRadiusM * 1.5) return m.distanceFlownM > spec.fuze.value.armingDistanceM;
      if (d > best + 2000) break;
    }
    return false;
  };
  let lo = 300, hi = 150000;
  if (!hits(5000)) return { maxM: Number.NaN, minM: Number.NaN };
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (hits(mid)) lo = mid; else hi = mid; }
  const maxM = lo;
  let a = 50, b = Math.min(3000, maxM);
  for (let i = 0; i < 8; i++) { const mid = (a + b) / 2; if (hits(mid)) b = mid; else a = mid; }
  return { maxM, minM: b };
}

/** Closest distance during a step, for relative positions r0 → r1 moving linearly (no tunnelling at high closure). */
export function closestApproach(r0: Vector3, r1: Vector3): number {
  const dr = sub(r1, r0);
  const dd = dot(dr, dr);
  const s = dd > 0 ? Math.max(0, Math.min(1, -dot(r0, dr) / dd)) : 0;
  return norm(add(r0, scale(dr, s)));
}
