/**
 * F-16 flight-control computer, PROJECT-DESIGNED.
 *
 * The real F-16 FLCS (four-channel digital, g/pitch-rate command, AoA/g limiter, roll-rate
 * command, ARI and yaw damper) is documented in structure in the flight manual family, but its
 * gains and schedules are not public. The control laws below follow that documented structure
 * with gains designed for this provisional aero dataset. They are NOT the F-16 OFP and must not
 * be described as such. Sensor inputs are ideal onboard measurements (no sensor models yet).
 */
import { F16_ACTUATORS, F16_FLCS_LIMITS } from "./F16Data.js";
import type { SurfaceDeflections } from "./F16FlightModel.js";

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
  readonly alphaRad: number;
  readonly betaRad: number;
  /** Body rates p, q, r (rad/s). */
  readonly ratesRadps: readonly [number, number, number];
  readonly dynamicPressurePa: number;
  readonly trueAirspeedMps: number;
  readonly pitchRad: number;
  readonly rollRad: number;
}

export interface FlcsOutput {
  readonly commands: SurfaceDeflections;
  readonly nzCommandG: number;
  readonly rollRateCommandRadps: number;
  /** True while the AoA limiter is reducing the pilot's g command. */
  readonly alphaLimiting: boolean;
}

const DEG = 180 / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Project-designed gains (see file header). */
export const F16_FLCS_GAINS = Object.freeze({
  referenceDynamicPressurePa: 20_000,
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
  overGLeadS: 0.15,
  rollProportionalDegPerRadps: 6,
  /**
   * Roll feedforward: flaperon degrees per rad/s of commanded roll rate at 1 m/s true airspeed
   * (divided by TAS). Steady roll rate per degree of roll control is Clδ·2V/(b·|Clp|); with the
   * TP-1538 tables (Clδ ≈ 0.0025/deg combined roll control, Clp ≈ −0.35 at low α) that is
   * ≈ 0.0016·V rad/s per degree, so δ ≈ 640/V per rad/s. Removes the steady error of a
   * proportional-only roll loop at high speed.
   */
  rollFeedforwardDegMpsPerRadps: 560,
  /** Integral on roll-rate error, so small aerodynamic asymmetries do not cause a steady roll drift. */
  rollIntegralDegPerRad: 12,
  yawRateDampingDegPerRadps: 25,
  sideslipDegPerDeg: 4,
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
  rollLimitMinDegS: 80,
  /** Aileron–rudder interconnect: rudder deg per (aileron deg × alpha rad). */
  ariGain: 2.5,
  /** Stability-axis roll: rudder per rad/s of yaw-rate error from r = p·tanα (rolls about the velocity vector). */
  stabilityAxisRollDegPerRadps: 70,
  /** Yaw-damper washout time constant (s): steady turn rate is not opposed. */
  yawDamperWashoutS: 1.0,
  /** Pedal authority fades between these alphas. */
  pedalFadeStartDeg: 20,
  pedalFadeEndDeg: 30,
  scheduleMin: 0.25,
  scheduleMax: 4
});

export class F16FlightControls {
  /** Integrated g error, held directly as stabilator degrees (so q-scheduling cannot change it). */
  private pitchIntegralDeg = 0;
  private filteredNzCmd = 1;
  private rollIntegral = 0;
  private lastNz = 1;
  private lastElevatorDeg = 0;
  private lastAlpha = Number.NaN;
  private alphaRate = 0;
  private yawRateLowPass = 0;

  public reset(): void {
    this.pitchIntegralDeg = 0;
    this.filteredNzCmd = 1;
    this.rollIntegral = 0;
    this.lastNz = 1;
    this.lastElevatorDeg = 0;
    this.lastAlpha = Number.NaN;
    this.alphaRate = 0;
    this.yawRateLowPass = 0;
  }

