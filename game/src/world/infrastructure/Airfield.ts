/**
 * Airfields and runways (owner: world/infrastructure; spec in game/world/infrastructure/README.md).
 *
 * A runway is a stable world entity with geometry (centre, true heading, length, width), surface
 * and elevation. Terrain under an airfield is flattened to the field elevation by an explicit,
 * deterministic terrain modification (the terrain owner keeps the resulting heights; nothing
 * here moves aircraft). Not modelled yet: taxiways, parking, lighting, markings beyond the
 * runway outline, surface condition, ownership and damage.
 */
import type { HeightfieldTileDefinition } from "../terrain/Terrain.js";

export interface RunwaySpec {
  readonly id: string;
  /** Runway centre, ENU metres. */
  readonly centreEnuM: readonly [number, number];
  /** True heading of the runway direction named first (0 = north, clockwise), rad. */
  readonly headingRad: number;
  readonly lengthM: number;
  readonly widthM: number;
  readonly surface: "asphalt" | "concrete";
}

export interface AirfieldSpec {
  readonly id: string;
  readonly name: string;
  readonly elevationM: number;
  readonly runways: readonly RunwaySpec[];
  /** Flat area beyond the runway edges and ends, and the blend distance back to natural terrain, m. */
  readonly flatMarginM: number;
  readonly blendM: number;
  readonly provenance: string;
}

/** Runway-aligned coordinates of a point: along (from centre, +toward the heading) and across (right). */
export function runwayFrame(r: RunwaySpec, x: number, y: number): { along: number; across: number } {
  const dx = x - r.centreEnuM[0], dy = y - r.centreEnuM[1];
  const sx = Math.sin(r.headingRad), sy = Math.cos(r.headingRad); // unit vector along the heading (ENU)
  return { along: dx * sx + dy * sy, across: dx * sy - dy * sx };
}

/** Weight 1 inside the flat area, falling smoothly to 0 across the blend distance. */
export function flatteningWeight(a: AirfieldSpec, x: number, y: number): number {
  let w = 0;
  for (const r of a.runways) {
    const p = runwayFrame(r, x, y);
    const outside = Math.max(Math.abs(p.along) - (r.lengthM / 2 + a.flatMarginM), Math.abs(p.across) - (r.widthM / 2 + a.flatMarginM), 0);
    const t = Math.max(0, 1 - outside / a.blendM);
    w = Math.max(w, t * t * (3 - 2 * t));
  }
  return w;
}

/** A copy of a terrain tile with the airfield area flattened to the field elevation. */
export function flattenTileForAirfield(tile: HeightfieldTileDefinition, a: AirfieldSpec): HeightfieldTileDefinition {
  const heights = new Float64Array(tile.heightsM.length);
  for (let r = 0; r < tile.rows; r++) for (let c = 0; c < tile.columns; c++) {
    const k = r * tile.columns + c;
    const w = flatteningWeight(a, tile.originEnuM[0] + c * tile.spacingM, tile.originEnuM[1] + r * tile.spacingM);
    heights[k] = (tile.heightsM[k] as number) * (1 - w) + a.elevationM * w;
  }
  return { ...tile, heightsM: heights, provenance: { ...tile.provenance, source: `${tile.provenance.source}; flattened for airfield ${a.id}` } };
}

/** Position and heading for lining up on a runway: `fromThresholdM` beyond the threshold, on the centreline. */
export function runwayLineUp(a: AirfieldSpec, r: RunwaySpec, fromThresholdM: number, reciprocal = false): { readonly positionEnuM: readonly [number, number]; readonly headingRad: number } {
  const heading = reciprocal ? (r.headingRad + Math.PI) % (2 * Math.PI) : r.headingRad;
  const along = -r.lengthM / 2 + fromThresholdM;
  const sx = Math.sin(heading), sy = Math.cos(heading);
  void a;
  return { positionEnuM: [r.centreEnuM[0] + sx * along, r.centreEnuM[1] + sy * along], headingRad: heading };
}
