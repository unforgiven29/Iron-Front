/**
 * The only door between world truth and onboard sensors (owner: physics/sensing).
 *
 * A sensor describes what it is doing (a beam or detector field moving through space this tick)
 * and receives physical returns: echo power, Doppler geometry and angles for a radar; contrast
 * irradiance and background for an infrared sensor. It never receives a target list, identities,
 * or positions outside its own beam/field. Implementations live in the world layer.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import type { IrFieldQuery, IrPoint } from "../infrared/InfraredPhysics.js";
import type { ClutterPatch, ClutterQuery, RadarBeamQuery, RadarEcho } from "../radar/RadarPhysics.js";

export interface SensorScene {
  /** Returns from one tick of beam motion (main lobe and sidelobes). */
  radar(query: RadarBeamQuery): readonly RadarEcho[];
  /** Ground clutter seen by a look (the world supplies terrain height and reflectivity). */
  radarClutter(query: Omit<ClutterQuery, "groundHeightM" | "gammaDb">): readonly ClutterPatch[];
  /** Point sources inside one tick of detector-field motion. */
  infrared(query: IrFieldQuery): readonly IrPoint[];
  /** Unit vector toward the sun (ENU). */
  readonly sunDirectionEnu: Vector3;
}

/** A scene with nothing in it (no targets): sensors still run, scan and report nothing. */
export const EMPTY_SENSOR_SCENE: SensorScene = { radar: () => [], radarClutter: () => [], infrared: () => [], sunDirectionEnu: [0.37, -0.28, 0.89] };
