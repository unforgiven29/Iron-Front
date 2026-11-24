/**
 * F-16 FLCS roll channel: NASA TP-1538 appendix A, figure 64 (control system A), with the
 * control-system-B roll-rate limiting (TP-1538 pp. 18–19, figure 26). Block for block:
 *
 *   stick force → 60/(s+60) → command gradient (fig 64b, deg/s) → |p_cmd| ≤ p_max (system B)
 *   p → 50/(s+50) → (4s²+64s+6400)/(s²+80s+6400) = p_f
 *   command shaping: y = 10/(s+10)·(p_cmd − f⁺ − f⁻), with feedback f⁺ = [6s/(s+20) on y⁺]⁺ and
 *     f⁻ = [6s/(s+20) on y⁻]⁻ (limits the command's onset rate)
 *   δa = 0.12·(p_f − y) (source convention: positive δa rolls left), limited ±21.5°
 *   α_f ≥ 29°: roll CAS disengaged; departure/spin prevention δa = 0.12·8.34·r_f
 *   system B p_max = 308 − 0.0115·max(0, 10 500 − q̄) − 4·max(0, α − 15) − 4·max(0, δh − 5), ≥ 80 °/s
 * The "aileron" here is the dataset's combined roll control (flaperons + differential tail 4:1).
 * Deviation: the source has a pilot roll-trim input (±40°/s, gain 1.67). There is no trim control
 * yet, so a slow automatic roll trim integrates the rate error while the stick is centred and the
 * jet is nearly steady; it removes the small roll asymmetry of the TP-1538 tables at β = 0.
 */
import { F16_ACTUATORS, F16_FLCS_LIMITS } from "../F16Data.js";
import { Biquad, Lag, schedule, Washout } from "./Filters.js";
import { clamp, DEG, type ChannelContext } from "./FlcsTypes.js";

/** Figure 64(b) roll command gradient, stick force (N, + = right) → deg/s (symmetric). */
export const ROLL_COMMAND_GRADIENT: readonly (readonly [number, number])[] = [[4, 0], [25, 20], [47, 80], [75, 308]];
export const ROLL_STICK_FORCE_N = 75;

export const ROLL_GAINS = Object.freeze({
  forwardGainDegPerDegS: 0.12,
  spinPreventionAlphaDeg: 29, spinPreventionYawRateGain: 8.34,
  rollLimitQBreakPa: 10_500, rollLimitPerPaDegS: 0.0115, rollLimitAlphaOnsetDeg: 15, rollLimitPerAlphaDegS: 4,
  rollLimitStabOnsetDeg: 5, rollLimitPerStabDegS: 4, rollLimitMinDegS: 80
});

export interface RollOutput {
  readonly aileronDeg: number;
  readonly rollRateCommandRadps: number;
}

export class RollChannel {
  private readonly stickFilter = new Lag(60);
  private readonly rateFilter = new Lag(50);
  private readonly notch = new Biquad([4, 64, 6400], [80, 6400]);
  private readonly commandLag = new Lag(10);
  private readonly feedbackPos = new Washout(6, 20);
  private readonly feedbackNeg = new Washout(6, 20);
  private shaped = 0;
  private fb = 0;
  private readonly yawRateFilter = new Lag(50);
  /** Automatic roll trim, deg of roll control (see header). */
  private trimDeg = 0;

  public reset(): void {
    this.trimDeg = 0;
    for (const f of [this.stickFilter, this.rateFilter, this.notch, this.commandLag, this.feedbackPos, this.feedbackNeg, this.yawRateFilter]) f.reset();
    this.shaped = 0;
    this.fb = 0;
  }

  /** `stabilatorDeg` is the pitch channel's current command (positive = nose down), used by the system-B limiter. */
  public step(stickRoll: number, stabilatorDeg: number, { sensors: s, dt }: ChannelContext): RollOutput {
    const g = ROLL_GAINS, lim = F16_FLCS_LIMITS;
    const force = this.stickFilter.step(clamp(stickRoll, -1, 1) * ROLL_STICK_FORCE_N, dt);
    const gradient = Math.sign(force) * schedule(ROLL_COMMAND_GRADIENT, Math.abs(force));
    const pMax = Math.max(g.rollLimitMinDegS, lim.maxRollRateDegS.value
      - g.rollLimitPerPaDegS * Math.max(0, g.rollLimitQBreakPa - s.dynamicPressurePa)
      - g.rollLimitPerAlphaDegS * Math.max(0, s.alphaRad * DEG - g.rollLimitAlphaOnsetDeg)
      - g.rollLimitPerStabDegS * Math.max(0, stabilatorDeg - g.rollLimitStabOnsetDeg));
    const pCmd = clamp(gradient, -pMax, pMax);

    const pF = this.notch.step(this.rateFilter.step(s.ratesRadps[0] * DEG, dt), dt);
    const rF = this.yawRateFilter.step(s.ratesRadps[2] * DEG, dt);
    // Command shaping: the rate-sensitive feedback uses the previous step's shaped command (no algebraic loop).
    this.shaped = this.commandLag.step(pCmd - this.fb, dt);
    this.fb = Math.max(0, this.feedbackPos.step(Math.max(0, this.shaped), dt)) + Math.min(0, this.feedbackNeg.step(Math.min(0, this.shaped), dt));
    const e = this.shaped - pF;
    const ailLimit = F16_ACTUATORS.aileronLimitDeg.value;
    const spin = s.alphaRad * DEG >= g.spinPreventionAlphaDeg;
    if (!spin && Math.abs(stickRoll) < 0.05 && Math.abs(pF) < 5) this.trimDeg = clamp(this.trimDeg - 0.2 * e * dt, -2, 2);
    const aileronDeg = spin ? g.forwardGainDegPerDegS * g.spinPreventionYawRateGain * rF : -g.forwardGainDegPerDegS * e + this.trimDeg;
    return { aileronDeg: clamp(aileronDeg, -ailLimit, ailLimit), rollRateCommandRadps: spin ? 0 : pCmd / DEG };
  }
}
