/**
 * F-16 FLCS pitch channel (PROJECT-DESIGNED gains; structure from NASA TP-1538 and the F-16
 * manual family): g command with attitude-compensated neutral, alpha fed back into the
 * integrated g error (AoA limiting), a hard alpha backstop, over-g protection, pitch-rate damping.
 * Output: stabilator ("elevator") command, deg, positive = nose down.
 */
import { F16_ACTUATORS, F16_FLCS_LIMITS } from "../F16Data.js";
import { clamp, DEG, type ChannelContext } from "./FlcsTypes.js";

export const PITCH_GAINS = Object.freeze({
  pitchProportionalDegPerG: 1.5,
  pitchIntegralDegPerGs: 4,
  /** The integral gain is scheduled with (q_ref/q)^this: weaker than the proportional path's 1/q. */
  pitchIntegralScheduleExponent: 0.5,
  pitchRateDampingDegPerRadps: 22,
  /** Pilot g-command prefilter time constant (s). */
  commandPrefilterS: 0.3,
  /** AoA feedback into the g-error path: g per degree of (predicted) alpha above the onset. */
  alphaFeedbackGPerDeg: 0.8,
  alphaFeedbackOnsetDeg: 17,
  /** Direct nose-down stabilator per degree of predicted alpha above the AoA limit (backstop). */
  alphaBackstopDegPerDeg: 3,
  /** Look-ahead (s) applied to the alpha rate in the AoA limiter. */
  alphaLimiterLeadS: 0.3,
  /** Over-g protection: nose-down stabilator per g of load factor (predicted ahead) above the limit (not q-scheduled). */
  overGDegPerG: 4,
  /** Look-ahead (s) on the load-factor rate for over-g protection. */
  overGLeadS: 0.15
});

export interface PitchOutput {
  readonly elevatorDeg: number;
  readonly nzCommandG: number;
  /** True while the AoA limiter is reducing the pilot's g command. */
  readonly alphaLimiting: boolean;
}

export class PitchChannel {
  /** Integrated g error, held directly as stabilator degrees (so q-scheduling cannot change it). */
  private integralDeg = 0;
  private filteredNzCmd = 1;
  private lastNz = 1;
  private lastAlpha = Number.NaN;
  private alphaRate = 0;

  public reset(): void {
    this.integralDeg = 0;
    this.filteredNzCmd = 1;
    this.lastNz = 1;
    this.lastAlpha = Number.NaN;
    this.alphaRate = 0;
  }

  public step(stickPitch: number, { sensors: s, schedule, dt }: ChannelContext): PitchOutput {
    const g = PITCH_GAINS, lim = F16_FLCS_LIMITS;
    const q = s.ratesRadps[1];

    // g command. Stick neutral holds the 1-g flight-path value (attitude compensated).
    const neutral = Math.cos(s.pitchRad) / Math.max(0.5, Math.cos(s.rollRad));
    const stick = clamp(stickPitch, -1, 1);
    let nzCmd = stick >= 0 ? neutral + stick * (lim.maxPositiveG.value - neutral) : neutral + stick * (neutral - lim.maxNegativeG.value);
    nzCmd = clamp(nzCmd, lim.maxNegativeG.value, lim.maxPositiveG.value);
    this.filteredNzCmd += (nzCmd - this.filteredNzCmd) * (1 - Math.exp(-dt / g.commandPrefilterS));

    // AoA limiting (F-16 structure): above an onset, alpha — predicted a short time ahead from the
    // filtered alpha rate — is fed back INTO the g-error path, so a single integrator settles where
    // nz command − nz = K·(α − onset). Full g is available at moderate alpha, and the available
    // g falls as alpha rises; nothing winds up against a separate limiter. Alpha rate, not pitch
    // rate, is used for the lead: in a steady turn q is large but alpha is constant.
    if (Number.isNaN(this.lastAlpha)) this.lastAlpha = s.alphaRad;
    const rawRate = dt > 0 ? (s.alphaRad - this.lastAlpha) / dt : 0;
    this.lastAlpha = s.alphaRad;
    this.alphaRate += (rawRate - this.alphaRate) * (1 - Math.exp(-dt / 0.05));
    const alphaPred = (s.alphaRad + g.alphaLimiterLeadS * Math.max(0, this.alphaRate)) * DEG;
    const alphaFeedbackG = g.alphaFeedbackGPerDeg * Math.max(0, alphaPred - g.alphaFeedbackOnsetDeg);
    // Hard backstop at the AoA limit itself (direct nose-down, not through the integrator).
    const backstopDeg = g.alphaBackstopDegPerDeg * Math.max(0, alphaPred - lim.alphaLimitDeg.value);
    const alphaLimiting = alphaFeedbackG > 0.5 || backstopDeg > 0;

    const error = this.filteredNzCmd - s.nzG - alphaFeedbackG;
    // Over-g protection: load factor predicted a short time ahead beyond the structural limit
    // drives the stabilator nose-down, so a stored integrator cannot carry the jet past 9 g.
    const nzRate = dt > 0 ? (s.nzG - this.lastNz) / dt : 0;
    this.lastNz = s.nzG;
    const overG = Math.max(0, s.nzG + g.overGLeadS * nzRate - lim.maxPositiveG.value);
    const elevLimit = F16_ACTUATORS.elevatorLimitDeg.value;
    const unsaturated = (-g.pitchProportionalDegPerG * error + g.pitchRateDampingDegPerRadps * q) * schedule + g.overGDegPerG * overG + backstopDeg + this.integralDeg;
    // Integrator in stabilator degrees, limited to the stabilator travel. Anti-windup: it does not
    // integrate further into saturation, and it bleeds off while the backstop or over-g act.
    if (backstopDeg > 0 || overG > 0) {
      this.integralDeg *= Math.exp(-dt / 0.3);
    } else if (Math.abs(unsaturated) < elevLimit || Math.sign(unsaturated) !== -Math.sign(error)) {
      this.integralDeg = clamp(this.integralDeg - g.pitchIntegralDegPerGs * error * Math.pow(schedule, g.pitchIntegralScheduleExponent) * dt, -elevLimit, elevLimit);
    }
    return { elevatorDeg: clamp(unsaturated, -elevLimit, elevLimit), nzCommandG: this.filteredNzCmd, alphaLimiting };
  }
}
