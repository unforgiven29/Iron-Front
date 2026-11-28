/**
 * Data contract for an untextured cockpit: simple shapes positioned in the aircraft body frame
 * (FRD, metres) relative to the pilot's design eye point. Aircraft packages supply a layout;
 * the shared Three.js view renders any layout without aircraft-specific code.
 */
import type { Object3D } from "three";
import type { InstrumentFace } from "../instruments/Gauges.js";

export type CockpitPartKind = "box" | "cylinder" | "screen" | "glass" | "instrument";

export interface CockpitPart {
  readonly id: string;
  readonly kind: CockpitPartKind;
  /** Centre, body FRD metres from the design eye point. */
  readonly positionM: readonly [number, number, number];
  /** Box: [length x, width y, height z]; cylinder: [radius, length, -]; screen/glass: [width, height, -]. */
  readonly sizeM: readonly [number, number, number];
  /** Rotation about body x, y, z (rad), applied in that order. */
  readonly rotationRad?: readonly [number, number, number];
  readonly color: string;
  /** Animated binding: which pilot input or switch moves this part. */
  readonly binding?:
    | { readonly kind: "stick" }
    | { readonly kind: "throttle" }
    | { readonly kind: "switch"; readonly switchId: string; readonly positions: readonly string[] };
  /** Screen content id rendered by the view ("hud", "mfd-left", ...). */
  readonly screen?: string;
  /** Instrument face (kind "instrument"): drawn from the values the view source reports for this part id. sizeM[0] = diameter (round faces) or [width, height] (tapes). */
  readonly instrument?: InstrumentFace;
}

export interface CockpitLayout {
  readonly aircraftId: string;
  readonly provenance: string;
  /** Design eye point relative to the CG, body FRD metres. */
  readonly eyeFromCgM: readonly [number, number, number];
  readonly parts: readonly CockpitPart[];
  /** Vertical field of view, degrees. */
  readonly fieldOfViewDeg: number;
  /** Fixed pilot-view pitch trim in radians; negative angles look slightly down. */
  readonly cameraPitchOffsetRad?: number;
  /** Optional aircraft-specific procedural shell, returned in cockpit-camera coordinates. */
  readonly buildShell?: () => Object3D;
  /**
   * Optional 3D shell model (glTF/GLB) drawn around the simple parts (tub, sills, canopy frame).
   * Visual only: it is never clicked and never used for reach or vision analysis. The view scales
   * the model so its longest horizontal extent equals `lengthM`, applies `rotationRad` (about the
   * model's own axes; glTF is +Y up) and places its bounding-box centre at `centreM` (body FRD
   * metres from the design eye point). If loading fails the simple parts stay on their own.
   */
  readonly shellModel?: {
    readonly url: string;
    readonly lengthM: number;
    readonly centreM: readonly [number, number, number];
    readonly rotationRad?: readonly [number, number, number];
    readonly provenance: string;
  };
}
