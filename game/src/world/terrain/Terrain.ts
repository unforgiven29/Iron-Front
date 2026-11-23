/**
 * Terrain heightfield tiles and physical surface queries.
 *
 * Owner: game/world/terrain. One versioned source per tile. Every query returns its validity
 * and provenance, and unknown terrain is never reported as flat ground: missing tiles and
 * no-data cells come back as explicit statuses that callers must handle.
 *
 * Frames and units: local ENU metres, horizontal (x east, y north). Heights are metres above
 * the scenario's vertical datum (declared per tile and required to match across a surface).
 */

export type TerrainProvenanceKind = "measured" | "synthetic";

export interface TerrainProvenance {
  readonly kind: TerrainProvenanceKind;
  /** Dataset name/licence for measured data; generator id/seed for synthetic data. */
  readonly source: string;
}

export interface HeightfieldTileDefinition {
  readonly tileId: string;
  readonly version: number;
  /** ENU position of sample [0, 0] (south-west corner), metres. */
  readonly originEnuM: readonly [number, number];
  /** Grid spacing, metres, > 0. */
  readonly spacingM: number;
  readonly columns: number;
  readonly rows: number;
  /** Row-major heights, row 0 = south edge. NaN marks a no-data sample. */
  readonly heightsM: Float64Array;
  readonly verticalDatum: string;
  readonly provenance: TerrainProvenance;
}

export type TerrainSample =
  | {
      readonly status: "valid";
      readonly heightM: number;
      /** Unit upward surface normal, world ENU. */
      readonly normalEnu: readonly [number, number, number];
      /** Angle from horizontal, radians. */
      readonly slopeRad: number;
      readonly tileId: string;
      readonly tileVersion: number;
      readonly provenance: TerrainProvenance;
    }
  | { readonly status: "no-data"; readonly tileId: string; readonly reason: string }
  | { readonly status: "outside-coverage"; readonly reason: string };

