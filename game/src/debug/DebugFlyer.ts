/**
 * Debug flyer: a fictional test airframe for exercising Stage 2 physics in the browser.
 *
 * THIS IS NOT AN AIRCRAFT MODEL. Every number in TEST_AIRFRAME is a synthetic, hand-picked
 * value chosen only to be stable and flyable at 120 Hz. None of them describe a real aircraft.
 * The aerodynamics are a few linear stability-derivative terms with a crude stall break. That
 * is enough to feel the rigid body, atmosphere, wind and terrain working together. Real aircraft
 * are Stage 3 packages with their own sourced data.
 *
 * Shared services used: SimulationScheduler (fixed tick), RigidBody (6-DoF RK4),
 * sampleEnvironment/localAirflow (ISO 2533 atmosphere, wind) and TerrainSurface (ground).
 * The view reads only `snapshot()` and writes only `setControls()`.
 */
import type { Quaternion, Vector3 } from "../core/coordinates/CoordinateFrames.js";
import { SimulationScheduler } from "../core/simulation/SimulationScheduler.js";
import { layeredWind, localAirflow, sampleEnvironment, type EnvironmentConfig, type EnvironmentSample } from "../physics/environment/Atmosphere.js";
import { RigidBody, rotateVector, type ForceContribution, type MomentContribution } from "../physics/rigidbody/RigidBody.js";
import { generateSyntheticTile, TerrainSurface } from "../world/terrain/Terrain.js";

/** Synthetic test values only. See file header. */
export const TEST_AIRFRAME = Object.freeze({
  massKg: 9000,
  inertiaKgM2: [[12000, 0, 0], [0, 60000, 0], [0, 0, 68000]] as const,
  wingAreaM2: 28,
  spanM: 10,
  chordM: 3,
  maxThrustN: 80000,
  cl0: 0.1, clAlpha: 4.5, stallAlphaRad: 0.28,
  cd0: 0.025, inducedK: 0.08,
  cyBeta: -0.8,
  clBeta: -0.05, clP: -0.5, clAileron: 0.05,
  cmAlpha: -0.6, cmQ: -12, cmElevator: 0.5,
  cnBeta: 0.12, cnR: -0.15, cnRudder: 0.04,
  /** Full control deflection, rad. */
  maxDeflectionRad: 0.35
});

export interface FlyerControls {
  /** -1..1; +1 = stick back (nose up). */
  readonly pitch: number;
  /** -1..1; +1 = stick right (roll right). */
  readonly roll: number;
  /** -1..1; +1 = right pedal (nose right). */
  readonly yaw: number;
  /** 0..1. */
  readonly throttle: number;
}

export type GroundStatus =
  | { readonly kind: "airborne"; readonly aglM: number; readonly terrainHeightM: number }
  | { readonly kind: "crashed"; readonly tick: number; readonly impactSpeedMps: number }
  | { readonly kind: "terrain-unknown"; readonly reason: string };

export interface FlyerSnapshot {
  readonly tick: number;
  readonly timeSeconds: number;
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  readonly bodyToWorld: Quaternion;
  readonly angularVelocityBodyRadps: Vector3;
  readonly controls: FlyerControls;
  readonly trueAirspeedMps: number;
  readonly mach: number;
  readonly alphaRad: number;
  readonly betaRad: number;
  /** Load factor along body -z (positive in normal flight), in g. */
  readonly loadFactorG: number;
  readonly altitudeMslM: number;
  readonly headingRad: number;
  readonly pitchRad: number;
  readonly rollRad: number;
  readonly ground: GroundStatus;
  readonly stalled: boolean;
  readonly densityKgM3: number;
  readonly windEnuMps: Vector3;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Lift coefficient with a crude, symmetric post-stall drop. Synthetic. */
function liftCoefficient(alpha: number): { cl: number; stalled: boolean } {
  const a = TEST_AIRFRAME;
  if (Math.abs(alpha) <= a.stallAlphaRad) return { cl: a.cl0 + a.clAlpha * alpha, stalled: false };
  const peak = a.cl0 + a.clAlpha * a.stallAlphaRad * Math.sign(alpha);
  const excess = Math.abs(alpha) - a.stallAlphaRad;
  return { cl: peak * Math.max(0.35, 1 - 2.5 * excess), stalled: true };
}

/** Build the synthetic test terrain: 5x5 tiles of 8 km, centred on the origin. */
export function createTestTerrain(seed = 7): TerrainSurface {
  const terrain = new TerrainSurface();
  for (let ty = -2; ty <= 2; ty++) {
    for (let tx = -2; tx <= 2; tx++) {
      terrain.addTile(generateSyntheticTile({
        seed, tileId: `debug/${tx + 2}-${ty + 2}`, originEnuM: [tx * 8000 - 4000, ty * 8000 - 4000],
        spacingM: 100, columns: 81, rows: 81, baseHeightM: 50, reliefM: 1400, featureSizeM: 9000
      }));
    }
  }
  return terrain;
}

export class DebugFlyer {
  public readonly scheduler = new SimulationScheduler({ stepSeconds: 1 / 120, maxStepsPerFrame: 30 });
  public readonly terrain: TerrainSurface;
  private readonly env: EnvironmentConfig = {
    originAltitudeMslM: 0,
    temperatureOffsetK: 0,
    wind: layeredWind("debug.wind", [{ heightM: 0, velocityEnuMps: [2, 1, 0] }, { heightM: 3000, velocityEnuMps: [12, -4, 0] }])
  };
  private body!: RigidBody;
  private controls: FlyerControls = { pitch: 0, roll: 0, yaw: 0, throttle: 0.55 };
  private ground: GroundStatus = { kind: "terrain-unknown", reason: "not sampled yet" };
  private last!: FlyerSnapshot;
  private lastEnv!: EnvironmentSample;
  private lastAero = { alpha: 0, beta: 0, tas: 0, mach: 0, nz: 1, stalled: false };

