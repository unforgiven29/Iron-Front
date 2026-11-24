/**
 * F-16 FLCS pitch channel: NASA TP-1538 (Nguyen et al., 1979) appendix A, figure 62 "basic pitch
 * control system (control system A)", with the control-system-B roll-coupling modification
 * (figures 28–29). Implemented block for block:
 *
 *   stick force → 60/(s+60) → command gradient (fig 62e, g) → limit [neg-g(q̄) fig 62b, +limit]
 *     → 8.3/(s+8.3) = command
 *   α → limit [−5°, 30°] → 10/(s+10) = α_f;  q → s/(s+1) = q_w;  (nz − 1) → 50/(s+50)
 *   feedback F = (3s+12)/(s+12) · [ 0.322·max(0, 0.7·K_q(q̄)·q_w + α_f + Δα_p − 15) + 0.334·q_w + (nz−1)_f ]
 *   error e = F + max(0, α_f + Δα_p − 20.4) − command
 *   δh = 1.5·K_loop(q̄)·e · (1 + 5/s)   [integrator ±25°]  + 0.5·α_f
 *   Δα_p (system B) = clamp(0.67/(s+0.67)·0.15·|p| − 3, 0, 5.4)
 * Units: g, deg, deg/s; δh positive = trailing edge down (nose down).
 *
 * Not in TP-1538 (which simulated flight only): with weight on wheels the integrator is held at
 * zero, as F-16-type FLCSs inhibit integrators on the ground, so it cannot wind up while the
 * load factor is held at 1 g by the gear.
 *
 * Deviation from the source: the positive g limit is the F-16C's published 9 g (TP-1538's
 * simulator used 8 g); the AoA limit in 1-g flight is then ≈26° instead of ≈25°. Pitch trim
 * (±2.4 g in the source) is not wired to a cockpit control yet.
 */
import { F16_ACTUATORS, F16_FLCS_LIMITS } from "../F16Data.js";
import { Lag, LeadLag, schedule, Washout } from "./Filters.js";
import { clamp, DEG, type ChannelContext } from "./FlcsTypes.js";

/** Figure 62(e) pitch command gradient, stick force (N, + = pull) → incremental g. */
export const PITCH_COMMAND_GRADIENT: readonly (readonly [number, number])[] = [[-80, -4], [-30, -0.8], [-8, 0], [8, 0], [35, 0.4], [180, 10.8]];
/** Stick force at full deflection: aft reaches the positive g limit, forward is the gradient's end. */
export const STICK_FORCE_N = { aft: 35 + (F16_FLCS_LIMITS.maxPositiveG.value - 1 - 0.4) / ((10.8 - 0.4) / 145), forward: 80 };
/** Figure 62(b): negative g limit vs q̄ (kN/m²). */
export const NEGATIVE_G_LIMIT: readonly (readonly [number, number])[] = [[1.7, -1], [8.9, -4]];
/** Figure 62(c): pitch-rate gain vs q̄ (kN/m²). */
export const PITCH_RATE_GAIN: readonly (readonly [number, number])[] = [[5.2, 1], [15.5, 0.42]];
/** Figure 62(d): pitch-loop gain vs q̄ (kN/m²). */
export const PITCH_LOOP_GAIN: readonly (readonly [number, number])[] = [[10, 1], [43, 0.4]];

export const PITCH_GAINS = Object.freeze({
  alphaFeedbackOnsetDeg: 15, alphaFeedbackGPerDeg: 0.322, alphaLimitOnsetDeg: 20.4, alphaLimitGPerDeg: 1,
  pitchRateInAlphaPath: 0.7, pitchRateFeedback: 0.334, forwardGainDegPerG: 1.5, integralPerS: 5, integratorLimitDeg: 25,
  alphaStabilityDegPerDeg: 0.5
});

export interface PitchOutput {
  readonly elevatorDeg: number;
  readonly nzCommandG: number;
  /** True while the AoA limiter is reducing the pilot's g command. */
  readonly alphaLimiting: boolean;
}

export class PitchChannel {
  private readonly stickFilter = new Lag(60);
  private readonly commandFilter = new Lag(8.3);
  private readonly alphaFilter = new Lag(10);
  private readonly pitchRateWashout = new Washout(1, 1);
  private readonly nzFilter = new Lag(50);
  private readonly feedbackLeadLag = new LeadLag(3, 12, 12);
  private readonly rollCoupling = new Lag(0.67);
  private integralDeg = 0;

  public reset(): void {
    for (const f of [this.stickFilter, this.commandFilter, this.alphaFilter, this.pitchRateWashout, this.nzFilter, this.feedbackLeadLag, this.rollCoupling]) f.reset();
    this.integralDeg = 0;
  }

  public step(stickPitch: number, { sensors: s, dt }: ChannelContext): PitchOutput {
    const g = PITCH_GAINS;
    const qbarK = s.dynamicPressurePa / 1000;
    const stick = clamp(stickPitch, -1, 1);
    const force = this.stickFilter.step(stick >= 0 ? stick * STICK_FORCE_N.aft : stick * STICK_FORCE_N.forward, dt);
    const gradient = schedule(PITCH_COMMAND_GRADIENT, force);
    const limited = Math.max(schedule(NEGATIVE_G_LIMIT, qbarK), Math.min(F16_FLCS_LIMITS.maxPositiveG.value - 1, gradient));
    const command = this.commandFilter.step(limited, dt);

    const alphaF = this.alphaFilter.step(clamp(s.alphaRad * DEG, -5, 30), dt);
    const qW = this.pitchRateWashout.step(s.ratesRadps[1] * DEG, dt);
    const nzF = this.nzFilter.step(s.nzG - 1, dt);
    const dAlphaP = clamp(this.rollCoupling.step(0.15 * Math.abs(s.ratesRadps[0] * DEG), dt) - 3, 0, 5.4);
    const alphaForLimiter = alphaF + dAlphaP;

    const alphaPath = g.alphaFeedbackGPerDeg * Math.max(0, g.pitchRateInAlphaPath * schedule(PITCH_RATE_GAIN, qbarK) * qW + alphaForLimiter - g.alphaFeedbackOnsetDeg);
    const feedback = this.feedbackLeadLag.step(alphaPath + g.pitchRateFeedback * qW + nzF, dt);
    const limiter = g.alphaLimitGPerDeg * Math.max(0, alphaForLimiter - g.alphaLimitOnsetDeg);
    const error = feedback + limiter - command;

    const u = g.forwardGainDegPerG * schedule(PITCH_LOOP_GAIN, qbarK) * error;
    this.integralDeg = s.weightOnWheels ? 0 : clamp(this.integralDeg + g.integralPerS * u * dt, -g.integratorLimitDeg, g.integratorLimitDeg);
    const elevLimit = F16_ACTUATORS.elevatorLimitDeg.value;
    return {
      elevatorDeg: clamp(u + this.integralDeg + g.alphaStabilityDegPerDeg * alphaF, -elevLimit, elevLimit),
      nzCommandG: 1 + command,
      alphaLimiting: alphaPath > 0.5 || limiter > 0
    };
  }
}
