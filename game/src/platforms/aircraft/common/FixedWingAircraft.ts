/**
 * Shared fixed-wing aircraft runtime. Composes ANY AircraftDefinition onto the shared rigid
 * body, atmosphere/wind, terrain, turbofan cycle, actuators, switch registry and scheduler.
 * It contains no aircraft-specific code or values: those come from the definition.
 *
 * Per tick (integration phase): sense → FCS → actuators → scheduled devices → engine controls
 * (FADEC) → engines → aero →
 * rigid body. Ground contact is checked in commit-events, and the snapshot is published last.
 * Presentation reads `snapshot()` and writes only pilot inputs, throttle and switch requests.
 */
import type { Quaternion, Vector3 } from "../../../core/coordinates/CoordinateFrames.js";
import { ControlRegistry } from "../../../core/controls/ControlRegistry.js";
import { SimulationScheduler } from "../../../core/simulation/SimulationScheduler.js";
import { localAirflow, sampleEnvironment, standardAtmosphere, type EnvironmentConfig } from "../../../physics/environment/Atmosphere.js";
import { Fadec, type FadecOutput } from "../../../physics/propulsion/Fadec.js";
import { MixedFlowTurbofan, type TurbofanState } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import { RigidBody, rotateVector, type Matrix3 } from "../../../physics/rigidbody/RigidBody.js";
import type { FuelSystemModel, TankState } from "../../../systems/fuel/FuelTanks.js";
import { HydraulicNetwork, type HydraulicSnapshot } from "../../../systems/hydraulics/HydraulicNetwork.js";
import { LandingGear, type GearStepResult } from "../../../physics/ground-handling/LandingGear.js";
import type { TerrainSurface } from "../../../world/terrain/Terrain.js";
import type { AircraftDefinition, AircraftSystems, FlightSensors, PilotInputs, SurfacePositions } from "./AircraftDefinition.js";
import { SurfaceActuator } from "./SurfaceActuator.js";

export type GroundStatus =
  | { readonly kind: "airborne"; readonly aglM: number }
  | { readonly kind: "on-ground"; readonly groundSpeedMps: number }
  | { readonly kind: "crashed"; readonly impactSpeedMps: number; readonly reason?: string }
  | { readonly kind: "terrain-unknown"; readonly reason: string };

export interface EngineSnapshot extends TurbofanState {
  readonly id: string;
  /** What the engine control is doing: mode, demand and active limiters. */
  readonly control: FadecOutput;
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
  /** Per-tank contents (absent without a package fuel system). */
  readonly fuelTanks?: readonly TankState[];
  readonly massKg: number;
  /** Landing gear state (absent when the aircraft has none). */
  readonly gear?: GearStepResult & { readonly handleDown: boolean };
  /** Hydraulic network state (absent when the aircraft has none). */
  readonly hydraulics?: HydraulicSnapshot;
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
  /** CG position. For a ground start, put the CG at the height it rests at on its gear. */
  readonly positionEnuM: Vector3;
  /** Gear handle at start (default: down for a ground start, up otherwise). */
  readonly gearDown?: boolean;
  readonly onGround?: boolean;
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
  private readonly hydraulics: HydraulicNetwork | undefined;
  private readonly surfaceLimits: ReadonlyMap<string, number>;
  private readonly gear: LandingGear | undefined;
  private gearHandleDown = true;
  private readonly fuelCutoff = new Set<string>();
  private gearCrash: string | undefined;
  private surfaceRates: Record<string, number> = {};
  private engines: { id: string; control: Fadec; core: MixedFlowTurbofan; install: AircraftDefinition["engines"][number] }[] = [];
  private body!: RigidBody;
  private fuelKg = 0;
  private readonly fuelSystem: FuelSystemModel | undefined;
  /** Zero-fuel CG (MAC fraction); the fuel system shifts the actual CG from it. */
  private cgBaseFractionMac: number;
  private cgFractionMac: number;
  private pilot: PilotInputs = { pitch: 0, roll: 0, yaw: 0 };
  private throttle = 0.5;
  private nz = 1;
  private ny = 0;
  private devicePositions: SurfacePositions = {};
  private fcsMode = "";
  private annunciations: readonly string[] = [];
  private faults: string[] = [];
  private ground: GroundStatus = { kind: "terrain-unknown", reason: "not sampled" };
  private last!: AircraftSnapshot;
  private air = { alpha: 0, beta: 0, tas: 0, eas: 0, mach: 0, outside: false, reasons: [] as readonly string[] };

