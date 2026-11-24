/**
 * Shared fixed-wing aircraft runtime. Composes ANY AircraftDefinition onto the shared rigid
 * body, atmosphere/wind, terrain, turbofan cycle, actuators, switch registry and scheduler.
 * It contains no aircraft-specific code or values: those come from the definition.
 *
 * Per tick (integration phase): sense → FCS → actuators → scheduled devices → engines → aero →
 * rigid body. Ground contact is checked in commit-events, and the snapshot is published last.
 * Presentation reads `snapshot()` and writes only pilot inputs, throttle and switch requests.
 */
import type { Quaternion, Vector3 } from "../../../core/coordinates/CoordinateFrames.js";
import { ControlRegistry } from "../../../core/controls/ControlRegistry.js";
import { SimulationScheduler } from "../../../core/simulation/SimulationScheduler.js";
import { localAirflow, sampleEnvironment, standardAtmosphere, type EnvironmentConfig } from "../../../physics/environment/Atmosphere.js";
import { MixedFlowTurbofan, type TurbofanState } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import { RigidBody, rotateVector, type Matrix3 } from "../../../physics/rigidbody/RigidBody.js";
import type { TerrainSurface } from "../../../world/terrain/Terrain.js";
import type { AircraftDefinition, AircraftSystems, FlightSensors, PilotInputs, SurfacePositions } from "./AircraftDefinition.js";
import { SurfaceActuator } from "./SurfaceActuator.js";

export type GroundStatus =
  | { readonly kind: "airborne"; readonly aglM: number }
  | { readonly kind: "crashed"; readonly impactSpeedMps: number }
  | { readonly kind: "terrain-unknown"; readonly reason: string };

export interface EngineSnapshot extends TurbofanState {
  readonly id: string;
}

export interface AircraftSnapshot {
  readonly aircraftId: string;
  readonly tick: number;
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  readonly bodyToWorld: Quaternion;
  readonly ratesRadps: Vector3;
  readonly altitudeMslM: number;
  readonly trueAirspeedMps: number;
  /** Equivalent airspeed from dynamic pressure (no instrument position-error model). */
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
  /** Achieved positions of every control surface and scheduled device, degrees. */
  readonly surfaces: SurfacePositions;
  readonly engines: readonly EngineSnapshot[];
  readonly fuelKg: number;
  readonly massKg: number;
  readonly fcsMode: string;
  readonly annunciations: readonly string[];
  readonly cgFractionMac: number;
  readonly outsideAeroEnvelope: boolean;
  readonly aeroEnvelopeReasons: readonly string[];
  readonly ground: GroundStatus;
  readonly switches: Readonly<Record<string, string>>;
  readonly faults: readonly string[];
}

export interface StartState {
  readonly positionEnuM: Vector3;
  /** Compass heading, rad (0 = north, clockwise). */
  readonly headingRad: number;
  readonly speedMps: number;
  readonly throttle: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const SEA_LEVEL_DENSITY = standardAtmosphere(0).densityKgM3;

export class FixedWingAircraft {
  public readonly scheduler = new SimulationScheduler({ stepSeconds: 1 / 120, maxStepsPerFrame: 30 });
  public readonly controls = new ControlRegistry();
  private readonly systems: AircraftSystems;
  private readonly actuators: ReadonlyMap<string, SurfaceActuator>;
  private engines: { id: string; core: MixedFlowTurbofan; install: AircraftDefinition["engines"][number] }[] = [];
  private body!: RigidBody;
  private fuelKg = 0;
  private cgFractionMac: number;
  private pilot: PilotInputs = { pitch: 0, roll: 0, yaw: 0 };
  private throttle = 0.5;
  private nz = 1;
  private devicePositions: SurfacePositions = {};
  private fcsMode = "";
  private annunciations: readonly string[] = [];
  private faults: string[] = [];
  private ground: GroundStatus = { kind: "terrain-unknown", reason: "not sampled" };
  private last!: AircraftSnapshot;
  private air = { alpha: 0, beta: 0, tas: 0, eas: 0, mach: 0, outside: false, reasons: [] as readonly string[] };

