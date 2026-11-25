/**
 * The game's test range: the synthetic debug terrain with one airfield flattened into it.
 * Fictional, for flight testing; not a real place.
 */
import { createTestTerrain } from "../debug/DebugFlyer.js";
import { flattenTileForAirfield, type AirfieldSpec } from "../world/infrastructure/Airfield.js";
import { generateSyntheticTile, TerrainSurface } from "../world/terrain/Terrain.js";
import { SIGNATURES, type AirTargetSpec } from "../world/targets/AirTargets.js";

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

/**
 * Synthetic air targets for the range (sensor testing; scripted point masses, not AI). Positions
 * are ENU metres; the air start places the ownship at (0, −18 km) heading north.
 */
export function createRangeTargets(): readonly AirTargetSpec[] {
  const D = Math.PI / 180;
  return [
    { id: "bandit-1", label: "Fighter, head-on, weaving", signature: SIGNATURES.fighter, positionEnuM: [3000, 55000, 5000], headingRad: 180 * D, speedMps: 250, throttle: 0.85,
      script: [{ kind: "straight", durationS: 40 }, { kind: "turn", rateDegS: 3, durationS: 10 }, { kind: "turn", rateDegS: -3, durationS: 20 }, { kind: "turn", rateDegS: 3, durationS: 10 }] },
    { id: "bandit-2", label: "Fighter, crossing low", signature: SIGNATURES.fighter, positionEnuM: [-30000, 25000, 1200], headingRad: 90 * D, speedMps: 230, throttle: 0.9,
      script: [{ kind: "straight", durationS: 200 }, { kind: "turn", rateDegS: 3, durationS: 60 }] },
    { id: "bomber-1", label: "Bomber, high", signature: SIGNATURES.bomber, positionEnuM: [10000, 95000, 9500], headingRad: 195 * D, speedMps: 220, throttle: 0.8 },
    { id: "bandit-3", label: "Fighter, orbiting near the field (close-combat practice)", signature: SIGNATURES.fighter, positionEnuM: [0, -6000, 2500], headingRad: 270 * D, speedMps: 200, throttle: 0.75,
      script: [{ kind: "turn", rateDegS: 2.5, durationS: 144 }, { kind: "power", throttle: 1, afterburner: 1 }, { kind: "turn", rateDegS: 6, durationS: 30 }, { kind: "power", throttle: 0.75, afterburner: 0 }] }
  ];
}