  public constructor(public readonly definition: AircraftDefinition, private readonly terrain: TerrainSurface, private readonly env: EnvironmentConfig, start: StartState) {
    this.systems = definition.createSystems();
    this.cgBaseFractionMac = definition.mass.cgFractionMac;
    this.cgFractionMac = definition.mass.cgFractionMac;
    this.fuelSystem = definition.createFuelSystem?.();
    if (this.fuelSystem && !(definition.mass.macM && definition.mass.macM > 0)) throw new Error(`${definition.manifest.id}: a fuel system needs mass.macM`);
    this.actuators = new Map(definition.surfaces.map((s) => [s.id, new SurfaceActuator(s.limitDeg, s.rateDegS, s.bandwidthRadS, s.minDeg)]));
    this.hydraulics = definition.hydraulics ? new HydraulicNetwork(definition.hydraulics) : undefined;
    this.gear = definition.landingGear ? new LandingGear(definition.landingGear) : undefined;
    this.surfaceLimits = new Map(definition.surfaces.map((s) => [s.id, Math.max(Math.abs(s.limitDeg), Math.abs(s.minDeg ?? s.limitDeg))]));
    const context = {
      setGearHandle: (down: boolean) => { this.gearHandleDown = down; },
      setEngineFuelCutoff: (engineId: string, cutoff: boolean) => { if (cutoff) this.fuelCutoff.add(engineId); else this.fuelCutoff.delete(engineId); },
      setHydraulicFaults: (faults: readonly import("../../../systems/hydraulics/HydraulicNetwork.js").HydraulicFault[]) => { this.hydraulics?.setFaults(faults); },
      setCgFractionMac: (v: number) => { this.cgBaseFractionMac = v; this.cgFractionMac = v; },
      setEngineControlMode: (engineId: string, mode: "primary" | "backup") => { this.engines.find((e) => e.id === engineId)?.control.setMode(mode); }
    };
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
    this.fuelSystem?.reset();
    this.fuelKg = this.fuelSystem ? this.fuelSystem.tanks.totalKg() : this.definition.mass.internalFuelKg;
    this.body = new RigidBody(
      this.massProperties(),
      { positionEnuM: start.positionEnuM, velocityEnuMps: rotateVector(q, [start.speedMps, 0, 0]), bodyToWorld: q, angularVelocityBodyRadps: [0, 0, 0] }
    );
    const startAtm = standardAtmosphere(this.env.originAltitudeMslM + start.positionEnuM[2]);
    const startAmbient = { temperatureK: startAtm.temperatureK + this.env.temperatureOffsetK, pressurePa: startAtm.pressurePa, mach: start.speedMps / startAtm.speedOfSoundMps };
    this.engines = this.definition.engines.map((install) => {
      const control = new Fadec(install.design, install.control, start.throttle, startAmbient);
      return { id: install.id, install, control, core: new MixedFlowTurbofan(install.design, control.initialSpeed) };
    });
    this.throttle = start.throttle;
    for (const a of this.actuators.values()) a.reset();
    this.hydraulics?.reset(true);
    this.gearHandleDown = start.gearDown ?? start.onGround ?? false;
    this.gear?.reset(this.gearHandleDown);
    this.gearCrash = undefined;
    this.fuelCutoff.clear();
    this.surfaceRates = {};
    this.systems.fcs.reset();
    this.systems.devices?.reset();
    // Switches return to their defaults (owner logic decides what that means).
    for (const sw of this.systems.switches) {
      if (this.controls.position(sw.definition.id) !== sw.definition.defaultPosition) this.controls.request(sw.definition.id, sw.definition.defaultPosition, "reset");
    }
    this.pilot = { pitch: 0, roll: 0, yaw: 0 };
    this.nz = 1;
    this.ny = 0;
    this.devicePositions = {};
    this.fcsMode = this.systems.fcs.mode();
    this.annunciations = [];
    this.ground = { kind: "terrain-unknown", reason: "not sampled" };
    this.checkGround();
    this.last = this.snapshotAt(this.scheduler.currentTick);
  }

