/**
 * F-16 FLCS yaw channel: NASA TP-1538 appendix A, figure 65 (control system A). Block for block:
 *
 *   pedal → 60/(s+60) → rudder command (fig 65b; linear ±30° at full pedal here) → ×fade(α_f: 1 at
 *     20°, 0 at 30°)
 *   r → 50/(s+50) = r_f;  y = 1.5s/(s+1) · (3s+15)/(s+15) · (r_f − p·α_f/57.3)
 *   δr = pedal + 0.5·(y + 19.32·a_y) + ARI·δa_c, ARI = 0.075·α_f − tri(α_f)·S(q̄/Ps)
 *     tri = 1 at α 0 falling to 0 at |α| 10°; S = 0 at q̄/Ps 0.187 rising to 1 at 1.129
 *   α_f ≥ 29°: yaw damper path off; departure/spin prevention adds 0.75·r_f
 * Rudder positive = nose left (source convention); limited ±30°.
 * Not from the source: the pedal force gradient (figure 65b was not legible here; linear assumed).
 */
import { F16_ACTUATORS } from "../F16Data.js";
import { Lag, LeadLag, schedule, Washout } from "./Filters.js";
import { clamp, DEG, type ChannelContext } from "./FlcsTypes.js";

export const YAW_GAINS = Object.freeze({
  yawDamperGain: 0.5, lateralAccelDegPerG: 19.32, ariAlphaSlope: 0.075, spinPreventionAlphaDeg: 29, spinPreventionYawRateGain: 0.75,
  pedalFadeStartDeg: 20, pedalFadeEndDeg: 30
});

export class YawChannel {
  private readonly pedalFilter = new Lag(60);
  private readonly yawRateFilter = new Lag(50);
  private readonly alphaFilter = new Lag(10);
  private readonly leadLag = new LeadLag(3, 15, 15);
  private readonly washout = new Washout(1.5, 1);

  public reset(): void {
    for (const f of [this.pedalFilter, this.yawRateFilter, this.alphaFilter, this.leadLag, this.washout]) f.reset();
  }

  /** `aileronDeg` is the roll channel's command (δa_c), used by the aileron–rudder interconnect. */
  public step(pedal: number, aileronDeg: number, { sensors: s, dt }: ChannelContext): number {
    const g = YAW_GAINS, limit = F16_ACTUATORS.rudderLimitDeg.value;
    const alphaF = this.alphaFilter.step(clamp(s.alphaRad * DEG, -5, 30), dt);
    const fade = 1 - clamp((alphaF - g.pedalFadeStartDeg) / (g.pedalFadeEndDeg - g.pedalFadeStartDeg), 0, 1);
    const pedalDeg = -this.pedalFilter.step(clamp(pedal, -1, 1), dt) * limit * fade;
    const rF = this.yawRateFilter.step(s.ratesRadps[2] * DEG, dt);
    const stabilityAxis = rF - (s.ratesRadps[0] * DEG * alphaF) / 57.3;
    const y = this.washout.step(this.leadLag.step(stabilityAxis, dt), dt);
    const tri = Math.max(0, 1 - Math.abs(alphaF) / 10);
    const qOverPs = s.dynamicPressurePa / Math.max(1, s.staticPressurePa);
    const ari = g.ariAlphaSlope * alphaF - tri * schedule([[0.187, 0], [1.129, 1]], qOverPs);
    const spin = s.alphaRad * DEG >= g.spinPreventionAlphaDeg;
    const damper = spin ? g.spinPreventionYawRateGain * rF : g.yawDamperGain * (y + g.lateralAccelDegPerG * s.nyG);
    return clamp(pedalDeg + damper + ari * aileronDeg, -limit, limit);
  }
}
