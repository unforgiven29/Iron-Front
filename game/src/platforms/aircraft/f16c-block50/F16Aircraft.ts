/**
 * F-16C Block 50 vertical-slice aircraft: composes the F-16-specific flight model, actuators,
 * engine and FLCS onto the shared rigid body, environment, terrain and scheduler.
 *
 * Presentation reads `snapshot()` and writes `setPilotInputs()` / `setThrottle()` only.
 * Not yet modelled (see package README): landing gear and ground handling, LEF/TEF/speedbrake,
 * hydraulic/electrical networks, fuel-mass and CG change, damage, stores and avionics.
 */
import type { Quaternion, Vector3 } from "../../../core/coordinates/CoordinateFrames.js";
import { SimulationScheduler } from "../../../core/simulation/SimulationScheduler.js";
import { localAirflow, sampleEnvironment, standardAtmosphere, type EnvironmentConfig } from "../../../physics/environment/Atmosphere.js";
import { RigidBody, rotateVector } from "../../../physics/rigidbody/RigidBody.js";
import type { TerrainSurface } from "../../../world/terrain/Terrain.js";
import { F16_MASS } from "./F16Data.js";
import { F16FlightControls, type PilotInputs } from "./F16FlightControls.js";
import { createF16Actuators, f16Aerodynamics, F16Engine, f16InertiaTensor, type EngineState, type SurfaceDeflections } from "./F16FlightModel.js";

export type F16GroundStatus =
  | { readonly kind: "airborne"; readonly aglM: number }
  | { readonly kind: "crashed"; readonly impactSpeedMps: number }
  | { readonly kind: "terrain-unknown"; readonly reason: string };

export interface F16Snapshot {
  readonly tick: number;
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  readonly bodyToWorld: Quaternion;
  readonly ratesRadps: Vector3;
  readonly altitudeMslM: number;
  readonly trueAirspeedMps: number;
  /** Calibrated-like airspeed from dynamic pressure at sea-level density (no position error model). */
  readonly equivalentAirspeedMps: number;
  readonly mach: number;
  readonly alphaRad: number;
  readonly betaRad: number;
  readonly nzG: number;
  readonly headingRad: number;
  readonly pitchRad: number;
  readonly rollRad: number;
  readonly verticalSpeedMps: number;
  readonly pilot: PilotInputs;
  readonly throttle: number;
  readonly surfaces: SurfaceDeflections;
  readonly engine: EngineState;
  readonly alphaLimiting: boolean;
  readonly outsideAeroEnvelope: boolean;
  readonly aeroEnvelopeReasons: readonly string[];
  readonly ground: F16GroundStatus;
  /** Scheduler task faults so far (a faulted task is disabled; the view must show this). */
  readonly faults: readonly string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const SEA_LEVEL_DENSITY = standardAtmosphere(0).densityKgM3;

export interface F16StartState {
  readonly positionEnuM: Vector3;
  /** Compass heading, rad (0 = north, clockwise). */
  readonly headingRad: number;
  readonly speedMps: number;
  readonly throttle: number;
}

export class F16Aircraft {
  public readonly scheduler = new SimulationScheduler({ stepSeconds: 1 / 120, maxStepsPerFrame: 30 });
  private body!: RigidBody;
  private readonly actuators = createF16Actuators();
  private engine!: F16Engine;
  private readonly flcs = new F16FlightControls();
  private pilot: PilotInputs = { pitch: 0, roll: 0, yaw: 0 };
  private throttle = 0.5;
  private nz = 1;
  private faults: string[] = [];
  private ground: F16GroundStatus = { kind: "terrain-unknown", reason: "not sampled" };
  private last!: F16Snapshot;
  private aeroState = { alpha: 0, beta: 0, tas: 0, eas: 0, mach: 0, limiting: false, outside: false, reasons: [] as readonly string[] };

