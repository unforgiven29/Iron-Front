/**
 * F-16 flight-control computer, PROJECT-DESIGNED.
 *
 * The real F-16 FLCS (four-channel digital, g command, AoA/g limiter, roll-rate command, ARI and
 * yaw damper) is documented in structure in NASA TP-1538 and the flight manual family, but its
 * gains and schedules are not public. The control laws follow that structure with gains designed
 * for this provisional aero dataset. They are NOT the F-16 OFP and must not be described as such.
 * Sensor inputs are ideal onboard measurements (no sensor models yet).
 *
 * Each axis is its own channel in ./flcs/: PitchChannel → RollChannel (uses the stabilator
 * command for roll limiting) → YawChannel (uses the roll command for the ARI). This file only
 * computes the shared gain schedule and wires the channels together.
 */
import type { SurfaceDeflections } from "./F16FlightModel.js";
import { clamp, type FlcsSensors, type PilotInputs } from "./flcs/FlcsTypes.js";
import { PitchChannel } from "./flcs/PitchChannel.js";
import { RollChannel } from "./flcs/RollChannel.js";
import { YawChannel } from "./flcs/YawChannel.js";

export type { FlcsSensors, PilotInputs } from "./flcs/FlcsTypes.js";
export { PITCH_GAINS } from "./flcs/PitchChannel.js";
export { ROLL_GAINS } from "./flcs/RollChannel.js";
export { YAW_GAINS } from "./flcs/YawChannel.js";

export interface FlcsOutput {
  readonly commands: SurfaceDeflections;
  readonly nzCommandG: number;
  readonly rollRateCommandRadps: number;
  /** True while the AoA limiter is reducing the pilot's g command. */
  readonly alphaLimiting: boolean;
}

/** Gain schedule shared by all channels: gains scale with q_ref / q, within limits. */
export const FLCS_SCHEDULE = Object.freeze({ referenceDynamicPressurePa: 20_000, min: 0.25, max: 4 });

export class F16FlightControls {
  private readonly pitch = new PitchChannel();
  private readonly roll = new RollChannel();
  private readonly yaw = new YawChannel();

  public reset(): void {
    this.pitch.reset();
    this.roll.reset();
    this.yaw.reset();
  }

  public step(pilot: PilotInputs, sensors: FlcsSensors, dt: number): FlcsOutput {
    const schedule = clamp(FLCS_SCHEDULE.referenceDynamicPressurePa / Math.max(1, sensors.dynamicPressurePa), FLCS_SCHEDULE.min, FLCS_SCHEDULE.max);
    const ctx = { sensors, schedule, dt };
    const pitch = this.pitch.step(pilot.pitch, ctx);
    const roll = this.roll.step(pilot.roll, pitch.elevatorDeg, ctx);
    const rudderDeg = this.yaw.step(pilot.yaw, roll.aileronDeg, ctx);
    return {
      commands: { elevatorDeg: pitch.elevatorDeg, aileronDeg: roll.aileronDeg, rudderDeg },
      nzCommandG: pitch.nzCommandG,
      rollRateCommandRadps: roll.rollRateCommandRadps,
      alphaLimiting: pitch.alphaLimiting
    };
  }
}
