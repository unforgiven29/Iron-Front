/**
 * Narrow-phase collision queries: sphere/sphere contacts, swept sphere time of impact, and
 * segment-vs-terrain intersection.
 *
 * Owner: physics/collision. It reports contacts; it does not resolve them (rigid-body and
 * vehicle owners consume contacts through their own integration) and it is not sensor LOS.
 * Terrain queries never treat unknown terrain as clear: a segment that crosses no-data or
 * uncovered ground before any hit returns "unknown".
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { SpatialIndex, type Aabb } from "../../core/spatial/SpatialIndex.js";
import type { TerrainSurface } from "../../world/terrain/Terrain.js";

export interface SphereProxy {
  readonly id: string;
  readonly centerEnuM: Vector3;
  readonly radiusM: number;
  readonly velocityEnuMps?: Vector3;
}

export interface SphereContact {
  readonly a: string;
  readonly b: string;
  /** Unit normal from a toward b. */
  readonly normalEnu: Vector3;
  readonly penetrationM: number;
  readonly pointEnuM: Vector3;
  /** Velocity of b relative to a along the normal; negative means approaching. */
  readonly closingSpeedMps: number;
}

const sub = (a: Vector3, b: Vector3): Vector3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vector3, b: Vector3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a: Vector3, b: Vector3, t: number): Vector3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function checkSphere(s: SphereProxy): void {
  if (!s.centerEnuM.every(Number.isFinite) || !(s.radiusM > 0) || !Number.isFinite(s.radiusM) || (s.velocityEnuMps && !s.velocityEnuMps.every(Number.isFinite))) {
    throw new RangeError(`Sphere "${s.id}" must have a finite centre/velocity and a finite radius > 0.`);
  }
}

export function sphereAabb(s: SphereProxy): Aabb {
  const r = s.radiusM, c = s.centerEnuM;
  return { min: [c[0] - r, c[1] - r, c[2] - r], max: [c[0] + r, c[1] + r, c[2] + r] };
}

/** Exact sphere/sphere contact, or null when separated (touching counts as contact). */
export function sphereContact(a: SphereProxy, b: SphereProxy): SphereContact | null {
  checkSphere(a);
  checkSphere(b);
  const d = sub(b.centerEnuM, a.centerEnuM);
  const dist = Math.hypot(...d);
  const penetration = a.radiusM + b.radiusM - dist;
  if (penetration < 0) return null;
  // Coincident centres: pick a fixed, documented normal (world up) rather than NaN.
  const n: Vector3 = dist > 1e-12 ? [d[0] / dist, d[1] / dist, d[2] / dist] : [0, 0, 1];
  const va = a.velocityEnuMps ?? [0, 0, 0], vb = b.velocityEnuMps ?? [0, 0, 0];
  // Contact point: middle of the overlap, along the normal from a's surface.
  const k = a.radiusM - penetration / 2;
  const point: Vector3 = [a.centerEnuM[0] + n[0] * k, a.centerEnuM[1] + n[1] * k, a.centerEnuM[2] + n[2] * k];
  return { a: a.id, b: b.id, normalEnu: n, penetrationM: penetration, pointEnuM: point, closingSpeedMps: dot(sub(vb, va), n) };
}

/**
 * Earliest time t in [0, dt] at which two spheres moving at constant velocity touch, or null.
 * Swept test: catches fast pairs that would tunnel through each other between ticks.
 */
export function sweptSphereTimeOfImpact(a: SphereProxy, b: SphereProxy, dtSeconds: number): number | null {
  checkSphere(a);
  checkSphere(b);
  const p = sub(b.centerEnuM, a.centerEnuM);
  const v = sub(b.velocityEnuMps ?? [0, 0, 0], a.velocityEnuMps ?? [0, 0, 0]);
  const r = a.radiusM + b.radiusM;
  const c = dot(p, p) - r * r;
  if (c <= 0) return 0;
  const A = dot(v, v), B = 2 * dot(p, v);
  if (A === 0 || B >= 0) return null;
  const disc = B * B - 4 * A * c;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= dtSeconds ? t : null;
}

/** Broad phase through a SpatialIndex, exact narrow phase, contacts sorted by (a, b). */
export function findSphereContacts(spheres: readonly SphereProxy[], cellSizeM: number): SphereContact[] {
  const index = new SpatialIndex(cellSizeM);
  const byId = new Map<string, SphereProxy>();
  for (const s of spheres) {
    checkSphere(s);
    if (byId.has(s.id)) throw new RangeError(`Duplicate collision proxy id "${s.id}".`);
    byId.set(s.id, s);
    index.upsert(s.id, sphereAabb(s));
  }
  const contacts: SphereContact[] = [];
  for (const [a, b] of index.overlappingPairs()) {
    const c = sphereContact(byId.get(a) as SphereProxy, byId.get(b) as SphereProxy);
    if (c) contacts.push(c);
  }
  return contacts;
}

export type TerrainSegmentResult =
  | { readonly status: "hit"; readonly pointEnuM: Vector3; readonly fraction: number; readonly normalEnu: readonly [number, number, number]; readonly tileId: string }
  | { readonly status: "clear" }
  | { readonly status: "unknown"; readonly fraction: number; readonly reason: string };

/**
 * First intersection of segment from → to with the terrain surface. The segment is marched
 * at `stepM` (default 25 m; use at most half the terrain spacing to avoid skipping thin ridges)
 * and each crossing is refined by bisection to < 1 mm.
 */
export function segmentTerrainIntersection(terrain: TerrainSurface, from: Vector3, to: Vector3, stepM = 25): TerrainSegmentResult {
  if (!from.every(Number.isFinite) || !to.every(Number.isFinite)) throw new RangeError("Segment endpoints must be finite.");
  if (!(stepM > 0)) throw new RangeError("stepM must be > 0.");
  const length = Math.hypot(...sub(to, from));
  const steps = Math.max(1, Math.ceil(length / stepM));
  const clearance = (t: number): { ok: true; value: number; tile: string; normal: readonly [number, number, number] } | { ok: false; reason: string } => {
    const p = lerp(from, to, t);
    const s = terrain.sample(p[0], p[1]);
    return s.status === "valid" ? { ok: true, value: p[2] - s.heightM, tile: s.tileId, normal: s.normalEnu } : { ok: false, reason: s.reason };
  };
  let prevT = 0;
  let prev = clearance(0);
  if (!prev.ok) return { status: "unknown", fraction: 0, reason: prev.reason };
  if (prev.value <= 0) return { status: "hit", pointEnuM: from, fraction: 0, normalEnu: prev.normal, tileId: prev.tile };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cur = clearance(t);
    if (!cur.ok) return { status: "unknown", fraction: t, reason: cur.reason };
    if (cur.value <= 0) {
      let lo = prevT, hi = t;
      for (let k = 0; k < 60 && (hi - lo) * length > 1e-3; k++) {
        const mid = (lo + hi) / 2;
        const m = clearance(mid);
        if (m.ok && m.value > 0) lo = mid; else hi = mid;
      }
      const hit = clearance(hi);
      return { status: "hit", pointEnuM: lerp(from, to, hi), fraction: hi, normalEnu: hit.ok ? hit.normal : cur.normal, tileId: hit.ok ? hit.tile : cur.tile };
    }
    prevT = t;
    prev = cur;
  }
  return { status: "clear" };
}