  public step(pilot: PilotInputs, s: FlcsSensors, dt: number): FlcsOutput {
    const g = F16_FLCS_GAINS, lim = F16_FLCS_LIMITS;
    const schedule = clamp(g.referenceDynamicPressurePa / Math.max(1, s.dynamicPressurePa), g.scheduleMin, g.scheduleMax);
    const [p, q, r] = s.ratesRadps;

    // Pitch: g command. Stick neutral holds the 1-g flight-path value (attitude compensated).
    const neutral = Math.cos(s.pitchRad) / Math.max(0.5, Math.cos(s.rollRad));
    const stick = clamp(pilot.pitch, -1, 1);
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
    const unsaturated = (-g.pitchProportionalDegPerG * error + g.pitchRateDampingDegPerRadps * q) * schedule + g.overGDegPerG * overG + backstopDeg + this.pitchIntegralDeg;
    // Integrator in stabilator degrees, limited to the stabilator travel. Anti-windup: it does not
    // integrate further into saturation, and it bleeds off while the backstop or over-g act.
    if (backstopDeg > 0 || overG > 0) {
      this.pitchIntegralDeg *= Math.exp(-dt / 0.3);
    } else if (Math.abs(unsaturated) < elevLimit || Math.sign(unsaturated) !== -Math.sign(error)) {
      this.pitchIntegralDeg = clamp(this.pitchIntegralDeg - g.pitchIntegralDegPerGs * error * Math.pow(schedule, g.pitchIntegralScheduleExponent) * dt, -elevLimit, elevLimit);
    }
    const elevatorDeg = clamp(unsaturated, -elevLimit, elevLimit);
    this.lastElevatorDeg = elevatorDeg;

    // Roll: roll-rate command. Source convention: negative aileron rolls right.
    // TP-1538 roll-rate limiting (q, alpha and nose-down stabilator; positive elevator = nose down).
    const pMaxDegS = Math.max(g.rollLimitMinDegS, lim.maxRollRateDegS.value
      - g.rollLimitPerPaDegS * Math.max(0, g.rollLimitQBreakPa - s.dynamicPressurePa)
      - g.rollLimitPerAlphaDegS * Math.max(0, s.alphaRad * DEG - g.rollLimitAlphaOnsetDeg)
      - g.rollLimitPerStabDegS * Math.max(0, this.lastElevatorDeg - g.rollLimitStabOnsetDeg));
    const pCmd = clamp(pilot.roll, -1, 1) * pMaxDegS / DEG;
    const ailLimit = F16_ACTUATORS.aileronLimitDeg.value;
    const rollError = pCmd - p;
    const feedforward = (g.rollFeedforwardDegMpsPerRadps / Math.max(50, s.trueAirspeedMps)) * pCmd;
    const ailUnsat = -feedforward - (g.rollProportionalDegPerRadps * rollError + g.rollIntegralDegPerRad * this.rollIntegral) * schedule;
    // The integrator only trims out small steady asymmetries (stick centred AND nearly steady); during
    // a roll or its stop it bleeds off, so it cannot wind up and roll the jet back on release.
    if (Math.abs(pilot.roll) < 0.05 && Math.abs(p) < 5 / DEG && Math.abs(ailUnsat) < ailLimit) this.rollIntegral = clamp(this.rollIntegral + rollError * dt, -0.5, 0.5);
    else this.rollIntegral *= Math.exp(-dt / 0.3);
    const aileronDeg = clamp(ailUnsat, -ailLimit, ailLimit);

    // Yaw: pedal command plus yaw damper and sideslip feedback. Negative rudder yaws nose right.
    // Yaw damper acts on washed-out yaw rate; ARI coordinates rolls at AoA; pedals fade at high AoA.
    this.yawRateLowPass += (r - this.yawRateLowPass) * (1 - Math.exp(-dt / g.yawDamperWashoutS));
    const rWashed = r - this.yawRateLowPass;
    const pedalFade = 1 - clamp((s.alphaRad * DEG - g.pedalFadeStartDeg) / (g.pedalFadeEndDeg - g.pedalFadeStartDeg), 0, 1);
    const ari = g.ariGain * Math.max(0, s.alphaRad) * aileronDeg;
    // Negative rudder yaws nose right (positive r): drive r toward p·tanα.
    const stabAxis = -g.stabilityAxisRollDegPerRadps * (p * Math.tan(s.alphaRad) - r);
    const rudderDeg = clamp(
      -clamp(pilot.yaw, -1, 1) * pedalFade * F16_ACTUATORS.rudderLimitDeg.value + ari + stabAxis * schedule + (g.yawRateDampingDegPerRadps * rWashed - g.sideslipDegPerDeg * s.betaRad * DEG) * schedule,
      -F16_ACTUATORS.rudderLimitDeg.value, F16_ACTUATORS.rudderLimitDeg.value
    );

    return { commands: { elevatorDeg, aileronDeg, rudderDeg }, nzCommandG: this.filteredNzCmd, rollRateCommandRadps: pCmd, alphaLimiting };
  }
}
