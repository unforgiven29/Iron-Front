/**
 * Air-to-air missile flyout (owner: weapons/missiles). One shared model for any missile; every
 * number comes from the missile's spec (a catalog file).
 *
 * Physics: 3-DoF point mass in world ENU — motor thrust along the velocity with propellant mass
 * burn, drag D = q·S·(CD0(M) + k·CL²) where CL is what the commanded lateral acceleration needs,
 * gravity, a lateral-acceleration limit from structure (max g) and from lift (q·S·CLmax/m),
 * ISA atmosphere. Guidance: proportional navigation on the seeker's measured line-of-sight rate
 * with gravity compensation; before seeker lock-on, inertial midcourse toward a predicted intercept
 * from the launcher's data (radio correction while the launcher still tracks). Seekers sense only
 * through the SensorScene: semi-active radar (bistatic return of the launcher's illumination) or
 * passive IR (same physics as the IRST).
 *
 * Not modelled: body rotational dynamics/autopilot lag beyond a first-order response, seeker
 * gimbal dynamics, motor temperature, plume/smoke, countermeasures, ECCM, multipath.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { standardAtmosphere } from "../../physics/environment/Atmosphere.js";
import type { SensorScene } from "../../physics/sensing/SensorScene.js";
import { add, angleBetween, dot, norm, scale, sub, unit } from "../../physics/sensing/SweepGeometry.js";
import { SemiActiveSeeker, type Illumination, type SarhSeekerProfile } from "../../sensors/weapon-seeker/SemiActiveSeeker.js";
import { bistaticDoppler } from "../../physics/radar/RadarPhysics.js";

const G = 9.80665;

export interface Sourced<T> { readonly value: T; readonly source: string; readonly status: "published" | "derived" | "estimated" }

export interface MissileSpec {
  readonly id: string;
  /** Short name for displays, e.g. "R27R". */
  readonly display: string;
  readonly launchMassKg: Sourced<number>;
  readonly diameterM: Sourced<number>;
  /** Motor phases in order: duration, thrust, propellant used. */
  readonly motor: Sourced<readonly { readonly durationS: number; readonly thrustN: number; readonly propellantKg: number }[]>;
  /** Zero-lift drag coefficient vs Mach (reference area = body cross-section). */
  readonly cd0: Sourced<{ readonly mach: readonly number[]; readonly cd: readonly number[] }>;
  /** Induced drag factor k in CDi = k·CL², and the maximum usable CL. */
  readonly aero: Sourced<{ readonly k: number; readonly clMax: number }>;
  readonly maxG: Sourced<number>;
  /** Time constant of the airframe/autopilot response to a commanded acceleration, s. */
  readonly responseS: Sourced<number>;
  readonly guidance: Sourced<{ readonly navConstant: number; readonly safeSeparationS: number; readonly maxFlightS: number; readonly midcourse: "inertial" | "inertial+radio" | "none" }>;
  readonly seeker: Sourced<
    | { readonly kind: "sarh"; readonly gimbalRad: number; readonly profile: SarhSeekerProfile }
    | { readonly kind: "ir"; readonly gimbalRad: number; readonly fovRad: number; readonly apertureM: number; readonly neiWm2: number; readonly lockSnr: number; readonly lockOnAfterLaunch: boolean }
  >;
  readonly fuze: Sourced<{ readonly armingTimeS: number; readonly radiusM: number }>;
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
  readonly timeS: number;
  readonly phase: "boost" | "coast" | "dead";
  readonly seekerLocked: boolean;
  readonly reason?: string;
}

/** Drag coefficient interpolated in Mach. */
function cd0At(spec: MissileSpec, mach: number): number {
  const { mach: m, cd } = spec.cd0.value;
  if (mach <= (m[0] as number)) return cd[0] as number;
  for (let i = 1; i < m.length; i++) if (mach <= (m[i] as number)) { const t = (mach - (m[i - 1] as number)) / ((m[i] as number) - (m[i - 1] as number)); return (cd[i - 1] as number) * (1 - t) + (cd[i] as number) * t; }
  return cd[cd.length - 1] as number;
}

/** Thrust and propellant flow at time t after ignition. */
function motorAt(spec: MissileSpec, t: number): { thrustN: number; mdot: number } {
  let t0 = 0;
  for (const ph of spec.motor.value) {
    if (t < t0 + ph.durationS) return { thrustN: ph.thrustN, mdot: ph.propellantKg / ph.durationS };
    t0 += ph.durationS;
  }
  return { thrustN: 0, mdot: 0 };
}

export class Missile {
  private p: [number, number, number];
  private v: [number, number, number];
  private a: Vector3 = [0, 0, 0];
  private mass: number;
  private t = 0;
  private dead: string | null = null;
  private lastLos: Vector3 | null = null;
  private locked = false;
  private closest = Infinity;
  private sarh: SemiActiveSeeker | null = null;
  private sarhRate: Vector3 | null = null;

