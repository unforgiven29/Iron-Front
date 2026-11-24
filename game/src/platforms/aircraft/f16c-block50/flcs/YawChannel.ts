/**
 * F-16 FLCS yaw channel (PROJECT-DESIGNED gains; structure from NASA TP-1538): pedal command
 * faded at high alpha, aileron–rudder interconnect, stability-axis roll coordination, washed-out
 * yaw damper and sideslip feedback. Output: rudder command, deg (negative yaws nose right).
 */
import { F16_ACTUATORS } from "../F16Data.js";
import { clamp, DEG, type ChannelContext } from "./FlcsTypes.js";

export const YAW_GAINS = Object.freeze({
  yawRateDampingDegPerRadps: 25,
  sideslipDegPerDeg: 4,
  /** Aileron–rudder interconnect: rudder deg per (aileron deg × alpha rad). */
  ariGain: 2.5,
  /** Stability-axis roll: rudder per rad/s of yaw-rate error from r = p·tanα (rolls about the velocity vector). */
  stabilityAxisRollDegPerRadps: 70,
  /** Yaw-damper washout time constant (s): steady turn rate is not opposed. */
  yawDamperWashoutS: 1.0,
  /** Pedal authority fades between these alphas (TP-1538: pedal command reduced to zero between 20° and 30°). */
  pedalFadeStartDeg: 20,
  pedalFadeEndDeg: 30
});

export class YawChannel {
  private yawRateLowPass = 0;

  public reset(): void {
    this.yawRateLowPass = 0;
  }

  /** `aileronDeg` is the roll channel's command, used by the aileron–rudder interconnect. */
  public step(pedal: number, aileronDeg: number, { sensors: s, schedule, dt }: ChannelContext): number {
    const g = YAW_GAINS;
    const [p, , r] = s.ratesRadps;
    this.yawRateLowPass += (r - this.yawRateLowPass) * (1 - Math.exp(-dt / g.yawDamperWashoutS));
    const rWashed = r - this.yawRateLowPass;
    const pedalFade = 1 - clamp((s.alphaRad * DEG - g.pedalFadeStartDeg) / (g.pedalFadeEndDeg - g.pedalFadeStartDeg), 0, 1);
    const ari = g.ariGain * Math.max(0, s.alphaRad) * aileronDeg;
    // Negative rudder yaws nose right (positive r): drive r toward p·tanα.
    const stabAxis = -g.stabilityAxisRollDegPerRadps * (p * Math.tan(s.alphaRad) - r);
    const limit = F16_ACTUATORS.rudderLimitDeg.value;
    return clamp(
      -clamp(pedal, -1, 1) * pedalFade * limit + ari + stabAxis * schedule + (g.yawRateDampingDegPerRadps * rWashed - g.sideslipDegPerDeg * s.betaRad * DEG) * schedule,
      -limit, limit
    );
  }
}
