/**
 * Scripted air targets and the world-side SensorScene (owner: game/world).
 *
 * These are SYNTHETIC TEST TARGETS for exercising sensors, not aircraft models and not AI: a point
 * mass flies a looped script of straight legs, coordinated turns, climbs and power changes. Their
 * signatures are reference values (see `SIGNATURES`), labelled with provenance. The scene answers
 * radar beam and infrared field queries with physical returns only.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { infraredPoints, type IrEmitterState, type IrFieldQuery, type IrPoint, type IrSignatureModel, type IrSource } from "../../physics/infrared/InfraredPhysics.js";
import { groundClutterPatches, radarEchoes, type ClutterPatch, type ClutterQuery, type RadarBeamQuery, type RadarEcho, type RadarScatterer, type RadarTerrain, type RcsModel } from "../../physics/radar/RadarPhysics.js";
import type { SensorScene } from "../../physics/sensing/SensorScene.js";
import { cross, dot, unit } from "../../physics/sensing/SweepGeometry.js";
import { standardAtmosphere } from "../../physics/environment/Atmosphere.js";

export type ManeuverStep =
  | { readonly kind: "straight"; readonly durationS: number }
  | { readonly kind: "turn"; /** deg/s, + = right */ readonly rateDegS: number; readonly durationS: number }
  | { readonly kind: "climb"; readonly verticalSpeedMps: number; readonly durationS: number }
  | { readonly kind: "power"; readonly throttle: number; readonly afterburner: number };

export interface TargetSignature { readonly rcs: RcsModel; readonly ir: IrSignatureModel }

export interface AirTargetSpec {
  readonly id: string;
  readonly label: string;
  readonly signature: TargetSignature;
  readonly positionEnuM: Vector3;
  readonly headingRad: number;
  readonly speedMps: number;
  readonly throttle: number;
  readonly afterburner?: number;
  /** Looped script. Empty = fly straight forever. */
  readonly script?: readonly ManeuverStep[];
}

/** Reference signatures for synthetic targets. ESTIMATED / reference values, not measurements of any aircraft. */
export const SIGNATURES = {
  /**
   * "Fighter" reference: 3 m² from the front — the reference target σ = 3 m² that the MiG-29
   * combat manual (Боевое применение самолёта МиГ-29, table 1/4) quotes its detection ranges for.
   * Side/rear/top values are generic fighter-class estimates.
   */
  fighter: {
    rcs: { id: "ref.fighter", aspectDeg: [0, 30, 60, 90, 120, 150, 180], rcsM2: [3, 4, 8, 15, 8, 5, 4], topBottomM2: 20, swerling: 1, provenance: "Frontal 3 m² = manual reference target; other aspects ESTIMATED" },
    ir: { id: "ref.fighter.ir", plumeMilWsr: 900, abGain: 4.5, frontalPlumeFraction: 0.04, hotPartsMilWsr: 300, hotPartsConeDeg: 50, skinAreaM2: { front: 4, side: 14, top: 40 }, skinEmissivity: 0.85, provenance: "ESTIMATED twin-engine fighter class; calibrated with the KOLS reference ranges" }
  },
  bomber: {
    rcs: { id: "ref.bomber", aspectDeg: [0, 30, 60, 90, 120, 150, 180], rcsM2: [15, 20, 40, 80, 40, 25, 20], topBottomM2: 100, swerling: 1, provenance: "ESTIMATED large-aircraft class" },
    ir: { id: "ref.bomber.ir", plumeMilWsr: 6000, abGain: 0, frontalPlumeFraction: 0.08, hotPartsMilWsr: 1500, hotPartsConeDeg: 60, skinAreaM2: { front: 15, side: 60, top: 200 }, skinEmissivity: 0.85, provenance: "ESTIMATED" }
  }
} as const satisfies Record<string, TargetSignature>;

export interface AirTargetState {
  readonly id: string;
  readonly label: string;
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  /** Body axes in ENU (forward, right, down). */
  readonly forwardEnu: Vector3;
  readonly rightEnu: Vector3;
  readonly downEnu: Vector3;
  readonly throttle: number;
  readonly afterburner: number;
}

class AirTarget {
  private pos: [number, number, number];
  private heading: number;
  private vs = 0;
  private turnRate = 0;
  private throttle: number;
  private afterburner: number;
  private step = 0;
  private stepTime = 0;

  public constructor(public readonly spec: AirTargetSpec) {
    this.pos = [...spec.positionEnuM];
    this.heading = spec.headingRad;
    this.throttle = spec.throttle;
    this.afterburner = spec.afterburner ?? 0;
    this.enter();
  }

  private current(): ManeuverStep | undefined { return this.spec.script?.[this.step]; }