  /**
   * @param irCue pre-launch seeker pointing (IR missiles locked on the rail, HMS cue)
   * @param idealTarget launch-zone prediction only: a perfect seeker that sees this point
   */
  public constructor(public readonly id: string, public readonly spec: MissileSpec, positionEnuM: Vector3, velocityEnuMps: Vector3, private readonly link: () => LauncherLink, private readonly irCue: Vector3 | null = null, private readonly idealTarget?: () => Vector3) {
    this.p = [...positionEnuM];
    this.v = [...velocityEnuMps];
    this.mass = spec.launchMassKg.value;
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

  public get state(): MissileState {
    const ph = this.dead ? "dead" : motorAt(this.spec, this.t).thrustN > 0 ? "boost" : "coast";
    return { id: this.id, specId: this.spec.id, positionEnuM: [...this.p], velocityEnuMps: [...this.v], timeS: this.t, phase: ph, seekerLocked: this.locked, ...(this.dead ? { reason: this.dead } : {}) };
  }

  public get alive(): boolean { return !this.dead; }
  public kill(reason: string): void { this.dead = reason; }

  /** Seeker measurement: line of sight to the target (world unit), or null. */
  private seek(scene: SensorScene, link: LauncherLink): Vector3 | null {
    const sk = this.spec.seeker.value;
    const axis = unit(this.v);
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

  public step(scene: SensorScene, dt: number, groundHeightAt: (x: number, y: number) => number): void {
    if (this.dead) return;
    this.t += dt;
    const spec = this.spec;
    const link = this.link();
    const atm = standardAtmosphere(Math.min(80000, Math.max(0, this.p[2])));
    const speed = norm(this.v);
    const mach = speed / atm.speedOfSoundMps;
    const q = 0.5 * atm.densityKgM3 * speed * speed;
    const S = Math.PI * (spec.diameterM.value / 2) ** 2;
    const { thrustN, mdot } = motorAt(spec, this.t);
    this.mass = Math.max(this.mass - mdot * dt, spec.launchMassKg.value * 0.4);
    const fwd = speed > 1 ? scale(this.v, 1 / speed) : [1, 0, 0] as Vector3;

    // ---- guidance → commanded lateral acceleration ----
    let cmd: Vector3 = [0, 0, 0];
    const G_ = spec.guidance.value;
    this.dtLast = dt;
    if (this.t > G_.safeSeparationS) {
      const los = this.seek(scene, link);
      this.locked = !!los;
      if (los) {
        if (this.lastLos) {
          // LOS rate: from the seeker's own track filter when it has one, else by differencing.
          const losRate = this.sarhRate ?? scale(sub(los, this.lastLos), 1 / dt);
          // Proportional navigation: a = N · Vc · u̇ (u = line-of-sight unit vector).
          const tgtEst = link.targetEstimate;
          const vc = tgtEst ? -dot(sub(tgtEst.velocityEnuMps, this.v), los) : speed;
          cmd = scale(losRate, G_.navConstant * Math.max(vc, 200));
        }
        this.lastLos = los;
      } else if (G_.midcourse !== "none" && link.targetEstimate) {
        // Inertial midcourse to the predicted intercept point (radio-corrected while the launcher tracks).
        const tg = link.targetEstimate;
        const rel = sub(tg.positionEnuM, this.p);
        const tgo = norm(rel) / Math.max(300, speed);
        const aim = unit(add(rel, scale(tg.velocityEnuMps, tgo)));
        const lat = sub(aim, scale(fwd, dot(aim, fwd)));
        cmd = scale(lat, (3 * speed) / Math.max(1, tgo));
        this.lastLos = null;
      }
      // Gravity compensation (lateral component of +g).
      const up: Vector3 = [0, 0, G];
      cmd = add(cmd, sub(up, scale(fwd, dot(up, fwd))));
    }
    // Limits: structure (max g) and lift (q·S·CLmax / m).
    const aMax = Math.min(spec.maxG.value * G, (q * S * spec.aero.value.clMax) / this.mass);
    const lat = sub(cmd, scale(fwd, dot(cmd, fwd)));
    const latN = norm(lat);
    const latC = latN > aMax ? scale(lat, aMax / latN) : lat;
    // First-order airframe response.
    const k = Math.min(1, dt / spec.responseS.value);
    this.a = add(this.a, scale(sub(latC, this.a), k));
    const aLat = norm(this.a);
    const cl = q > 1 ? (this.mass * aLat) / (q * S) : 0;
    const drag = q * S * (cd0At(spec, mach) + spec.aero.value.k * cl * cl);
    const along = (thrustN - drag) / this.mass;
    const acc = add(add(scale(fwd, along), this.a), [0, 0, -G]);
    this.v = [this.v[0] + acc[0] * dt, this.v[1] + acc[1] * dt, this.v[2] + acc[2] * dt];
    this.p = [this.p[0] + this.v[0] * dt, this.p[1] + this.v[1] * dt, this.p[2] + this.v[2] * dt];

    const gh = groundHeightAt(this.p[0], this.p[1]);
    if (Number.isFinite(gh) && this.p[2] <= gh) this.dead = "ground";
    else if (this.t > G_.maxFlightS) this.dead = "flight time";
    else if (thrustN === 0 && norm(this.v) < 250) this.dead = "energy";
  }

  /** Proximity fuze input from the world: distance to the nearest target this tick. Returns true to detonate. */
  public fuze(distanceM: number): boolean {
    if (this.dead || this.t < this.spec.fuze.value.armingTimeS) return false;
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
    let best = Infinity;
    let r0 = sub(m.state.positionEnuM, tp);
    for (let t = 0; t < spec.guidance.value.maxFlightS && m.alive; t += dt) {
      tp = add(tp, scale(target.velocityEnuMps, dt));
      m.step(ideal, dt, () => -1e9);
      const r1 = sub(m.state.positionEnuM, tp);
      const d = closestApproach(r0, r1);
      r0 = r1;
      best = Math.min(best, d);
      if (d < spec.warhead.value.lethalRadiusM * 1.5) return t > spec.fuze.value.armingTimeS;
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
