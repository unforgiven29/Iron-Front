import { describe, expect, it } from "vitest";
import { SpatialIndex } from "../../src/core/spatial/SpatialIndex.js";
import { findSphereContacts, segmentTerrainIntersection, sphereContact, sweptSphereTimeOfImpact, type SphereProxy } from "../../src/physics/collision/Collision.js";
import { TerrainSurface, type HeightfieldTileDefinition } from "../../src/world/terrain/Terrain.js";

const box = (x: number, y: number, z: number, r = 1) => ({ min: [x - r, y - r, z - r] as [number, number, number], max: [x + r, y + r, z + r] as [number, number, number] });

describe("SpatialIndex", () => {
  it("finds overlaps, updates on move, removes, and returns sorted results", () => {
    const idx = new SpatialIndex(10);
    idx.upsert("c", box(0, 0, 0));
    idx.upsert("a", box(1.5, 0, 0));
    idx.upsert("b", box(50, 0, 0));
    expect(idx.queryAabb(box(0, 0, 0, 3))).toEqual(["a", "c"]);
    expect(idx.overlappingPairs()).toEqual([["a", "c"]]);
    idx.upsert("b", box(0.5, 0.5, 0));
    expect(idx.overlappingPairs()).toEqual([["a", "b"], ["a", "c"], ["b", "c"]]);
    expect(idx.remove("a")).toBe(true);
    expect(idx.remove("a")).toBe(false);
    expect(idx.queryAabb(box(50, 0, 0))).toEqual([]);
    expect(idx.size).toBe(2);
  });

  it("does not change results compared with brute force, regardless of insertion order", () => {
    const boxes = Array.from({ length: 60 }, (_, i) => ({ id: `e${i}`, b: box(((i * 37) % 97) - 48, ((i * 53) % 89) - 44, ((i * 11) % 23) - 11, 1 + (i % 4)) }));
    const brute = new Set<string>();
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i]!.b, B = boxes[j]!.b;
      if (A.min.every((v, k) => v <= B.max[k]!) && A.max.every((v, k) => v >= B.min[k]!)) brute.add([boxes[i]!.id, boxes[j]!.id].sort().join("|"));
    }
    const forward = new SpatialIndex(7), backward = new SpatialIndex(7);
    for (const e of boxes) forward.upsert(e.id, e.b);
    for (const e of [...boxes].reverse()) backward.upsert(e.id, e.b);
    const pairs = forward.overlappingPairs();
    expect(new Set(pairs.map((p) => p.join("|")))).toEqual(brute);
    expect(backward.overlappingPairs()).toEqual(pairs);
  });

  it("rejects invalid boxes and cell sizes", () => {
    expect(() => new SpatialIndex(0)).toThrow("cellSizeM");
    const idx = new SpatialIndex(1);
    expect(() => idx.upsert("x", { min: [1, 0, 0], max: [0, 1, 1] })).toThrow("min must not exceed max");
    expect(() => idx.upsert("x", { min: [Number.NaN, 0, 0], max: [1, 1, 1] })).toThrow("finite");
    expect(() => idx.upsert("huge", { min: [0, 0, 0], max: [1000, 1000, 1000] })).toThrow("larger cell size");
  });
});

