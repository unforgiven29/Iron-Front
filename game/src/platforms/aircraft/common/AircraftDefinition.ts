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
import type { FadecMode, FadecSchedule } from "../../../physics/propulsion/Fadec.js";
import type { Ambient, TurbofanDesign } from "../../../physics/propulsion/MixedFlowTurbofan.js";
import type { HydraulicFault, HydraulicInstallation } from "../../../systems/hydraulics/HydraulicNetwork.js";
import type { CockpitLayout } from "../../../rendering/three/CockpitLayout.js";

/** Pilot controls, normalised. +pitch = stick back, +roll = stick right, +yaw = right pedal. */
export interface PilotInputs {
  readonly pitch: number;
  readonly roll: number;
  /** Rudder pedals; also nose-wheel steering on the ground. */
  readonly yaw: number;
  /** Wheel brakes, 0..1 (toe brakes). */
  readonly brakes?: number;
}

/** Named surface or device positions, degrees. Names are package-defined (e.g. "elevator", "lef"). */
export type SurfacePositions = Readonly<Record<string, number>>;

export interface ControlSurfaceSpec {
  readonly id: string;
  /** Maximum deflection; travel is ±limitDeg unless minDeg is given. */
  readonly limitDeg: number;
  readonly minDeg?: number;
  readonly rateDegS: number;
  readonly bandwidthRadS: number;
}

/** What onboard sensors give the flight-control system (ideal measurements for now). */
export interface FlightSensors {
  readonly nzG: number;
  /** Lateral load factor (g), positive to the right. */
  readonly nyG: number;
  /** Weight-on-wheels (squat switches); false for aircraft without landing gear. */
  readonly weightOnWheels: boolean;
  readonly alphaRad: number;
  readonly betaRad: number;
  readonly ratesRadps: readonly [number, number, number];
  readonly dynamicPressurePa: number;
  readonly staticPressurePa: number;
  readonly mach: number;
  /** True airspeed from the air-data system, m/s. */
  readonly trueAirspeedMps: number;
  readonly pitchRad: number;
  readonly rollRad: number;
  /** Electrical bus states from the package's electrical installation (absent without one). */
  readonly electricalBuses?: Readonly<Record<string, { readonly powered: boolean; readonly shed: boolean }>>;
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

/**
 * Automatically scheduled devices (leading-edge flaps etc.). Returns, per device id, the achieved
 * position — or, when the definition also lists a control surface with that id, the COMMAND to
 * that surface's actuator (so the device moves only as its actuator and hydraulic supply allow).
 */
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
  /** Height of the CG above the terrain directly below, m (undefined when unknown or not applicable). */
  readonly heightAboveGroundM?: number;
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
  /** Gas-path and rotor parameters (the plant). */
  readonly design: TurbofanDesign;
  /** Engine-control schedules and limits (the FADEC). The throttle goes to the FADEC, never straight to the engine. */
  readonly control: FadecSchedule;
  /** Thrust application point relative to the CG, body FRD, metres. */
  readonly positionBodyM: Vector3;
  /** Unit thrust direction, body FRD. */
  readonly thrustAxisBody: Vector3;
}

export interface MassProperties {
  /** Mass without fuel (everything else aboard), kg. Total mass = emptyMassKg + current fuel. */
  readonly emptyMassKg: number;
  /** Inertia about the CG at `referenceMassKg`. Scaled in proportion to total mass (estimate: fuel
   * is assumed distributed like the rest of the aircraft until a tank model exists). */
  readonly inertiaKgM2: Matrix3;
  readonly referenceMassKg: number;
  readonly cgFractionMac: number;
  readonly internalFuelKg: number;
  /** Mean aerodynamic chord, m: converts a CG movement (m) into a MAC fraction. Required with a fuel system. */
  readonly macM?: number;
}

/** Mutable aircraft state a package's switches may change, through these setters only. */
export interface AircraftControlContext {
  setCgFractionMac(value: number): void;
  /** Electrical sources failed or switched off (generator switches, test failures). */
  setElectricalSourcesOff(ids: readonly string[]): void;
  /** Select an engine's control mode (e.g. a primary/secondary engine-control switch). */
  setEngineControlMode(engineId: string, mode: FadecMode): void;
  /** Shut off (or restore) fuel to one engine — engine-out tests on multi-engine aircraft. */
  setEngineFuelCutoff(engineId: string, cutoff: boolean): void;
  /** Landing-gear handle. */
  setGearHandle(down: boolean): void;
  /** Inject hydraulic faults (test/training switches). */
  setHydraulicFaults(faults: readonly HydraulicFault[]): void;
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
  /**
   * Package-defined mechanical drives (e.g. an airframe accessory gearbox driven by whichever engine
   * is faster, or a fuel-driven emergency pump). Returns speed fractions by drive id; hydraulic pumps
   * and generators may name these ids instead of an engine id.
   */
  readonly accessoryDrives?: (ctx: DriveContext) => Readonly<Record<string, number>>;
}

export interface DriveContext {
  engineSpeed(engineId: string): number;
  hydraulicPressurePa(circuitId: string): number;
  readonly emergencyUnitRunning: boolean;
}

export interface AircraftDefinition {
  readonly manifest: ModuleManifest;
  readonly displayName: string;
  /** One-line data caveat shown to players. */
  readonly dataNote: string;
  readonly mass: MassProperties;
  readonly surfaces: readonly ControlSurfaceSpec[];
  readonly engines: readonly EngineInstallation[];
  /** Optional landing gear (shared ground-handling model). Without it, any ground contact is a crash. */
  readonly landingGear?: import("../../../physics/ground-handling/LandingGear.js").LandingGearSpec;
  /** Optional hydraulic power network; surfaces listed in it are rate-limited by their supply. */
  readonly hydraulics?: HydraulicInstallation;
  /**
   * Optional fuel system owned by the package (tanks, pumps, transfer sequence). With it, fuel
   * mass, CG (as a MAC-fraction shift from `mass.cgFractionMac`, the zero-fuel CG) and inertia
   * follow the tank contents; without it, fuel is a single quantity at the CG.
   */
  /** Optional electrical installation (shared bus-power network, package-specific topology). */
  readonly electrical?: import("../../../systems/electrical/ElectricalNetwork.js").ElectricalInstallation;
  /** Package coupling between its systems each step (e.g. start the EPU when generators are lost). */
  readonly systemsCoupling?: (s: { readonly electrical?: import("../../../systems/electrical/ElectricalNetwork.js").ElectricalSnapshot; readonly hydraulics?: import("../../../systems/hydraulics/HydraulicNetwork.js").HydraulicSnapshot }) => { readonly startEmergencyUnit?: boolean };
  readonly createFuelSystem?: () => import("../../../systems/fuel/FuelTanks.js").FuelSystemModel;
  readonly cockpit: CockpitLayout;
  /** Aircraft-specific cautions and warnings built from the snapshot (e.g. hydraulic pressure lights). */
  readonly annunciate?: (snapshot: import("./FixedWingAircraft.js").AircraftSnapshot) => readonly { readonly text: string; readonly level: "caution" | "warning" }[];
  /** Pilot-facing MFD pages built from the snapshot (package decides what to show). */
  readonly mfdPages?: Readonly<Record<string, (snapshot: import("./FixedWingAircraft.js").AircraftSnapshot) => { title: string; lines: string[] }>>;
  createSystems(): AircraftSystems;
}

export type { Ambient };