  public setPilotInputs(p: PilotInputs): void {
    this.pilot = { pitch: clamp(p.pitch, -1, 1), roll: clamp(p.roll, -1, 1), yaw: clamp(p.yaw, -1, 1), brakes: clamp(p.brakes ?? 0, 0, 1) };
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

  /** CG height above the terrain below (for ground effect); omitted when the terrain is unknown. */
  private heightAboveGround(p: Vector3): { heightAboveGroundM?: number } {
    const g = this.terrain.sample(p[0], p[1]);
    return g.status === "valid" ? { heightAboveGroundM: p[2] - g.heightM } : {};
  }

  /** Engine core (gearbox drive) speed as a fraction of its reference, for engine-driven pumps. */
  private engineCoreSpeed(engineId: string): number {
    const e = this.engines.find((x) => x.id === engineId);
    if (!e) return 0;
    const st = e.core.state, deck = e.install.design.gasGenerator;
    return deck && st.n2Rpm !== undefined && !st.flameout ? st.n2Rpm / deck.referenceN2Rpm : st.spoolSpeed;
  }

  /** Current mass properties: empty mass + fuel, inertia scaled with mass (see MassProperties). */
  private massProperties(): { massKg: number; inertiaKgM2: Matrix3 } {
    const m = this.definition.mass;
    if (this.fuelSystem) {
      // Zero-fuel mass at the reference point (its inertia: reference inertia scaled to empty mass,
      // an estimate); fuel as point masses at the tank centroids. CG and inertia about the CG follow.
      const tanks = this.fuelSystem.tanks;
      const fuel = tanks.totalKg(), massKg = m.emptyMassKg + fuel;
      const mo = tanks.momentKgM();
      const c: Vector3 = [mo[0] / massKg, mo[1] / massKg, mo[2] / massKg];
      this.cgFractionMac = this.cgBaseFractionMac - c[0] / (m.macM as number);
      const k = m.emptyMassKg / m.referenceMassKg, I = m.inertiaKgM2, F = tanks.inertiaAbout(c), e = m.emptyMassKg;
      const c2 = c[0] * c[0] + c[1] * c[1] + c[2] * c[2];
      const dry = (i: number, j: number) => I[i]![j]! * k + e * ((i === j ? c2 : 0) - c[i]! * c[j]!);
      const row = (i: number): Vector3 => [dry(i, 0) + F[i]![0]!, dry(i, 1) + F[i]![1]!, dry(i, 2) + F[i]![2]!];
      return { massKg, inertiaKgM2: [row(0), row(1), row(2)] };
    }
    const massKg = m.emptyMassKg + this.fuelKg;
    const k = massKg / m.referenceMassKg;
    const I = m.inertiaKgM2;
    return { massKg, inertiaKgM2: [[I[0][0] * k, I[0][1] * k, I[0][2] * k], [I[1][0] * k, I[1][1] * k, I[1][2] * k], [I[2][0] * k, I[2][1] * k, I[2][2] * k]] };
  }

  private surfacePositions(): Record<string, number> {
    const out: Record<string, number> = { ...this.devicePositions };
    if (this.gear) out["gear"] = this.gear.state.extension; // 0 = up, 1 = down (for gear drag)
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
      nzG: this.nz, nyG: this.ny, weightOnWheels: this.gear?.state.weightOnWheels ?? false, alphaRad: alpha, betaRad: beta, ratesRadps: st.angularVelocityBodyRadps,
      dynamicPressurePa: flow.dynamicPressurePa, staticPressurePa: env.atmosphere.pressurePa, mach: flow.machNumber, trueAirspeedMps: V,
      pitchRad: att.pitch, rollRad: att.roll
    };

    const fcs = this.systems.fcs.step(this.pilot, sensors, this.surfacePositions(), dt);
    // Scheduled devices: outputs for ids that have an actuator are commands to it; others are positions.
    const deviceOut = this.systems.devices?.step(sensors, dt) ?? {};
    const commands: Record<string, number> = { ...fcs.commands };
    const positions: Record<string, number> = {};
    for (const [id, v] of Object.entries(deviceOut)) { if (this.actuators.has(id)) commands[id] = v; else positions[id] = v; }
    this.devicePositions = positions;
    // Actuators move only as fast as their hydraulic supply and the aerodynamic hinge load allow;
    // their actual motion is the network's flow demand for the next step.
    for (const [id, actuator] of this.actuators) {
      const before = actuator.positionDeg;
      const command = commands[id] ?? 0;
      const fraction = this.hydraulics?.rateFraction(id, { dynamicPressurePa: flow.dynamicPressurePa, deflectionDeg: before, limitDeg: this.surfaceLimits.get(id) ?? 1, movingAwayFromNeutral: Math.abs(command) > Math.abs(before) && command * before >= 0 }) ?? 1;
      actuator.step(command, dt, fraction);
      this.surfaceRates[id] = (actuator.positionDeg - before) / dt;
    }
    this.fcsMode = fcs.mode;
    this.annunciations = [...fcs.annunciations, ...(this.fuelSystem?.annunciations() ?? [])];

    const ambient = { temperatureK: env.atmosphere.temperatureK, pressurePa: env.atmosphere.pressurePa, mach: flow.machNumber };
    const forces: { sourceId: string; frame: "body.frd" | "world.enu"; forceN: Vector3; applicationPointBodyM?: Vector3 }[] = [];
    let totalFlow = 0;
    const flows: Record<string, number> = {}, speeds: Record<string, number> = {};
    for (const e of this.engines) {
      const fuel = (this.fuelSystem ? this.fuelSystem.engineFuelAvailable(e.id) : this.fuelKg > 0) && !this.fuelCutoff.has(e.id);
      const cmd = e.control.step(this.throttle, { ambient, spoolSpeed: e.core.state.spoolSpeed, fuelAvailable: fuel }, dt);
      const s = e.core.step({ speed: cmd.speedDemand, afterburner: cmd.afterburnerDemand, throat: cmd.throat }, ambient, fuel, dt);
      totalFlow += s.fuelFlowKgS;
      flows[e.id] = s.fuelFlowKgS;
      speeds[e.id] = s.spoolSpeed;
      const a = e.install.thrustAxisBody;
      forces.push({ sourceId: `engine.${e.id}`, frame: "body.frd" as const, forceN: [a[0] * s.netThrustN, a[1] * s.netThrustN, a[2] * s.netThrustN] as Vector3, applicationPointBodyM: e.install.positionBodyM });
    }
    if (this.fuelSystem) {
      this.fuelSystem.step({ engineFlowKgS: flows, engineSpeed: speeds, nzG: this.nz, altitudeM: this.env.originAltitudeMslM + st.positionEnuM[2] }, dt);
      this.fuelKg = this.fuelSystem.tanks.totalKg();
    } else {
      this.fuelKg = Math.max(0, this.fuelKg - totalFlow * dt);
    }
    this.hydraulics?.step(dt, (engineId) => this.engineCoreSpeed(engineId), this.surfaceRates);
    // Mass properties change only between integration steps.
    this.body.setMassProperties(this.massProperties());

    const aero = this.systems.aero.compute({
      alphaRad: alpha, betaRad: beta, trueAirspeedMps: V, dynamicPressurePa: flow.dynamicPressurePa, mach: flow.machNumber,
      ratesRadps: st.angularVelocityBodyRadps, surfaces: this.surfacePositions(), cgFractionMac: this.cgFractionMac,
      ...this.heightAboveGround(st.positionEnuM)
    });
    forces.push({ sourceId: "aero.force", frame: "body.frd" as const, forceN: aero.forceBodyN });
    if (this.gear) {
      const result = this.gear.step(dt, st, (x, y) => { const g = this.terrain.sample(x, y); return g.status === "valid" ? g.heightM : undefined; }, {
        handleDown: this.gearHandleDown, brakes: this.pilot.brakes ?? 0, steering: this.pilot.yaw,
        hydraulicFraction: (id) => { if (!id || !this.hydraulics) return 1; const c = this.definition.hydraulics?.circuits.find((x) => x.id === id); return c ? Math.min(1, this.hydraulics.pressurePa(id) / c.nominalPressurePa) : 1; }
      });
      for (const f of result.forces) forces.push(f);
      if (result.crash) this.gearCrash = result.crash;
    }
    const loads = this.body.step(dt, {
      forces,
      moments: [{ sourceId: "aero.moment", frame: "body.frd", momentNm: aero.momentBodyNm }],
      gravityEnuMps2: env.gravityEnuMps2
    });
    const q = st.bodyToWorld;
    const fBody = rotateVector([-q[0], -q[1], -q[2], q[3]], loads.forceEnuN);
    this.nz = -fBody[2] / (this.body.massProperties.massKg * 9.80665);
    this.ny = fBody[1] / (this.body.massProperties.massKg * 9.80665);
    this.air = { alpha, beta, tas: V, eas: Math.sqrt((2 * flow.dynamicPressurePa) / SEA_LEVEL_DENSITY), mach: flow.machNumber, outside: aero.outsideEnvelope, reasons: aero.envelopeReasons };
  }