  public constructor(public readonly definition: AircraftDefinition, private readonly terrain: TerrainSurface, private readonly env: EnvironmentConfig, start: StartState) {
    this.systems = definition.createSystems();
    this.cgFractionMac = definition.mass.cgFractionMac;
    this.actuators = new Map(definition.surfaces.map((s) => [s.id, new SurfaceActuator(s.limitDeg, s.rateDegS, s.bandwidthRadS)]));
    const context = { setCgFractionMac: (v: number) => { this.cgFractionMac = v; } };
    for (const sw of this.systems.switches) {
      this.controls.defineSwitch(sw.definition, ({ to }) => sw.onChange(to, context));
    }
    this.reset(start);
    this.scheduler.register({ id: `${definition.manifest.id}.flight`, phase: "integration", run: (ctx) => this.step(ctx.stepSeconds) });
    this.scheduler.register({ id: `${definition.manifest.id}.ground`, phase: "commit-events", run: () => this.checkGround() });
    this.scheduler.register({ id: `${definition.manifest.id}.snapshot`, phase: "publish", run: (ctx) => { this.last = this.snapshotAt(ctx.tick); } });
  }

  /** Keyboard keys the package binds to switches. */
  public get switchKeys(): readonly { readonly key: string; readonly switchId: string }[] {
    return this.systems.switches.filter((s) => s.key).map((s) => ({ key: s.key as string, switchId: s.definition.id }));
  }

