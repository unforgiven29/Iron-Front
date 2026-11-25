/**
 * Shared geometry for scanning sensors: where a target lies relative to a beam (or detector
 * field) that moved from one direction to another during a tick. Used by the radar and infrared
 * physics; platform-neutral and stateless.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";

export const dot = (a: Vector3, b: Vector3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const sub = (a: Vector3, b: Vector3): Vector3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vector3, b: Vector3): Vector3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vector3, k: number): Vector3 => [a[0] * k, a[1] * k, a[2] * k];
export const norm = (a: Vector3): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vector3): Vector3 => { const n = norm(a); return n > 0 ? [a[0] / n, a[1] / n, a[2] / n] : [1, 0, 0]; };
export const cross = (a: Vector3, b: Vector3): Vector3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const angleBetween = (a: Vector3, b: Vector3): number => Math.atan2(norm(cross(a, b)), dot(a, b));

/**
 * Relation of a line of sight to a beam that swept from `from` to `to` (unit vectors) in a tick.
 * - `crossed`: the beam centre passed the target's along-scan position during this tick
 *   (half-open interval, so consecutive ticks never count the same pass twice).
 * - `offsetRad`: the beam centre's closest angular distance to the target during the tick.
 * A stationary beam (from ≈ to) "stares": crossed is true and the offset is the plain angle.
 */
export function sweepRelation(los: Vector3, fromIn: Vector3, toIn: Vector3): { readonly crossed: boolean; readonly offsetRad: number } {
  const from = unit(fromIn), to = unit(toIn);
  const swept = angleBetween(from, to);
  if (swept < 1e-6) return { crossed: true, offsetRad: angleBetween(los, from) };
  const mid = unit(add(from, to));
  const along = unit(sub(to, from));
  const across = cross(mid, along);
  const m = dot(los, mid);
  if (m <= 0) return { crossed: false, offsetRad: Math.PI };
  const x = Math.atan2(dot(los, along), m);
  const y = Math.atan2(dot(los, across), m);
  // Crossing: the target's position along the swept arc, φ ∈ [0, swept) measured about the arc's
  // axis. The interval is shifted by a tiny ε so the tick boundaries (which fall on a regular grid of
  // scan angles) never coincide with targets placed on round angles; consecutive ticks still
  // partition the sweep up to the small-circle/great-circle mismatch (≪ 1e-4 rad).
  const axis = unit(cross(from, to));
  const p = sub(los, scale(axis, dot(los, axis)));
  const phi = Math.atan2(dot(axis, cross(from, p)), dot(from, p));
  const eps = 1e-4;
  if (phi >= -eps && phi < swept - eps) return { crossed: true, offsetRad: Math.abs(y) };
  const half = swept / 2;
  return { crossed: false, offsetRad: Math.hypot(Math.max(0, Math.abs(x) - half), y) };
}
