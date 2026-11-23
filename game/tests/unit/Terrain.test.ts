import { describe, expect, it } from "vitest";
import { generateSyntheticTile, TerrainDefinitionError, TerrainSurface, type HeightfieldTileDefinition } from "../../src/world/terrain/Terrain.js";

/** Test-only planar tile: h = a + bx*x + by*y (bilinear interpolation is exact on planes). */
function plane(tileId: string, origin: [number, number], a: number, bx: number, by: number, n = 5, spacing = 10): HeightfieldTileDefinition {
  const heights = new Float64Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) heights[r * n + c] = a + bx * (origin[0] + c * spacing) + by * (origin[1] + r * spacing);
  return { tileId, version: 1, originEnuM: origin, spacingM: spacing, columns: n, rows: n, heightsM: heights, verticalDatum: "scenario-origin", provenance: { kind: "synthetic", source: "test plane" } };
}

describe("TerrainSurface", () => {
  it("returns exact height, normal and slope on a plane with provenance", () => {
    const t = new TerrainSurface();
    t.addTile(plane("test/a", [0, 0], 100, 0.5, 0));
    const s = t.sample(13.7, 22.2);
    expect(s.status).toBe("valid");
    if (s.status !== "valid") return;
    expect(s.heightM).toBeCloseTo(100 + 0.5 * 13.7, 12);
    expect(s.slopeRad).toBeCloseTo(Math.atan(0.5), 12);
    const n = Math.hypot(0.5, 1);
    s.normalEnu.forEach((v, i) => expect(v).toBeCloseTo([-0.5 / n, 0, 1 / n][i] as number, 12));
    expect(s.provenance).toEqual({ kind: "synthetic", source: "test plane" });
  });

  it("never reports missing terrain as flat ground", () => {
    const t = new TerrainSurface();
    expect(t.sample(0, 0)).toMatchObject({ status: "outside-coverage" });
    const def = plane("test/holes", [0, 0], 0, 0, 0);
    const heights = Float64Array.from(def.heightsM);
    heights[2 * 5 + 2] = Number.NaN;
    t.addTile({ ...def, heightsM: heights });
    expect(t.sample(25, 25)).toMatchObject({ status: "no-data", tileId: "test/holes" });
    expect(t.sample(5, 5).status).toBe("valid");
    expect(t.sample(1000, 0)).toMatchObject({ status: "outside-coverage" });
    expect(t.heightAboveTerrain([25, 25, 50])).toMatchObject({ status: "no-data" });
    expect(t.heightAboveTerrain([5, 5, 50])).toEqual({ status: "valid", aglM: 50 });
    expect(t.sample(Number.NaN, 0).status).toBe("outside-coverage");
  });

  it("accepts matching seams and rejects mismatched seams, overlaps and datum mixes", () => {
    const t = new TerrainSurface();
    t.addTile(plane("test/a", [0, 0], 10, 0.2, 0.1));
    t.addTile(plane("test/b", [40, 0], 10, 0.2, 0.1));
    expect(t.sample(40, 17)).toMatchObject({ status: "valid", tileId: "test/a" }); // shared edge: deterministic owner
    const s = t.sample(55, 17);
    expect(s.status === "valid" && s.heightM).toBeCloseTo(10 + 0.2 * 55 + 0.1 * 17, 12);
    expect(() => t.addTile(plane("test/c", [0, 40], 99, 0, 0))).toThrow("Seam between");
    expect(() => t.addTile(plane("test/d", [20, 20], 10, 0.2, 0.1))).toThrow("overlaps");
    expect(() => t.addTile({ ...plane("test/e", [80, 0], 10, 0.2, 0.1), verticalDatum: "EGM96" })).toThrow("does not match the surface datum");
  });

  it("validates tile definitions and lists every problem", () => {
    const t = new TerrainSurface();
    try {
      t.addTile({ ...plane("Bad Id", [0, 0], 0, 0, 0), spacingM: 0, version: 0, verticalDatum: " ", provenance: { kind: "measured", source: "" }, heightsM: new Float64Array(3) });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TerrainDefinitionError);
      expect((e as TerrainDefinitionError).problems.length).toBeGreaterThanOrEqual(5);
    }
    t.addTile(plane("test/a", [0, 0], 0, 0, 0));
    expect(() => t.addTile(plane("test/a", [100, 100], 0, 0, 0))).toThrow("already loaded");
    expect(t.removeTile("test/a")).toBe(true);
    expect(t.sample(5, 5).status).toBe("outside-coverage");
  });

  it("copies tile data so later mutation of the source array cannot change terrain", () => {
    const def = plane("test/a", [0, 0], 5, 0, 0);
    const t = new TerrainSurface();
    t.addTile(def);
    (def.heightsM as Float64Array).fill(999);
    const s = t.sample(10, 10);
    expect(s.status === "valid" && s.heightM).toBe(5);
  });
});

describe("generateSyntheticTile", () => {
  const opts = { seed: 42, originEnuM: [0, 0] as [number, number], spacingM: 50, columns: 41, rows: 41, baseHeightM: 100, reliefM: 800, featureSizeM: 4000 };

  it("is deterministic, bounded, labelled synthetic and seamless across neighbours", () => {
    const a = generateSyntheticTile({ ...opts, tileId: "synthetic/0-0" });
    expect(generateSyntheticTile({ ...opts, tileId: "synthetic/0-0" }).heightsM).toEqual(a.heightsM);
    expect(a.provenance).toEqual({ kind: "synthetic", source: "value-noise v1 seed 42" });
    for (const h of a.heightsM) { expect(h).toBeGreaterThanOrEqual(100); expect(h).toBeLessThanOrEqual(900); }
    const b = generateSyntheticTile({ ...opts, tileId: "synthetic/1-0", originEnuM: [2000, 0] });
    const t = new TerrainSurface();
    t.addTile(a);
    expect(() => t.addTile(b, 1e-9)).not.toThrow();
    expect(generateSyntheticTile({ ...opts, seed: 43, tileId: "x" }).heightsM).not.toEqual(a.heightsM);
  });
});