  public constructor(private readonly terrain: TerrainSurface, private readonly env: EnvironmentConfig, start: F16StartState) {
    this.reset(start);
    this.scheduler.register({ id: "f16.flight", phase: "integration", run: (ctx) => this.step(ctx.stepSeconds) });
    this.scheduler.register({ id: "f16.ground", phase: "commit-events", run: () => this.checkGround() });
    this.scheduler.register({ id: "f16.snapshot", phase: "publish", run: (ctx) => { this.last = this.snapshotAt(ctx.tick); } });
  }

  public reset(start: F16StartState): void {
    // Body FRD -> ENU for a level aircraft on compass heading h: forward (sin h, cos h, 0), down (0,0,-1).
    const h = start.headingRad;
    const yaw = -h + Math.PI / 2; // ENU angle of the forward vector from east, CCW
    const qYaw: Quaternion = [0, 0, Math.sin(yaw / 2), Math.cos(yaw / 2)];
    const flip: Quaternion = [1, 0, 0, 0]; // FRD -> ENU at east heading
    const q = mul(qYaw, flip);
    this.body = new RigidBody(
      { massKg: F16_MASS.massKg.value, inertiaKgM2: f16InertiaTensor() },
      { positionEnuM: start.positionEnuM, velocityEnuMps: rotateVector(q, [start.speedMps, 0, 0]), bodyToWorld: q, angularVelocityBodyRadps: [0, 0, 0] }
    );
    this.engine = new F16Engine(start.throttle);
    this.throttle = start.throttle;
    for (const a of Object.values(this.actuators)) a.reset();
    this.flcs.reset();
    this.pilot = { pitch: 0, roll: 0, yaw: 0 };
    this.nz = 1;
    this.ground = { kind: "terrain-unknown", reason: "not sampled" };
    this.checkGround();
    this.last = this.snapshotAt(this.scheduler.currentTick);
  }

  public setPilotInputs(p: PilotInputs): void {
    this.pilot = { pitch: clamp(p.pitch, -1, 1), roll: clamp(p.roll, -1, 1), yaw: clamp(p.yaw, -1, 1) };
  }

  public setThrottle(t: number): void {
    this.throttle = clamp(t, 0, 1);
  }

  /** Advance by browser frame time; faults are recorded and surfaced in the snapshot. */
  public advanceFrame(frameDeltaSeconds: number): void {
    for (const f of this.scheduler.advanceFrame(frameDeltaSeconds).faults) this.faults.push(`${f.source}@${f.phase} tick ${f.tick}: ${f.message}`);
  }

  /** Advance exactly one tick (tests, replay). */
  public stepTick(): void {
    for (const f of this.scheduler.step()) this.faults.push(`${f.source}@${f.phase} tick ${f.tick}: ${f.message}`);
  }

  public snapshot(): F16Snapshot {
    return this.last;
  }

