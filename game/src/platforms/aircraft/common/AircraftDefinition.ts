/**
 * The contract every fixed-wing aircraft package implements.
 *
 * Shared (one implementation for every aircraft): FixedWingAircraft (runtime), the rigid body,
 * atmosphere/wind, terrain, the turbofan cycle, table lookup, surface actuators, the switch
 * registry and the cockpit renderer.
 *
 * Per aircraft (this definition): mass/geometry, engines and where they sit, control surfaces
 * and their limits, the aircraft's OWN aerodynamic model and data, its flight-control system,
 * high-lift devices, switches and cockpit layout. Aircraft do not share coefficient tables,
 * control laws or tuning: an F-16 and a MiG-29 differ there, so each package supplies its own.
 *
 * See docs/claude/adding-an-aircraft.md for a walkthrough.
 */
import type { SwitchDefinition } from "../../../core/controls/ControlRegistry.js";
import type { ModuleManifest } from "../../../core/modules/ModuleTypes.js";
import type { Vector3 } from "../../../core/coordinates/CoordinateFrames.js";
import type { Matrix3 } from "../../../physics/rigidbody/RigidBody.js";
import type { Ambient, TurbofanDesign } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import type { CockpitLayout } from "../../../rendering/three/CockpitLayout.js";

/** Pilot controls, normalised. +pitch = stick back, +roll = stick right, +yaw = right pedal. */
export interface PilotInputs {
  readonly pitch: number;
  readonly roll: number;
  readonly yaw: number;
}

/** Named surface or device positions, degrees. Names are package-defined (e.g. "elevator", "lef"). */
export type SurfacePositions = Readonly<Record<string, number>>;

export interface ControlSurfaceSpec {
  readonly id: string;
  readonly limitDeg: number;
  readonly rateDegS: number;
  readonly bandwidthRadS: number;
}

/** What onboard sensors give the flight-control system (ideal measurements for now). */
export interface FlightSensors {
  readonly nzG: number;
  readonly alphaRad: number;
  readonly betaRad: number;
  readonly ratesRadps: readonly [number, number, number];
  readonly dynamicPressurePa: number;
  readonly staticPressurePa: number;
  readonly mach: number;
  readonly pitchRad: number;
  readonly rollRad: number;
}

export interface FcsOutput {
  /** Commanded position for each control surface id, degrees. */
  readonly commands: Readonly<Record<string, number>>;
  /** Short status flags for the HUD/MFD, e.g. ["AOA LIMIT"]. */
  readonly annunciations: readonly string[];
  /** Mode name shown to the pilot, e.g. "NORM". */
  readonly mode: string;
}

export interface FlightControlSystem {
  reset(): void;
  /** Mode name shown to the pilot before/between steps, e.g. "NORM". */
  mode(): string;
  step(pilot: PilotInputs, sensors: FlightSensors, surfaces: SurfacePositions, dt: number): FcsOutput;
}

/** Automatically scheduled devices (leading-edge flaps etc.). Returns achieved positions. */
export interface ScheduledDevices {
  reset(): void;
  step(sensors: FlightSensors, dt: number): SurfacePositions;
}

export interface AeroInput {
  readonly alphaRad: number;
  readonly betaRad: number;
  readonly trueAirspeedMps: number;
  readonly dynamicPressurePa: number;
  readonly mach: number;
  readonly ratesRadps: readonly [number, number, number];
  /** Achieved control-surface and device positions, degrees. */
  readonly surfaces: SurfacePositions;
  readonly cgFractionMac: number;
}

export interface AeroOutput {
  /** Body FRD force (N) and moment about the CG (N·m). */
  readonly forceBodyN: Vector3;
  readonly momentBodyNm: Vector3;
  readonly outsideEnvelope: boolean;
  readonly envelopeReasons: readonly string[];
}

/** The aircraft's own aerodynamic model. */
export interface AeroModel {
  readonly id: string;
  compute(input: AeroInput): AeroOutput;
}

export interface EngineInstallation {
  readonly id: string;
  readonly design: TurbofanDesign;
  readonly afterburnerDetentThrottle: number;
  /** Thrust application point relative to the CG, body FRD, metres. */
  readonly positionBodyM: Vector3;
  /** Unit thrust direction, body FRD. */
  readonly thrustAxisBody: Vector3;
}

export interface MassProperties {
  /** Mass used by the rigid body. Fuel burn does not change it yet (planned). */
  readonly massKg: number;
  readonly inertiaKgM2: Matrix3;
  readonly cgFractionMac: number;
  readonly internalFuelKg: number;
}

/** Mutable aircraft state a package's switches may change, through these setters only. */
export interface AircraftControlContext {
  setCgFractionMac(value: number): void;
}

export interface SwitchBinding {
  readonly definition: SwitchDefinition;
  /** Owner logic: accept or reject a position change, applying its effect if accepted. */
  readonly onChange: (to: string, context: AircraftControlContext) => { readonly accepted: true } | { readonly accepted: false; readonly reason: string };
  /** Optional keyboard key that cycles this switch. */
  readonly key?: string;
}

/** Fresh per-aircraft instances of the stateful parts (a package may be flown more than once). */
export interface AircraftSystems {
  readonly aero: AeroModel;
  readonly fcs: FlightControlSystem;
  readonly devices?: ScheduledDevices;
  readonly switches: readonly SwitchBinding[];
}

export interface AircraftDefinition {
  readonly manifest: ModuleManifest;
  readonly displayName: string;
  /** One-line data caveat shown to players. */
  readonly dataNote: string;
  readonly mass: MassProperties;
  readonly surfaces: readonly ControlSurfaceSpec[];
  readonly engines: readonly EngineInstallation[];
  readonly cockpit: CockpitLayout;
  /** Pilot-facing MFD pages built from the snapshot (package decides what to show). */
  readonly mfdPages?: Readonly<Record<string, (snapshot: import("./FixedWingAircraft.js").AircraftSnapshot) => { title: string; lines: string[] }>>;
  createSystems(): AircraftSystems;
}

export type { Ambient };
