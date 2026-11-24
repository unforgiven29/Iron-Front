/**
 * The game's test range: the synthetic debug terrain with one airfield flattened into it.
 * Fictional, for flight testing; not a real place.
 */
import { createTestTerrain } from "../debug/DebugFlyer.js";
import { flattenTileForAirfield, type AirfieldSpec } from "../world/infrastructure/Airfield.js";
import { generateSyntheticTile, TerrainSurface } from "../world/terrain/Terrain.js";

export interface TestRange {
  readonly terrain: TerrainSurface;
  readonly airfield: AirfieldSpec;
}

const RUNWAY_CENTRE: readonly [number, number] = [0, -12000];

export function createTestRange(seed = 7): TestRange {
  // Field elevation: the natural terrain height at the runway centre.
  const natural = createTestTerrain(seed).sample(RUNWAY_CENTRE[0], RUNWAY_CENTRE[1]);
  const airfield: AirfieldSpec = {
    id: "test-range.field", name: "Test Range Field", elevationM: natural.status === "valid" ? natural.heightM : 0,
    runways: [{ id: "36/18", centreEnuM: RUNWAY_CENTRE, headingRad: 0, lengthM: 3000, widthM: 45, surface: "asphalt" }],
    flatMarginM: 400, blendM: 900, provenance: "Fictional test airfield"
  };
  const terrain = new TerrainSurface();
  for (let ty = -2; ty <= 2; ty++) for (let tx = -2; tx <= 2; tx++) {
    // Same tiles as createTestTerrain, then flattened under the airfield.
    terrain.addTile(flattenTileForAirfield(generateSyntheticTile({
      seed, tileId: `range/${tx + 2}-${ty + 2}`, originEnuM: [tx * 8000 - 4000, ty * 8000 - 4000],
      spacingM: 100, columns: 81, rows: 81, baseHeightM: 50, reliefM: 1400, featureSizeM: 9000
    }), airfield));
  }
  return { terrain, airfield };
}