  private step(dt: number): void {
    if (this.ground.kind === "crashed") return;
    const st = this.body.state;
    const env = sampleEnvironment(this.env, st.positionEnuM, 0);
    const flow = localAirflow(st.velocityEnuMps, st.bodyToWorld, env);
    const V = flow.trueAirspeedMps;
    const [u, v, w] = flow.airVelocityBodyMps;
    const alpha = V > 1 ? Math.atan2(w, u) : 0;
    const beta = V > 1 ? Math.asin(clamp(v / V, -1, 1)) : 0;
    const att = attitude(st.bodyToWorld);

    const fc = this.flcs.step(this.pilot, {
      nzG: this.nz, alphaRad: alpha, betaRad: beta, ratesRadps: st.angularVelocityBodyRadps,
      dynamicPressurePa: flow.dynamicPressurePa, pitchRad: att.pitch, rollRad: att.roll
    }, dt);
    const surfaces: SurfaceDeflections = {
      elevatorDeg: this.actuators.elevator.step(fc.commands.elevatorDeg, dt),
      aileronDeg: this.actuators.aileron.step(fc.commands.aileronDeg, dt),
      rudderDeg: this.actuators.rudder.step(fc.commands.rudderDeg, dt)
    };
    const engine = this.engine.step(this.throttle, env.atmosphere.densityKgM3 / SEA_LEVEL_DENSITY, dt);
    const aero = f16Aerodynamics({
      alphaRad: alpha, betaRad: beta, trueAirspeedMps: V, dynamicPressurePa: flow.dynamicPressurePa, mach: flow.machNumber,
      ratesRadps: st.angularVelocityBodyRadps, surfaces, cgFractionMac: F16_MASS.cgFractionMac.value
    });
    // Thrust is modelled along the body x axis through the CG (engine offset/cant not sourced).
    const loads = this.body.step(dt, {
      forces: [
        { sourceId: "f16.aero", frame: "body.frd", forceN: aero.forceBodyN },
        { sourceId: "f16.engine", frame: "body.frd", forceN: [engine.thrustN, 0, 0] }
      ],
      moments: [{ sourceId: "f16.aero.moment", frame: "body.frd", momentNm: aero.momentBodyNm }],
      gravityEnuMps2: env.gravityEnuMps2
    });
    const fBody = rotateVector([-st.bodyToWorld[0], -st.bodyToWorld[1], -st.bodyToWorld[2], st.bodyToWorld[3]], loads.forceEnuN);
    this.nz = -fBody[2] / (F16_MASS.massKg.value * 9.80665);
    this.aeroState = {
      alpha, beta, tas: V, eas: Math.sqrt((2 * flow.dynamicPressurePa) / SEA_LEVEL_DENSITY), mach: flow.machNumber,
      limiting: fc.alphaLimiting, outside: aero.outsideEnvelope, reasons: aero.envelopeReasons
    };
  }

  private checkGround(): void {
    if (this.ground.kind === "crashed") return;
    const p = this.body.state.positionEnuM;
    const s = this.terrain.sample(p[0], p[1]);
    if (s.status !== "valid") { this.ground = { kind: "terrain-unknown", reason: s.reason }; return; }
    const agl = p[2] - s.heightM;
    this.ground = agl <= 0 ? { kind: "crashed", impactSpeedMps: Math.hypot(...this.body.state.velocityEnuMps) } : { kind: "airborne", aglM: agl };
  }

  private snapshotAt(tick: number): F16Snapshot {
    const st = this.body.state;
    const att = attitude(st.bodyToWorld);
    return Object.freeze({
      tick,
      positionEnuM: st.positionEnuM,
      velocityEnuMps: st.velocityEnuMps,
      bodyToWorld: st.bodyToWorld,
      ratesRadps: st.angularVelocityBodyRadps,
      altitudeMslM: this.env.originAltitudeMslM + st.positionEnuM[2],
      trueAirspeedMps: this.aeroState.tas,
      equivalentAirspeedMps: this.aeroState.eas,
      mach: this.aeroState.mach,
      alphaRad: this.aeroState.alpha,
      betaRad: this.aeroState.beta,
      nzG: this.nz,
      headingRad: att.heading,
      pitchRad: att.pitch,
      rollRad: att.roll,
      verticalSpeedMps: st.velocityEnuMps[2],
      pilot: this.pilot,
      throttle: this.throttle,
      surfaces: { elevatorDeg: this.actuators.elevator.positionDeg, aileronDeg: this.actuators.aileron.positionDeg, rudderDeg: this.actuators.rudder.positionDeg },
      engine: this.engine.state,
      alphaLimiting: this.aeroState.limiting,
      outsideAeroEnvelope: this.aeroState.outside,
      aeroEnvelopeReasons: this.aeroState.reasons,
      ground: this.ground,
      faults: [...this.faults]
    });
  }
}

function mul(a: Quaternion, b: Quaternion): Quaternion {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}

/** Compass heading (0 = north, clockwise), pitch and bank (right wing down positive). */
export function attitude(q: Quaternion): { heading: number; pitch: number; roll: number } {
  const fwd = rotateVector(q, [1, 0, 0]), right = rotateVector(q, [0, 1, 0]), up = rotateVector(q, [0, 0, -1]);
  return { heading: Math.atan2(fwd[0], fwd[1]), pitch: Math.asin(clamp(fwd[2], -1, 1)), roll: Math.atan2(-right[2], up[2]) };
}