  public constructor(terrain: TerrainSurface = createTestTerrain()) {
    this.terrain = terrain;
    this.reset();
    this.scheduler.register({ id: "flyer.dynamics", phase: "integration", run: (ctx) => this.integrate(ctx.stepSeconds) });
    this.scheduler.register({ id: "flyer.ground", phase: "commit-events", run: (ctx) => this.checkGround(ctx.tick) });
    this.scheduler.register({ id: "flyer.snapshot", phase: "publish", run: (ctx) => { this.last = this.buildSnapshot(ctx.tick); } });
    this.last = this.buildSnapshot(this.scheduler.currentTick);
  }

  /** Start 1 500 m above the terrain at the origin, heading north at 170 m/s, level. */
  public reset(): void {
    const s = this.terrain.sample(0, 0);
    const groundHeight = s.status === "valid" ? s.heightM : 0;
    // Heading north: body forward -> +y, right -> +x (east), down -> -z.
    const north: Quaternion = [Math.SQRT1_2, Math.SQRT1_2, 0, 0];
    this.body = new RigidBody(
      { massKg: TEST_AIRFRAME.massKg, inertiaKgM2: TEST_AIRFRAME.inertiaKgM2 as unknown as RigidBody["massProperties"]["inertiaKgM2"] },
      { positionEnuM: [0, 0, groundHeight + 1500], velocityEnuMps: [0, 170, 0], bodyToWorld: north, angularVelocityBodyRadps: [0, 0, 0] }
    );
    this.controls = { pitch: 0, roll: 0, yaw: 0, throttle: 0.55 };
    this.ground = { kind: "terrain-unknown", reason: "not sampled yet" };
    this.checkGround(this.scheduler.currentTick);
    if (this.last) this.last = this.buildSnapshot(this.scheduler.currentTick);
  }

  /** Controls are applied at the next tick; values are clamped to their ranges. */
  public setControls(c: FlyerControls): void {
    this.controls = { pitch: clamp(c.pitch, -1, 1), roll: clamp(c.roll, -1, 1), yaw: clamp(c.yaw, -1, 1), throttle: clamp(c.throttle, 0, 1) };
  }

  public advanceFrame(frameDeltaSeconds: number): void {
    this.scheduler.advanceFrame(frameDeltaSeconds);
  }

  public snapshot(): FlyerSnapshot {
    return this.last;
  }

