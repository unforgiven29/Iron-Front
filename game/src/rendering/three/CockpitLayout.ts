/**
 * Data contract for an untextured cockpit: simple shapes positioned in the aircraft body frame
 * (FRD, metres) relative to the pilot's design eye point. Aircraft packages supply a layout;
 * the shared Three.js view renders any layout without aircraft-specific code.
 */
export type CockpitPartKind = "box" | "cylinder" | "screen" | "glass";

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
}

export interface CockpitLayout {
  readonly aircraftId: string;
  readonly provenance: string;
  /** Design eye point relative to the CG, body FRD metres. */
  readonly eyeFromCgM: readonly [number, number, number];
  readonly parts: readonly CockpitPart[];
  /** Vertical field of view, degrees. */
  readonly fieldOfViewDeg: number;
}
