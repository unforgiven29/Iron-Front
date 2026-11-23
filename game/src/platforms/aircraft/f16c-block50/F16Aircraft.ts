/**
 * F-16C Block 50 vertical-slice aircraft: composes the F-16-specific flight model, actuators,
 * engine and FLCS onto the shared rigid body, environment, terrain and scheduler.
 *
 * Presentation reads `snapshot()` and writes `setPilotInputs()` / `setThrottle()` only.
 * Not yet modelled (see package README): landing gear and ground handling, LEF/TEF/speedbrake,
 * hydraulic/electrical networks, fuel-mass and CG change, damage, stores and avionics.
 */
import type { Quaternion, Vector3 } from "../../../core/coordinates/CoordinateFrames.js";
import { ControlRegistry } from "../../../core/controls/ControlRegistry.js";
import { SimulationScheduler } from "../../../core/simulation/SimulationScheduler.js";
import { localAirflow, sampleEnvironment, standardAtmosphere, type EnvironmentConfig } from "../../../physics/environment/Atmosphere.js";
import { RigidBody, rotateVector } from "../../../physics/rigidbody/RigidBody.js";
import type { TerrainSurface } from "../../../world/terrain/Terrain.js";
import { F16_ACTUATORS, F16_MASS } from "./F16Data.js";
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
  /** FLCS law in effect: NORM (fly-by-wire) or DIRECT (test switch: no augmentation). */
  readonly flcsMode: F16FlcsMode;
  readonly cgFractionMac: number;
  /** Current switch positions from the control registry. */
  readonly switches: Readonly<Record<string, string>>;
}

export type F16FlcsMode = "NORM" | "DIRECT";

/** Switch ids owned by the F-16 package. */
export const F16_SWITCHES = Object.freeze({ flcsMode: "f16.flcs.mode", testCg: "f16.test.cg" });

/** CG test positions (fraction of MAC). 0.35 is the dataset's nominal; aft positions are within the
 * range NASA TP-1538 investigated for relaxed static stability and use the same unmodified tables. */
export const F16_TEST_CG = Object.freeze({ NOMINAL: 0.35, AFT: 0.40, "FULL AFT": 0.45 } as const);

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
  public readonly controls = new ControlRegistry();
  private flcsMode: F16FlcsMode = "NORM";
  private directPitchTrimDeg = 0;
  private cgFractionMac = F16_MASS.cgFractionMac.value;
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
    this.controls.defineSwitch({
      id: F16_SWITCHES.flcsMode, ownerId: "f16.flcs", label: "FLCS MODE", positions: ["NORM", "DIRECT"], defaultPosition: "NORM",
      provenance: "Simulation test switch. The real F-16 has no fly-by-wire OFF switch."
    }, ({ to }) => {
      this.flcsMode = to as F16FlcsMode;
      // Entering DIRECT keeps the current stabilator position as pitch trim (like a trim wheel).
      this.directPitchTrimDeg = to === "DIRECT" ? this.actuators.elevator.positionDeg : 0;
      this.flcs.reset();
      return { accepted: true };
    });
    this.controls.defineSwitch({
      id: F16_SWITCHES.testCg, ownerId: "f16.mass", label: "CG (TEST)", positions: Object.keys(F16_TEST_CG), defaultPosition: "NOMINAL",
      provenance: "Simulation test setting. Moves the CG used by the aero CG-offset terms; mass and inertia are unchanged."
    }, ({ to }) => {
      this.cgFractionMac = F16_TEST_CG[to as keyof typeof F16_TEST_CG];
      return { accepted: true };
    });
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
    this.directPitchTrimDeg = 0;
    if (this.controls.position(F16_SWITCHES.flcsMode) !== "NORM") this.controls.request(F16_SWITCHES.flcsMode, "NORM", "reset");
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
    // DIRECT: stick/pedals map straight to surfaces with no feedback (source sign conventions:
    // negative elevator = nose up, negative aileron = roll right, negative rudder = nose right).
    const a = F16_ACTUATORS;
    const cmd = this.flcsMode === "NORM" ? fc.commands : {
      elevatorDeg: this.directPitchTrimDeg - this.pilot.pitch * a.elevatorLimitDeg.value,
      aileronDeg: -this.pilot.roll * a.aileronLimitDeg.value,
      rudderDeg: -this.pilot.yaw * a.rudderLimitDeg.value
    };
    const surfaces: SurfaceDeflections = {
      elevatorDeg: this.actuators.elevator.step(cmd.elevatorDeg, dt),
      aileronDeg: this.actuators.aileron.step(cmd.aileronDeg, dt),
      rudderDeg: this.actuators.rudder.step(cmd.rudderDeg, dt)
    };
    const engine = this.engine.step(this.throttle, env.atmosphere.densityKgM3 / SEA_LEVEL_DENSITY, dt);
    const aero = f16Aerodynamics({
      alphaRad: alpha, betaRad: beta, trueAirspeedMps: V, dynamicPressurePa: flow.dynamicPressurePa, mach: flow.machNumber,
      ratesRadps: st.angularVelocityBodyRadps, surfaces, cgFractionMac: this.cgFractionMac
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
      limiting: this.flcsMode === "NORM" && fc.alphaLimiting, outside: aero.outsideEnvelope, reasons: aero.envelopeReasons
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
      faults: [...this.faults],
      flcsMode: this.flcsMode,
      cgFractionMac: this.cgFractionMac,
      switches: this.controls.snapshot()
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
