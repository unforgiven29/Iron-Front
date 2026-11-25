/**
 * The game's test range: the synthetic debug terrain with one airfield flattened into it.
 * Fictional, for flight testing; not a real place.
 */
import { createTestTerrain } from "../debug/DebugFlyer.js";
import { flattenTileForAirfield, type AirfieldSpec } from "../world/infrastructure/Airfield.js";
import { generateSyntheticTile, TerrainSurface } from "../world/terrain/Terrain.js";
import { SIGNATURES, type AirTargetSpec } from "../world/targets/AirTargets.js";
import { NOTIONAL_FIGHTER_RADAR, type HostileFighterSpec } from "../world/combat/HostileFighters.js";
import { NOTIONAL_AAM } from "../weapons/catalog/NotionalAirToAir.js";

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

export type TargetScenario = "range" | "dummies" | "none" | "hostile-1" | "hostile-2" | "hostile-4";

export interface ScenarioInfo { readonly id: TargetScenario; readonly label: string; readonly description: string; readonly hostile: boolean }

export const SCENARIOS: readonly ScenarioInfo[] = [
  { id: "hostile-1", label: "1 v 1 — Lone Viper", description: "A single hostile F-16C closes from the north. It carries AIM-120 and AIM-9X.", hostile: true },
  { id: "hostile-2", label: "1 v 2 — Viper pair", description: "Two hostile F-16Cs in a loose pair, splitting to bracket you.", hostile: true },
  { id: "hostile-4", label: "1 v 4 — Four-ship", description: "A four-ship of hostile F-16Cs in two elements. Survive.", hostile: true },
  { id: "range", label: "Range traffic", description: "Scripted, non-hostile targets for sensor and weapons practice.", hostile: false },
  { id: "dummies", label: "Sensor test dummies", description: "Six scripted targets, each isolating one sensor behaviour.", hostile: false },
  { id: "none", label: "Free flight", description: "Empty sky.", hostile: false }
];

/**
 * Hostile F-16C flights (LOW FIDELITY: point-mass AI with notional weapons; see HostileFighters).
 * They start ~55 km north of the air-start point heading south.
 */
export function hostileSpecs(scenario: TargetScenario): readonly HostileFighterSpec[] {
  const n = scenario === "hostile-1" ? 1 : scenario === "hostile-2" ? 2 : scenario === "hostile-4" ? 4 : 0;
  const D = Math.PI / 180;
  const slots: readonly [number, number, number][] = [[0, 0, 6500], [4000, -2500, 6000], [-9000, -6000, 7000], [-13000, -8500, 6500]];
  const names = ["Bandit 1-1", "Bandit 1-2", "Bandit 2-1", "Bandit 2-2"];
  return slots.slice(0, n).map(([x, y, z], i) => ({
    id: `hostile-${i + 1}`, label: `${names[i]} (F-16C, hostile, low fidelity)`, modelId: "f16c-aggressor", signature: SIGNATURES.fighter, side: "red" as const,
    positionEnuM: [x, 40000 + y, z] as const, headingRad: 180 * D, speedMps: 250,
    loadout: [NOTIONAL_AAM.AIM120, NOTIONAL_AAM.AIM120, NOTIONAL_AAM.AIM9X, NOTIONAL_AAM.AIM9X],
    skill: 0.45 + 0.1 * i,
    radar: NOTIONAL_FIGHTER_RADAR
  }));
}

/**
 * Dummy targets for sensor testing, laid out ahead of the air-start point (0, −18 km, heading north).
 * Each one isolates one behaviour; all use the σ = 3 m² reference fighter. Synthetic, not AI.
 */
export function createDummyTargets(): readonly AirTargetSpec[] {
  const D = Math.PI / 180;
  const ref = SIGNATURES.fighter;
  const at = (x: number, yAhead: number, alt: number) => [x, -18000 + yAhead, alt] as const;
  return [
    { id: "dummy-head-60", label: "Head-on, 60 km, 4 km alt (radar В detection range)", signature: ref, positionEnuM: at(0, 60000, 4000), headingRad: 180 * D, speedMps: 220, throttle: 0.85 },
    { id: "dummy-tail-25", label: "Tail-on, 25 km ahead, slower (mode Д / KOLS tail)", signature: ref, positionEnuM: at(-2500, 25000, 2500), headingRad: 0, speedMps: 160, throttle: 1, afterburner: 0 },
    { id: "dummy-beam-30", label: "Beam crosser, 30 km (Doppler notch test)", signature: ref, positionEnuM: at(-15000, 30000, 3000), headingRad: 90 * D, speedMps: 230, throttle: 0.85 },
    { id: "dummy-low-35", label: "Low look-down target, 35 km, 300 m (clutter test)", signature: ref, positionEnuM: at(4000, 35000, 300), headingRad: 180 * D, speedMps: 230, throttle: 0.85 },
    { id: "dummy-orbit-6", label: "Close orbit, 6 km ahead, afterburner (Б.БОЙ / ББ / laser)", signature: ref, positionEnuM: at(0, 6000, 1900), headingRad: 270 * D, speedMps: 180, throttle: 1, afterburner: 1,
      script: [{ kind: "turn", rateDegS: 4, durationS: 90 }] },
    { id: "dummy-jink-15", label: "Jinking, 15 km, 3 km alt (lock retention)", signature: ref, positionEnuM: at(2000, 15000, 3000), headingRad: 180 * D, speedMps: 250, throttle: 0.9,
      script: [{ kind: "turn", rateDegS: 12, durationS: 4 }, { kind: "turn", rateDegS: -12, durationS: 8 }, { kind: "turn", rateDegS: 12, durationS: 4 }, { kind: "straight", durationS: 6 }] }
  ];
}

export function targetsFor(scenario: TargetScenario): readonly AirTargetSpec[] {
  return scenario === "range" ? createRangeTargets() : scenario === "dummies" ? createDummyTargets() : [];
  // Hostile scenarios add AI bodies instead (hostileSpecs).
}