  private enter(): void {
    const s = this.current();
    this.turnRate = 0; this.vs = 0; this.stepTime = 0;
    if (!s) return;
    if (s.kind === "turn") this.turnRate = (s.rateDegS * Math.PI) / 180;
    if (s.kind === "climb") this.vs = s.verticalSpeedMps;
    if (s.kind === "power") { this.throttle = s.throttle; this.afterburner = s.afterburner; this.advance(); }
  }

  private advance(): void {
    const n = this.spec.script?.length ?? 0;
    if (n === 0) return;
    this.step = (this.step + 1) % n;
    // Guard against a script of only power steps.
    if (this.spec.script?.every((x) => x.kind === "power")) return;
    this.enter();
  }

  public update(dt: number): void {
    const s = this.current();
    this.heading += this.turnRate * dt;
    const v = this.spec.speedMps;
    const h = Math.sqrt(Math.max(0, v * v - this.vs * this.vs));
    this.pos[0] += Math.sin(this.heading) * h * dt;
    this.pos[1] += Math.cos(this.heading) * h * dt;
    this.pos[2] += this.vs * dt;
    this.stepTime += dt;
    if (s && s.kind !== "power" && this.stepTime >= s.durationS) this.advance();
  }

  public state(): AirTargetState {
    const v = this.spec.speedMps;
    const h = Math.sqrt(Math.max(0, v * v - this.vs * this.vs));
    const vel: Vector3 = [Math.sin(this.heading) * h, Math.cos(this.heading) * h, this.vs];
    const fwd = unit(vel);
    // Coordinated turn: bank = atan(V·ω/g).
    const bank = Math.atan((v * this.turnRate) / 9.80665);
    const levelRight = unit(cross(fwd, [0, 0, 1]));
    const up0 = cross(levelRight, fwd);
    const right = unit([levelRight[0] * Math.cos(bank) - up0[0] * Math.sin(bank), levelRight[1] * Math.cos(bank) - up0[1] * Math.sin(bank), levelRight[2] * Math.cos(bank) - up0[2] * Math.sin(bank)]);
    const down = cross(fwd, right);
    return { id: this.spec.id, label: this.spec.label, positionEnuM: [...this.pos], velocityEnuMps: vel, forwardEnu: fwd, rightEnu: right, downEnu: down, throttle: this.throttle, afterburner: this.afterburner };
  }
}

const toBodyOf = (s: AirTargetState) => (v: Vector3): Vector3 => [dot(v, s.forwardEnu), dot(v, s.rightEnu), dot(v, s.downEnu)];

/** The world's air targets plus the SensorScene built on them. */
export class AirTargetWorld implements SensorScene {
  private targets: AirTarget[];
  public readonly sunDirectionEnu: Vector3 = unit([0.4, -0.3, 1]);

  public constructor(private readonly specs: readonly AirTargetSpec[], private readonly terrain?: RadarTerrain) {
    this.targets = specs.map((s) => new AirTarget(s));
  }

  public reset(): void { this.targets = this.specs.map((s) => new AirTarget(s)); }

  public step(dt: number): void { for (const t of this.targets) t.update(dt); }

  /** Truth for rendering and tests only. Sensors receive a SensorScene, never this list. */
  public states(): readonly AirTargetState[] { return this.targets.map((t) => t.state()); }

  public radar(query: RadarBeamQuery): readonly RadarEcho[] {
    const scatterers: RadarScatterer[] = this.targets.map((t) => { const s = t.state(); return { positionEnuM: s.positionEnuM, velocityEnuMps: s.velocityEnuMps, toBody: toBodyOf(s), rcs: t.spec.signature.rcs }; });
    return radarEchoes(query, scatterers, this.terrain);
  }

  /** Terrain reflectivity γ for clutter, dB (farmland/mixed; ESTIMATED, Nathanson ch. 7 order of magnitude). */
  public clutterGammaDb = -15;

  public radarClutter(query: Omit<ClutterQuery, "groundHeightM" | "gammaDb">): readonly ClutterPatch[] {
    const h = this.terrain?.heightAt(query.originEnuM[0], query.originEnuM[1]);
    return groundClutterPatches({ ...query, groundHeightM: Number.isFinite(h) ? (h as number) : 0, gammaDb: this.clutterGammaDb });
  }

  public infrared(query: IrFieldQuery): readonly IrPoint[] {
    const sources: IrSource[] = this.targets.map((t) => {
      const s = t.state();
      const a = standardAtmosphere(Math.min(80000, Math.max(0, s.positionEnuM[2])));
      const state: IrEmitterState = { throttle: s.throttle, afterburner: s.afterburner, mach: t.spec.speedMps / a.speedOfSoundMps };
      return { positionEnuM: s.positionEnuM, toBody: toBodyOf(s), signature: t.spec.signature.ir, state };
    });
    return infraredPoints(query, sources, this.sunDirectionEnu, this.terrain);
  }
}