export class TerrainDefinitionError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid terrain definition:\n${problems.join("\n")}`);
    this.name = "TerrainDefinitionError";
  }
}

interface Tile extends HeightfieldTileDefinition {
  readonly maxX: number;
  readonly maxY: number;
}

export class TerrainSurface {
  private readonly tiles: Tile[] = [];
  private datum: string | null = null;

  /** Tiles currently loaded, in id order. */
  public get tileIds(): readonly string[] {
    return this.tiles.map((t) => t.tileId);
  }

  /**
   * Add a tile after validating it. Overlapping interiors are rejected. Shared edges must
   * agree within `seamToleranceM` (default 1 mm), so seams cannot hide cliffs or gaps.
   */
  public addTile(def: HeightfieldTileDefinition, seamToleranceM = 1e-3): void {
    const problems: string[] = [];
    if (!/^[a-z0-9][a-z0-9._/-]*$/.test(def.tileId)) problems.push(`Tile id "${def.tileId}" is not a stable lowercase id.`);
    if (this.tiles.some((t) => t.tileId === def.tileId)) problems.push(`Tile "${def.tileId}" is already loaded.`);
    if (!Number.isSafeInteger(def.version) || def.version < 1) problems.push("version must be an integer >= 1.");
    if (!(def.spacingM > 0) || !Number.isFinite(def.spacingM)) problems.push("spacingM must be finite and > 0.");
    if (!Number.isSafeInteger(def.columns) || def.columns < 2 || !Number.isSafeInteger(def.rows) || def.rows < 2) problems.push("A tile needs at least 2x2 samples.");
    if (!def.originEnuM.every(Number.isFinite)) problems.push("originEnuM must be finite.");
    if (def.heightsM.length !== def.columns * def.rows) problems.push(`heightsM has ${def.heightsM.length} samples; expected ${def.columns * def.rows}.`);
    if (def.heightsM.some((h) => !Number.isNaN(h) && !Number.isFinite(h))) problems.push("heightsM may contain finite values or NaN (no-data) only.");
    if (def.verticalDatum.trim() === "") problems.push("verticalDatum must be declared.");
    if (this.datum !== null && def.verticalDatum !== this.datum) problems.push(`Vertical datum "${def.verticalDatum}" does not match the surface datum "${this.datum}".`);
    if (def.provenance.source.trim() === "") problems.push("provenance.source must be declared.");
    if (problems.length > 0) throw new TerrainDefinitionError(problems);

    const tile: Tile = {
      ...def,
      heightsM: Float64Array.from(def.heightsM),
      maxX: def.originEnuM[0] + def.spacingM * (def.columns - 1),
      maxY: def.originEnuM[1] + def.spacingM * (def.rows - 1)
    };
    for (const other of this.tiles) {
      const overlapX = Math.min(tile.maxX, other.maxX) - Math.max(tile.originEnuM[0], other.originEnuM[0]);
      const overlapY = Math.min(tile.maxY, other.maxY) - Math.max(tile.originEnuM[1], other.originEnuM[1]);
      if (overlapX > 1e-9 && overlapY > 1e-9) problems.push(`Tile "${def.tileId}" overlaps "${other.tileId}".`);
      else if ((overlapX >= -1e-9 && overlapY > 1e-9) || (overlapY >= -1e-9 && overlapX > 1e-9)) {
        problems.push(...seamProblems(tile, other, seamToleranceM));
      }
    }
    if (problems.length > 0) throw new TerrainDefinitionError(problems);
    this.tiles.push(tile);
    this.tiles.sort((a, b) => (a.tileId < b.tileId ? -1 : 1));
    this.datum = def.verticalDatum;
  }

  public removeTile(tileId: string): boolean {
    const i = this.tiles.findIndex((t) => t.tileId === tileId);
    if (i < 0) return false;
    this.tiles.splice(i, 1);
    if (this.tiles.length === 0) this.datum = null;
    return true;
  }

  /** Height, normal and slope at a horizontal position. Bilinear within a cell. */
  public sample(xM: number, yM: number): TerrainSample {
    if (!Number.isFinite(xM) || !Number.isFinite(yM)) return { status: "outside-coverage", reason: "query position is not finite" };
    // Deterministic owner for points on a shared edge: first tile in id order that covers it.
    const tile = this.tiles.find((t) => xM >= t.originEnuM[0] && xM <= t.maxX && yM >= t.originEnuM[1] && yM <= t.maxY);
    if (!tile) return { status: "outside-coverage", reason: `no terrain tile covers (${xM.toFixed(1)}, ${yM.toFixed(1)})` };
    return sampleTile(tile, xM, yM);
  }

  /** Height of a point above the terrain below it, or the non-valid sample explaining why it is unknown. */
  public heightAboveTerrain(positionEnuM: readonly [number, number, number]): { readonly status: "valid"; readonly aglM: number } | Exclude<TerrainSample, { status: "valid" }> {
    const s = this.sample(positionEnuM[0], positionEnuM[1]);
    return s.status === "valid" ? { status: "valid", aglM: positionEnuM[2] - s.heightM } : s;
  }
}


function sampleTile(tile: Tile, x: number, y: number): TerrainSample {
  const u = (x - tile.originEnuM[0]) / tile.spacingM;
  const v = (y - tile.originEnuM[1]) / tile.spacingM;
  const i = Math.min(Math.floor(u), tile.columns - 2);
  const j = Math.min(Math.floor(v), tile.rows - 2);
  const fu = u - i;
  const fv = v - j;
  const at = (c: number, r: number): number => tile.heightsM[r * tile.columns + c] as number;
  const h00 = at(i, j), h10 = at(i + 1, j), h01 = at(i, j + 1), h11 = at(i + 1, j + 1);
  if ([h00, h10, h01, h11].some(Number.isNaN)) {
    return { status: "no-data", tileId: tile.tileId, reason: `cell (${i}, ${j}) of tile "${tile.tileId}" has no-data samples` };
  }
  const height = h00 * (1 - fu) * (1 - fv) + h10 * fu * (1 - fv) + h01 * (1 - fu) * fv + h11 * fu * fv;
  const dhdx = ((h10 - h00) * (1 - fv) + (h11 - h01) * fv) / tile.spacingM;
  const dhdy = ((h01 - h00) * (1 - fu) + (h11 - h10) * fu) / tile.spacingM;
  const n = Math.hypot(dhdx, dhdy, 1);
  return {
    status: "valid",
    heightM: height,
    normalEnu: [-dhdx / n, -dhdy / n, 1 / n],
    slopeRad: Math.atan(Math.hypot(dhdx, dhdy)),
    tileId: tile.tileId,
    tileVersion: tile.version,
    provenance: tile.provenance
  };
}

function seamProblems(a: Tile, b: Tile, tolerance: number): string[] {
  const problems: string[] = [];
  // Compare along the shared edge at the finer of the two spacings.
  const x0 = Math.max(a.originEnuM[0], b.originEnuM[0]), x1 = Math.min(a.maxX, b.maxX);
  const y0 = Math.max(a.originEnuM[1], b.originEnuM[1]), y1 = Math.min(a.maxY, b.maxY);
  const step = Math.min(a.spacingM, b.spacingM);
  const length = Math.max(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.round(length / step));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const pa = sampleTile(a, x, y), pb = sampleTile(b, x, y);
    if (pa.status === "valid" && pb.status === "valid" && Math.abs(pa.heightM - pb.heightM) > tolerance) {
      problems.push(`Seam between "${a.tileId}" and "${b.tileId}" differs by ${Math.abs(pa.heightM - pb.heightM).toFixed(3)} m at (${x.toFixed(1)}, ${y.toFixed(1)}).`);
      break;
    }
  }
  return problems;
}

// ---------------- synthetic terrain ----------------

/** 32-bit integer hash of (seed, i, j): position-keyed, so generation order never matters. */
function latticeValue(seed: number, i: number, j: number): number {
  let h = (seed ^ Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

function smoothNoise(seed: number, x: number, y: number): number {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = latticeValue(seed, i, j), b = latticeValue(seed, i + 1, j);
  const c = latticeValue(seed, i, j + 1), d = latticeValue(seed, i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export interface SyntheticTerrainOptions {
  readonly seed: number;
  readonly tileId: string;
  readonly originEnuM: readonly [number, number];
  readonly spacingM: number;
  readonly columns: number;
  readonly rows: number;
  /** Height range of the generated relief, metres. */
  readonly baseHeightM: number;
  readonly reliefM: number;
  /** Horizontal size of the largest features, metres. */
  readonly featureSizeM: number;
}

/**
 * Deterministic synthetic heightfield (fractal value noise). It is labelled synthetic in its
 * provenance, so it can never be mistaken for measured geodata. Heights depend only on world
 * position and seed, so adjacent synthetic tiles from the same seed meet seamlessly.
 */
export function generateSyntheticTile(o: SyntheticTerrainOptions): HeightfieldTileDefinition {
  const heights = new Float64Array(o.columns * o.rows);
  for (let r = 0; r < o.rows; r++) {
    for (let c = 0; c < o.columns; c++) {
      const x = o.originEnuM[0] + c * o.spacingM;
      const y = o.originEnuM[1] + r * o.spacingM;
      let value = 0, amplitude = 1, total = 0, frequency = 1 / o.featureSizeM;
      for (let octave = 0; octave < 5; octave++) {
        value += amplitude * smoothNoise(o.seed + octave * 1013, x * frequency, y * frequency);
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }
      heights[r * o.columns + c] = o.baseHeightM + o.reliefM * (value / total);
    }
  }
  return {
    tileId: o.tileId,
    version: 1,
    originEnuM: o.originEnuM,
    spacingM: o.spacingM,
    columns: o.columns,
    rows: o.rows,
    heightsM: heights,
    verticalDatum: "scenario-origin",
    provenance: { kind: "synthetic", source: `value-noise v1 seed ${o.seed}` }
  };
}
