/**
 * Uniform-grid spatial index for broad-phase candidate selection.
 *
 * Owner: game/core/spatial. It accelerates "what might be near X?" and nothing more: callers
 * still run the exact test. Every query returns ids in sorted order, so results never depend
 * on insertion order or hash iteration.
 */
import type { Vector3 } from "../coordinates/CoordinateFrames.js";

export interface Aabb {
  readonly min: Vector3;
  readonly max: Vector3;
}

export function validateAabb(box: Aabb): string[] {
  const problems: string[] = [];
  if (![...box.min, ...box.max].every(Number.isFinite)) problems.push("AABB bounds must be finite.");
  else if (box.min.some((v, i) => v > (box.max[i] as number))) problems.push("AABB min must not exceed max on any axis.");
  return problems;
}

export const aabbOverlap = (a: Aabb, b: Aabb): boolean =>
  a.min[0] <= b.max[0] && a.max[0] >= b.min[0] && a.min[1] <= b.max[1] && a.max[1] >= b.min[1] && a.min[2] <= b.max[2] && a.max[2] >= b.min[2];

export class SpatialIndex {
  private readonly cells = new Map<string, Set<string>>();
  private readonly boxes = new Map<string, { box: Aabb; keys: string[] }>();

  public constructor(public readonly cellSizeM: number) {
    if (!Number.isFinite(cellSizeM) || cellSizeM <= 0) throw new RangeError("cellSizeM must be finite and > 0.");
  }

  public get size(): number {
    return this.boxes.size;
  }

  /** Insert or move an entry. */
  public upsert(id: string, box: Aabb): void {
    const problems = validateAabb(box);
    if (problems.length > 0) throw new RangeError(`Invalid AABB for "${id}": ${problems.join(" ")}`);
    this.remove(id);
    const keys = this.keysFor(box);
    for (const k of keys) {
      let set = this.cells.get(k);
      if (!set) { set = new Set(); this.cells.set(k, set); }
      set.add(id);
    }
    this.boxes.set(id, { box: { min: [...box.min] as unknown as Vector3, max: [...box.max] as unknown as Vector3 }, keys });
  }

  public remove(id: string): boolean {
    const entry = this.boxes.get(id);
    if (!entry) return false;
    for (const k of entry.keys) {
      const set = this.cells.get(k);
      set?.delete(id);
      if (set && set.size === 0) this.cells.delete(k);
    }
    this.boxes.delete(id);
    return true;
  }

  public boxOf(id: string): Aabb | undefined {
    return this.boxes.get(id)?.box;
  }

  /** Ids whose AABB overlaps the query box, sorted. */
  public queryAabb(box: Aabb): string[] {
    const problems = validateAabb(box);
    if (problems.length > 0) throw new RangeError(`Invalid query AABB: ${problems.join(" ")}`);
    const found = new Set<string>();
    for (const k of this.keysFor(box)) for (const id of this.cells.get(k) ?? []) found.add(id);
    return [...found].filter((id) => aabbOverlap((this.boxes.get(id) as { box: Aabb }).box, box)).sort();
  }

  /** All overlapping AABB pairs [a, b] with a < b, sorted. */
  public overlappingPairs(): [string, string][] {
    const pairs = new Set<string>();
    for (const set of this.cells.values()) {
      const ids = [...set].sort();
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i] as string, b = ids[j] as string;
          if (aabbOverlap((this.boxes.get(a) as { box: Aabb }).box, (this.boxes.get(b) as { box: Aabb }).box)) pairs.add(`${a}\u0000${b}`);
        }
      }
    }
    return [...pairs].sort().map((p) => p.split("\u0000") as [string, string]);
  }

  private keysFor(box: Aabb): string[] {
    const c = this.cellSizeM;
    const lo = box.min.map((v) => Math.floor(v / c));
    const hi = box.max.map((v) => Math.floor(v / c));
    const count = ((hi[0] as number) - (lo[0] as number) + 1) * ((hi[1] as number) - (lo[1] as number) + 1) * ((hi[2] as number) - (lo[2] as number) + 1);
    if (count > 100_000) throw new RangeError(`AABB spans ${count} cells; use a larger cell size for objects this big.`);
    const keys: string[] = [];
    for (let x = lo[0] as number; x <= (hi[0] as number); x++)
      for (let y = lo[1] as number; y <= (hi[1] as number); y++)
        for (let z = lo[2] as number; z <= (hi[2] as number); z++) keys.push(`${x},${y},${z}`);
    return keys;
  }
}
