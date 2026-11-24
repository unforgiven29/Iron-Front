/**
 * Fuel tanks (owner: systems/fuel). Platform-neutral physics ONLY: tank contents, capacity-limited
 * transfers between tanks, engine draw from feed tanks, and each tank's contribution to mass, CG
 * and inertia as a point mass at its centroid. Every aircraft supplies its OWN fuel system
 * (tanks, pumps, valves, transfer sequence, warnings) as a FuelSystemModel in its package.
 *
 * Simplifications: point-mass tanks (no fuel slosh, no attitude-dependent centroid), fuel density
 * fixed per package, no thermal effects.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import type { Matrix3 } from "../../physics/rigidbody/RigidBody.js";

export interface TankSpec {
  readonly id: string;
  /** Fully serviced contents, kg. */
  readonly capacityKg: number;
  /** Fuel that cannot be transferred or burned, kg. */
  readonly unusableKg: number;
  /** Centroid in the aircraft body frame (x forward, y right, z down), metres from the reference CG. */
  readonly positionBodyM: Vector3;
}

export interface TankState {
  readonly id: string;
  readonly kg: number;
  readonly capacityKg: number;
}

export interface FuelStepInput {
  /** Fuel each engine burned this step, kg/s (from the engine model). */
  readonly engineFlowKgS: Readonly<Record<string, number>>;
  /** Physical core speed fraction per engine (pumps driven by gearboxes need it). */
  readonly engineSpeed: Readonly<Record<string, number>>;
  readonly nzG: number;
  readonly altitudeM: number;
}

/** An aircraft's own fuel system, built from TankSet. */
export interface FuelSystemModel {
  /** Refill to the package's default load. */
  reset(): void;
  /** Moves fuel for one step (transfers, then engine draw). */
  step(input: FuelStepInput, dt: number): void;
  /** True if the engine's feed can supply fuel right now. */
  engineFuelAvailable(engineId: string): boolean;
  readonly tanks: TankSet;
  /** Pilot indications from this package's logic (e.g. low-level captions). */
  annunciations(): readonly string[];
}

export class TankSet {
  private readonly specs: ReadonlyMap<string, TankSpec>;
  private readonly contents = new Map<string, number>();

  public constructor(specs: readonly TankSpec[]) {
    this.specs = new Map(specs.map((s) => [s.id, s]));
    for (const s of specs) {
      if (!(s.capacityKg > 0) || s.unusableKg < 0 || s.unusableKg > s.capacityKg) throw new Error(`Tank ${s.id}: invalid capacity/unusable fuel`);
      this.contents.set(s.id, s.capacityKg);
    }
  }

  public spec(id: string): TankSpec {
    const s = this.specs.get(id);
    if (!s) throw new Error(`Unknown tank ${id}`);
    return s;
  }

  public kg(id: string): number { return this.contents.get(id) ?? 0; }
  public usableKg(id: string): number { return Math.max(0, this.kg(id) - this.spec(id).unusableKg); }
  public spaceKg(id: string): number { return Math.max(0, this.spec(id).capacityKg - this.kg(id)); }
  public isEmpty(id: string): boolean { return this.usableKg(id) <= 1e-9; }

  public set(id: string, kg: number): void {
    const s = this.spec(id);
    this.contents.set(id, Math.min(s.capacityKg, Math.max(0, kg)));
  }

  /** Move up to rateKgS·dt from one tank to another, limited by usable fuel and free space. Returns kg moved. */
  public transfer(from: string, to: string, rateKgS: number, dt: number): number {
    const moved = Math.max(0, Math.min(rateKgS * dt, this.usableKg(from), this.spaceKg(to)));
    this.contents.set(from, this.kg(from) - moved);
    this.contents.set(to, this.kg(to) + moved);
    return moved;
  }

  /** Burn up to kg from a tank (engine feed). Returns kg actually supplied. */
  public draw(id: string, kg: number): number {
    const d = Math.max(0, Math.min(kg, this.usableKg(id)));
    this.contents.set(id, this.kg(id) - d);
    return d;
  }

  public totalKg(): number {
    let t = 0;
    for (const v of this.contents.values()) t += v;
    return t;
  }

  public states(): readonly TankState[] {
    return [...this.specs.values()].map((s) => ({ id: s.id, kg: this.kg(s.id), capacityKg: s.capacityKg }));
  }

  /** First moment of fuel mass about the reference CG, kg·m (body frame). */
  public momentKgM(): Vector3 {
    const m: [number, number, number] = [0, 0, 0];
    for (const s of this.specs.values()) {
      const k = this.kg(s.id);
      m[0] += k * s.positionBodyM[0]; m[1] += k * s.positionBodyM[1]; m[2] += k * s.positionBodyM[2];
    }
    return m;
  }

  /** Inertia of the fuel point masses about a point `about` (body frame), kg·m². */
  public inertiaAbout(about: Vector3): Matrix3 {
    let xx = 0, yy = 0, zz = 0, xy = 0, xz = 0, yz = 0;
    for (const s of this.specs.values()) {
      const k = this.kg(s.id);
      const x = s.positionBodyM[0] - about[0], y = s.positionBodyM[1] - about[1], z = s.positionBodyM[2] - about[2];
      xx += k * (y * y + z * z); yy += k * (x * x + z * z); zz += k * (x * x + y * y);
      xy -= k * x * y; xz -= k * x * z; yz -= k * y * z;
    }
    return [[xx, xy, xz], [xy, yy, yz], [xz, yz, zz]];
  }
}
