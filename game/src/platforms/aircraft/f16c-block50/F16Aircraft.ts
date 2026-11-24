/**
 * Convenience factory: the F-16C Block 50 definition flown by the shared FixedWingAircraft runtime.
 * All F-16-specific behaviour lives in F16Definition.ts and the files it imports.
 */
import type { EnvironmentConfig } from "../../../physics/environment/Atmosphere.js";
import type { TerrainSurface } from "../../../world/terrain/Terrain.js";
import { FixedWingAircraft, type StartState } from "../common/FixedWingAircraft.js";
import { createF16Definition, type F16AeroModelId } from "./F16Definition.js";

export { F16_SWITCHES, F16_TEST_CG } from "./F16Switches.js";

export function createF16Aircraft(terrain: TerrainSurface, env: EnvironmentConfig, start: StartState, options: { aeroModel?: F16AeroModelId } = {}): FixedWingAircraft {
  return new FixedWingAircraft(createF16Definition(options), terrain, env, start);
}