describe("sphere collision", () => {
  const s = (id: string, c: [number, number, number], r: number, v?: [number, number, number]): SphereProxy => ({ id, centerEnuM: c, radiusM: r, ...(v ? { velocityEnuMps: v } : {}) });

  it("computes exact contact normal, depth, point and closing speed", () => {
    const c = sphereContact(s("a", [0, 0, 0], 2, [10, 0, 0]), s("b", [3, 0, 0], 2, [-5, 0, 0]));
    expect(c).toEqual({ a: "a", b: "b", normalEnu: [1, 0, 0], penetrationM: 1, pointEnuM: [1.5, 0, 0], closingSpeedMps: -15 });
    expect(sphereContact(s("a", [0, 0, 0], 1), s("b", [2.0001, 0, 0], 1))).toBeNull();
    expect(sphereContact(s("a", [0, 0, 0], 1), s("b", [2, 0, 0], 1))?.penetrationM).toBe(0);
    expect(sphereContact(s("a", [1, 1, 1], 1), s("b", [1, 1, 1], 1))?.normalEnu).toEqual([0, 0, 1]);
    expect(() => sphereContact(s("a", [0, 0, 0], 0), s("b", [0, 0, 0], 1))).toThrow("radius");
  });

  it("catches tunnelling with a swept test", () => {
    // A 1 m bullet-sized pair closing at 1000 m/s, 5 m apart, one 1/120 s tick: no overlap at either end.
    const a = s("a", [0, 0, 0], 0.5, [1000, 0, 0]), b = s("b", [5, 0, 0], 0.5);
    expect(sphereContact({ ...a, centerEnuM: [1000 / 120, 0, 0] }, b)).toBeNull();
    expect(sweptSphereTimeOfImpact(a, b, 1 / 120)).toBeCloseTo(0.004, 12);
    expect(sweptSphereTimeOfImpact(s("a", [0, 0, 0], 0.5, [-1, 0, 0]), b, 1)).toBeNull();
    expect(sweptSphereTimeOfImpact(s("a", [0, 0, 0], 0.5, [0, 1, 0]), b, 100)).toBeNull();
    expect(sweptSphereTimeOfImpact(s("a", [4.5, 0, 0], 0.6), b, 1)).toBe(0);
  });

  it("finds all contacts in stable order and rejects duplicate ids", () => {
    const list = [s("z", [0, 0, 0], 1), s("m", [1.5, 0, 0], 1), s("a", [100, 0, 0], 1), s("b", [101, 0, 0], 1)];
    expect(findSphereContacts(list, 5).map((c) => `${c.a}-${c.b}`)).toEqual(["a-b", "m-z"]);
    expect(findSphereContacts([...list].reverse(), 5)).toEqual(findSphereContacts(list, 5));
    expect(() => findSphereContacts([list[0]!, list[0]!], 5)).toThrow("Duplicate");
  });
});

describe("segment vs terrain", () => {
  /** Test-only: a ramp h = 0.1 x over [0, 400] x [0, 400], with a no-data hole near x = 300. */
  function rampTerrain(withHole = false): TerrainSurface {
    const n = 41, sp = 10;
    const heights = new Float64Array(n * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) heights[r * n + c] = 0.1 * c * sp;
    if (withHole) for (let r = 0; r < n; r++) heights[r * n + 30] = Number.NaN;
    const def: HeightfieldTileDefinition = { tileId: "test/ramp", version: 1, originEnuM: [0, 0], spacingM: sp, columns: n, rows: n, heightsM: heights, verticalDatum: "scenario-origin", provenance: { kind: "synthetic", source: "test ramp" } };
    const t = new TerrainSurface();
    t.addTile(def);
    return t;
  }

  it("finds the exact crossing of a level segment with a ramp", () => {
    const r = segmentTerrainIntersection(rampTerrain(), [0, 200, 20], [400, 200, 20], 5);
    expect(r.status).toBe("hit");
    if (r.status !== "hit") return;
    expect(r.pointEnuM[0]).toBeCloseTo(200, 2); // 0.1 x = 20
    expect(r.normalEnu[2]).toBeGreaterThan(0.99);
  });

  it("reports clear above the terrain, and unknown rather than clear across missing data", () => {
    expect(segmentTerrainIntersection(rampTerrain(), [0, 50, 100], [350, 50, 100]).status).toBe("clear");
    const r = segmentTerrainIntersection(rampTerrain(true), [0, 50, 100], [350, 50, 100], 5);
    expect(r.status).toBe("unknown");
    expect(segmentTerrainIntersection(rampTerrain(), [0, 50, 100], [900, 50, 100]).status).toBe("unknown");
    expect(segmentTerrainIntersection(rampTerrain(), [100, 50, 5], [200, 50, 50])).toMatchObject({ status: "hit", fraction: 0 });
  });
});