  private checkGround(): void {
    if (this.ground.kind === "crashed") return;
    const p = this.body.state.positionEnuM;
    const s = this.terrain.sample(p[0], p[1]);
    if (s.status !== "valid") { this.ground = { kind: "terrain-unknown", reason: s.reason }; return; }
    const agl = p[2] - s.heightM;
    const speed = Math.hypot(...this.body.state.velocityEnuMps);
    if (this.gear) {
      // With landing gear, only the gear model decides contact: crash on collapse, a gear-up
      // landing or an airframe strike; weight on wheels is "on ground".
      if (this.gearCrash) { this.ground = { kind: "crashed", impactSpeedMps: speed, reason: this.gearCrash }; return; }
      this.ground = this.gear.state.weightOnWheels ? { kind: "on-ground", groundSpeedMps: Math.hypot(this.body.state.velocityEnuMps[0], this.body.state.velocityEnuMps[1]) } : { kind: "airborne", aglM: agl };
      return;
    }
    this.ground = agl <= 0 ? { kind: "crashed", impactSpeedMps: speed } : { kind: "airborne", aglM: agl };
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
      engines: this.engines.map((e) => ({ ...e.core.state, id: e.id, control: e.control.output })),
      fuelKg: this.fuelKg,
      ...(this.fuelSystem ? { fuelTanks: this.fuelSystem.tanks.states() } : {}),
      massKg: this.body.massProperties.massKg,
      ...(this.gear ? { gear: { ...this.gear.state, handleDown: this.gearHandleDown } } : {}),
      ...(this.hydraulics ? { hydraulics: this.hydraulics.snapshot() } : {}),
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