  private integrate(dt: number): void {
    if (this.ground.kind === "crashed") return;
    const st = this.body.state;
    const env = sampleEnvironment(this.env, st.positionEnuM, this.scheduler.currentTick * dt);
    this.lastEnv = env;
    const flow = localAirflow(st.velocityEnuMps, st.bodyToWorld, env);
    const a = TEST_AIRFRAME;
    const forces: ForceContribution[] = [{ sourceId: "test.thrust", frame: "body.frd", forceN: [a.maxThrustN * this.controls.throttle, 0, 0] }];
    const moments: MomentContribution[] = [];
    const V = flow.trueAirspeedMps;
    let alpha = 0, beta = 0, stalled = false;
    if (V > 1) {
      const [u, v, w] = flow.airVelocityBodyMps;
      alpha = Math.atan2(w, u);
      beta = Math.asin(clamp(v / V, -1, 1));
      const qS = flow.dynamicPressurePa * a.wingAreaM2;
      const lift = liftCoefficient(alpha);
      stalled = lift.stalled;
      const cd = a.cd0 + a.inducedK * lift.cl * lift.cl + (stalled ? 0.4 * (Math.abs(alpha) - a.stallAlphaRad) : 0);
      // Drag opposes the air-relative velocity; lift is perpendicular to it in the body x-z plane.
      const drag: Vector3 = [-(u / V) * qS * cd, -(v / V) * qS * cd, -(w / V) * qS * cd];
      const liftVec: Vector3 = [Math.sin(alpha) * qS * lift.cl, 0, -Math.cos(alpha) * qS * lift.cl];
      forces.push({ sourceId: "test.aero.drag", frame: "body.frd", forceN: drag });
      forces.push({ sourceId: "test.aero.lift", frame: "body.frd", forceN: liftVec });
      forces.push({ sourceId: "test.aero.side", frame: "body.frd", forceN: [0, qS * a.cyBeta * beta, 0] });
      const [p, q, r] = st.angularVelocityBodyRadps;
      const d = a.maxDeflectionRad;
      moments.push({
        sourceId: "test.aero.moments", frame: "body.frd",
        momentNm: [
          qS * a.spanM * (a.clBeta * beta + a.clP * (p * a.spanM) / (2 * V) + a.clAileron * this.controls.roll * d),
          qS * a.chordM * (a.cmAlpha * alpha + a.cmQ * (q * a.chordM) / (2 * V) + a.cmElevator * this.controls.pitch * d),
          qS * a.spanM * (a.cnBeta * beta + a.cnR * (r * a.spanM) / (2 * V) + a.cnRudder * this.controls.yaw * d)
        ]
      });
    }
    const loads = this.body.step(dt, { forces, moments, gravityEnuMps2: env.gravityEnuMps2 });
    const forceBody = rotateVector([-st.bodyToWorld[0], -st.bodyToWorld[1], -st.bodyToWorld[2], st.bodyToWorld[3]], loads.forceEnuN);
    this.lastAero = { alpha, beta, tas: V, mach: flow.machNumber, nz: -forceBody[2] / (a.massKg * 9.80665), stalled };
  }

  private checkGround(tick: number): void {
    if (this.ground.kind === "crashed") return;
    const st = this.body.state;
    const s = this.terrain.sample(st.positionEnuM[0], st.positionEnuM[1]);
    if (s.status !== "valid") {
      this.ground = { kind: "terrain-unknown", reason: s.reason };
      return;
    }
    const agl = st.positionEnuM[2] - s.heightM;
    this.ground = agl <= 0
      ? { kind: "crashed", tick, impactSpeedMps: Math.hypot(...st.velocityEnuMps) }
      : { kind: "airborne", aglM: agl, terrainHeightM: s.heightM };
  }

  private buildSnapshot(tick: number): FlyerSnapshot {
    const st = this.body.state;
    const fwd = rotateVector(st.bodyToWorld, [1, 0, 0]);
    const right = rotateVector(st.bodyToWorld, [0, 1, 0]);
    const up = rotateVector(st.bodyToWorld, [0, 0, -1]);
    const env = this.lastEnv ?? sampleEnvironment(this.env, st.positionEnuM, 0);
    return Object.freeze({
      tick,
      timeSeconds: tick * this.scheduler.stepSeconds,
      positionEnuM: st.positionEnuM,
      velocityEnuMps: st.velocityEnuMps,
      bodyToWorld: st.bodyToWorld,
      angularVelocityBodyRadps: st.angularVelocityBodyRadps,
      controls: this.controls,
      trueAirspeedMps: this.lastAero.tas,
      mach: this.lastAero.mach,
      alphaRad: this.lastAero.alpha,
      betaRad: this.lastAero.beta,
      loadFactorG: this.lastAero.nz,
      altitudeMslM: this.env.originAltitudeMslM + st.positionEnuM[2],
      // Compass heading: 0 = north, clockwise positive.
      headingRad: Math.atan2(fwd[0], fwd[1]),
      pitchRad: Math.asin(clamp(fwd[2], -1, 1)),
      // Bank: right wing down positive.
      rollRad: Math.atan2(-right[2], up[2]),
      ground: this.ground,
      stalled: this.lastAero.stalled,
      densityKgM3: env.atmosphere.densityKgM3,
      windEnuMps: env.windEnuMps
    });
  }
}