  public reset(start: StartState): void {
    const yaw = -start.headingRad + Math.PI / 2;
    const q = mul([0, 0, Math.sin(yaw / 2), Math.cos(yaw / 2)], [1, 0, 0, 0]);
    this.fuelKg = this.definition.mass.internalFuelKg;
    this.body = new RigidBody(
      this.massProperties(),
      { positionEnuM: start.positionEnuM, velocityEnuMps: rotateVector(q, [start.speedMps, 0, 0]), bodyToWorld: q, angularVelocityBodyRadps: [0, 0, 0] }
    );
    this.engines = this.definition.engines.map((install) => ({ id: install.id, install, core: new MixedFlowTurbofan(install.design, install.afterburnerDetentThrottle, start.throttle) }));
    this.throttle = start.throttle;
    for (const a of this.actuators.values()) a.reset();
    this.systems.fcs.reset();
    this.systems.devices?.reset();
    // Switches return to their defaults (owner logic decides what that means).
    for (const sw of this.systems.switches) {
      if (this.controls.position(sw.definition.id) !== sw.definition.defaultPosition) this.controls.request(sw.definition.id, sw.definition.defaultPosition, "reset");
    }
    this.pilot = { pitch: 0, roll: 0, yaw: 0 };
    this.nz = 1;
    this.devicePositions = {};
    this.fcsMode = this.systems.fcs.mode();
    this.annunciations = [];
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

  public advanceFrame(frameDeltaSeconds: number): void {
    for (const f of this.scheduler.advanceFrame(frameDeltaSeconds).faults) this.faults.push(`${f.source}@${f.phase} tick ${f.tick}: ${f.message}`);
  }

  public stepTick(): void {
    for (const f of this.scheduler.step()) this.faults.push(`${f.source}@${f.phase} tick ${f.tick}: ${f.message}`);
  }

  public snapshot(): AircraftSnapshot {
    return this.last;
  }

  /** Current mass properties: empty mass + fuel, inertia scaled with mass (see MassProperties). */
  private massProperties(): { massKg: number; inertiaKgM2: Matrix3 } {
    const m = this.definition.mass;
    const massKg = m.emptyMassKg + this.fuelKg;
    const k = massKg / m.referenceMassKg;
    const I = m.inertiaKgM2;
    return { massKg, inertiaKgM2: [[I[0][0] * k, I[0][1] * k, I[0][2] * k], [I[1][0] * k, I[1][1] * k, I[1][2] * k], [I[2][0] * k, I[2][1] * k, I[2][2] * k]] };
  }

  private surfacePositions(): Record<string, number> {
    const out: Record<string, number> = { ...this.devicePositions };
    for (const [id, a] of this.actuators) out[id] = a.positionDeg;
    return out;
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
    const sensors: FlightSensors = {
      nzG: this.nz, alphaRad: alpha, betaRad: beta, ratesRadps: st.angularVelocityBodyRadps,
      dynamicPressurePa: flow.dynamicPressurePa, staticPressurePa: env.atmosphere.pressurePa, mach: flow.machNumber,
      pitchRad: att.pitch, rollRad: att.roll
    };

    const fcs = this.systems.fcs.step(this.pilot, sensors, this.surfacePositions(), dt);
    for (const [id, actuator] of this.actuators) actuator.step(fcs.commands[id] ?? 0, dt);
    this.devicePositions = this.systems.devices?.step(sensors, dt) ?? {};
    this.fcsMode = fcs.mode;
    this.annunciations = fcs.annunciations;

    const ambient = { temperatureK: env.atmosphere.temperatureK, pressurePa: env.atmosphere.pressurePa, mach: flow.machNumber };
    const forces = [];
    let totalFlow = 0;
    for (const e of this.engines) {
      const s = e.core.step(this.throttle, ambient, this.fuelKg > 0, dt);
      totalFlow += s.fuelFlowKgS;
      const a = e.install.thrustAxisBody;
      forces.push({ sourceId: `engine.${e.id}`, frame: "body.frd" as const, forceN: [a[0] * s.netThrustN, a[1] * s.netThrustN, a[2] * s.netThrustN] as Vector3, applicationPointBodyM: e.install.positionBodyM });
    }
    this.fuelKg = Math.max(0, this.fuelKg - totalFlow * dt);
    // Mass properties change only between integration steps.
    this.body.setMassProperties(this.massProperties());

    const aero = this.systems.aero.compute({
      alphaRad: alpha, betaRad: beta, trueAirspeedMps: V, dynamicPressurePa: flow.dynamicPressurePa, mach: flow.machNumber,
      ratesRadps: st.angularVelocityBodyRadps, surfaces: this.surfacePositions(), cgFractionMac: this.cgFractionMac
    });
    forces.push({ sourceId: "aero.force", frame: "body.frd" as const, forceN: aero.forceBodyN });
    const loads = this.body.step(dt, {
      forces,
      moments: [{ sourceId: "aero.moment", frame: "body.frd", momentNm: aero.momentBodyNm }],
      gravityEnuMps2: env.gravityEnuMps2
    });
    const q = st.bodyToWorld;
    const fBody = rotateVector([-q[0], -q[1], -q[2], q[3]], loads.forceEnuN);
    this.nz = -fBody[2] / (this.body.massProperties.massKg * 9.80665);
    this.air = { alpha, beta, tas: V, eas: Math.sqrt((2 * flow.dynamicPressurePa) / SEA_LEVEL_DENSITY), mach: flow.machNumber, outside: aero.outsideEnvelope, reasons: aero.envelopeReasons };
  }

  private checkGround(): void {
    if (this.ground.kind === "crashed") return;
    const p = this.body.state.positionEnuM;
    const s = this.terrain.sample(p[0], p[1]);
    if (s.status !== "valid") { this.ground = { kind: "terrain-unknown", reason: s.reason }; return; }
    const agl = p[2] - s.heightM;
    this.ground = agl <= 0 ? { kind: "crashed", impactSpeedMps: Math.hypot(...this.body.state.velocityEnuMps) } : { kind: "airborne", aglM: agl };
  }

  private snapshotAt(tick: number): AircraftSnapshot {
    const st = this.body.state;
    const att = attitude(st.bodyToWorld);
    return Object.freeze({
      aircraftId: this.definition.manifest.id,
      tick,
      positionEnuM: st.positionEnuM,
      velocityEnuMps: st.velocityEnuMps,
      bodyToWorld: st.bodyToWorld,
      ratesRadps: st.angularVelocityBodyRadps,
      altitudeMslM: this.env.originAltitudeMslM + st.positionEnuM[2],
      trueAirspeedMps: this.air.tas,
      equivalentAirspeedMps: this.air.eas,
      mach: this.air.mach,
      alphaRad: this.air.alpha,
      betaRad: this.air.beta,
      nzG: this.nz,
      headingRad: att.heading,
      pitchRad: att.pitch,
      rollRad: att.roll,
      verticalSpeedMps: st.velocityEnuMps[2],
      pilot: this.pilot,
      throttle: this.throttle,
      surfaces: Object.freeze(this.surfacePositions()),
      engines: this.engines.map((e) => ({ ...e.core.state, id: e.id })),
      fuelKg: this.fuelKg,
      massKg: this.body.massProperties.massKg,
      fcsMode: this.fcsMode,
      annunciations: this.annunciations,
      cgFractionMac: this.cgFractionMac,
      outsideAeroEnvelope: this.air.outside,
      aeroEnvelopeReasons: this.air.reasons,
      ground: this.ground,
      switches: this.controls.snapshot(),
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
