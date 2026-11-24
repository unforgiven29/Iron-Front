/**
 * F-16 FLCS roll channel (PROJECT-DESIGNED gains): roll-rate command with NASA TP-1538 roll-rate
 * limiting, a TAS-scheduled feedforward, proportional feedback and a small trim integrator.
 * Output: roll-control ("aileron") command, deg, source convention (negative rolls right).
 */
import { F16_ACTUATORS, F16_FLCS_LIMITS } from "../F16Data.js";
import { clamp, DEG, type ChannelContext } from "./FlcsTypes.js";

export const ROLL_GAINS = Object.freeze({
  rollProportionalDegPerRadps: 6,
  /**
   * Roll feedforward: flaperon degrees per rad/s of commanded roll rate at 1 m/s true airspeed
   * (divided by TAS). Steady roll rate per degree of roll control is Clδ·2V/(b·|Clp|); with the
   * TP-1538 tables (Clδ ≈ 0.0025/deg combined roll control, Clp ≈ −0.35 at low α) that is
   * ≈ 0.0016·V rad/s per degree, so δ ≈ 640/V per rad/s (tuned to 560 to avoid overshoot).
   */
  rollFeedforwardDegMpsPerRadps: 560,
  /** Integral on roll-rate error, so small aerodynamic asymmetries do not cause a steady roll drift. */
  rollIntegralDegPerRad: 12,
  /**
   * Roll-rate command limiting, NASA TP-1538 (1979) "control system B" (pp. 18–19): the maximum
   * commandable roll rate (308°/s) is reduced by 0.0115 °/s per N/m² of dynamic pressure below
   * 10,500 N/m² (≈250 KIAS), by 4 °/s per degree of alpha above 15°, and by 4 °/s per degree of
   * nose-down stabilator beyond 5°, to no less than 80 °/s. Prevents inertia-coupling departures.
   */
  rollLimitQBreakPa: 10_500,
  rollLimitPerPaDegS: 0.0115,
  rollLimitAlphaOnsetDeg: 15,
  rollLimitPerAlphaDegS: 4,
  rollLimitStabOnsetDeg: 5,
  rollLimitPerStabDegS: 4,
  rollLimitMinDegS: 80
});

export interface RollOutput {
  readonly aileronDeg: number;
  readonly rollRateCommandRadps: number;
}

export class RollChannel {
  private integral = 0;

  public reset(): void {
    this.integral = 0;
  }

  /** `stabilatorDeg` is the pitch channel's current command (positive = nose down), used by the roll limiter. */
  public step(stickRoll: number, stabilatorDeg: number, { sensors: s, schedule, dt }: ChannelContext): RollOutput {
    const g = ROLL_GAINS, lim = F16_FLCS_LIMITS;
    const p = s.ratesRadps[0];
    const pMaxDegS = Math.max(g.rollLimitMinDegS, lim.maxRollRateDegS.value
      - g.rollLimitPerPaDegS * Math.max(0, g.rollLimitQBreakPa - s.dynamicPressurePa)
      - g.rollLimitPerAlphaDegS * Math.max(0, s.alphaRad * DEG - g.rollLimitAlphaOnsetDeg)
      - g.rollLimitPerStabDegS * Math.max(0, stabilatorDeg - g.rollLimitStabOnsetDeg));
    const pCmd = clamp(stickRoll, -1, 1) * pMaxDegS / DEG;
    const ailLimit = F16_ACTUATORS.aileronLimitDeg.value;
    const rollError = pCmd - p;
    const feedforward = (g.rollFeedforwardDegMpsPerRadps / Math.max(50, s.trueAirspeedMps)) * pCmd;
    const unsat = -feedforward - (g.rollProportionalDegPerRadps * rollError + g.rollIntegralDegPerRad * this.integral) * schedule;
    // The integrator only trims out small steady asymmetries (stick centred AND nearly steady); during
    // a roll or its stop it bleeds off, so it cannot wind up and roll the jet back on release.
    if (Math.abs(stickRoll) < 0.05 && Math.abs(p) < 5 / DEG && Math.abs(unsat) < ailLimit) this.integral = clamp(this.integral + rollError * dt, -0.5, 0.5);
    else this.integral *= Math.exp(-dt / 0.3);
    return { aileronDeg: clamp(unsat, -ailLimit, ailLimit), rollRateCommandRadps: pCmd };
  }
}
