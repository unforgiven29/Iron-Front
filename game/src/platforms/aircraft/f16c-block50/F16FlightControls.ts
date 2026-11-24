/**
 * F-16 flight-control computer: the control laws of NASA TP-1538 (Nguyen et al., 1979)
 * appendix A — the fly-by-wire system simulated with the same F-16 aerodynamic data — plus that
 * report's "control system B" roll-coupling protections. These are the published simulator
 * control laws for an F-16-class aircraft, NOT the production Block 50 OFP. Deviations are listed
 * in each channel file. Sensor inputs are ideal onboard measurements (no sensor models yet).
 *
 * Each axis is its own channel in ./flcs/: PitchChannel → RollChannel (uses the stabilator
 * command for roll limiting) → YawChannel (uses the roll command for the ARI). This file only
 * computes the shared gain schedule and wires the channels together.
 */
import type { SurfaceDeflections } from "./F16FlightModel.js";
import type { FlcsSensors, PilotInputs } from "./flcs/FlcsTypes.js";
import { PitchChannel } from "./flcs/PitchChannel.js";
import { RollChannel } from "./flcs/RollChannel.js";
import { YawChannel } from "./flcs/YawChannel.js";

export type { FlcsSensors, PilotInputs } from "./flcs/FlcsTypes.js";
export { PITCH_GAINS } from "./flcs/PitchChannel.js";
export type { ChannelContext } from "./flcs/FlcsTypes.js";
export { ROLL_GAINS } from "./flcs/RollChannel.js";
export { YAW_GAINS } from "./flcs/YawChannel.js";

export interface FlcsOutput {
  readonly commands: SurfaceDeflections;
  readonly nzCommandG: number;
  readonly rollRateCommandRadps: number;
  /** True while the AoA limiter is reducing the pilot's g command. */
  readonly alphaLimiting: boolean;
}

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
    const ctx = { sensors, dt };
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
