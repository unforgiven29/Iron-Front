/** Types and helpers shared by the F-16 FLCS channels (pitch, roll, yaw). */

export interface PilotInputs {
  /** -1..1; +1 = stick back. */
  readonly pitch: number;
  /** -1..1; +1 = stick right. */
  readonly roll: number;
  /** -1..1; +1 = right pedal. */
  readonly yaw: number;
}

export interface FlcsSensors {
  /** Normal load factor (g), positive in a pull. */
  readonly nzG: number;
  /** Lateral load factor (g), positive to the right. */
  readonly nyG: number;
  /** Weight on wheels (optional: false when absent). */
  readonly weightOnWheels?: boolean;
  readonly alphaRad: number;
  readonly betaRad: number;
  /** Body rates p, q, r (rad/s). */
  readonly ratesRadps: readonly [number, number, number];
  readonly dynamicPressurePa: number;
  readonly staticPressurePa: number;
  readonly trueAirspeedMps: number;
  readonly pitchRad: number;
  readonly rollRad: number;
}

/** What every channel receives each step besides its own pilot input. */
export interface ChannelContext {
  readonly sensors: FlcsSensors;
  readonly dt: number;
}

export const DEG = 180 / Math.PI;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
