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
  pitchProportionalDegPerG: 1.0,
  pitchIntegralDegPerGs: 2.5,
  pitchRateDampingDegPerRadps: 22,
  /** Pilot g-command prefilter time constant (s). */
  commandPrefilterS: 0.3,
  /** Stabilator nose-down per degree of alpha above the limiter onset, and per rad/s of pitch rate there. */
  alphaLimiterDegPerDeg: 1.5,
  alphaLimiterRateDegPerRadps: 20,
  /** Degrees of alpha excess over which the g loop hands over to the limiter. */
  alphaLimiterBlendDeg: 3,
  /** The g-loop integrator freezes this many degrees before the limiter onset. */
  integratorFreezeMarginDeg: 3,
  /** Look-ahead (s) applied to pitch rate in the AoA limiter. */
  alphaLimiterLeadS: 0.6,
  rollProportionalDegPerRadps: 6,
  /** Integral on roll-rate error, so small aerodynamic asymmetries do not cause a steady roll drift. */
  rollIntegralDegPerRad: 12,
  yawRateDampingDegPerRadps: 25,
  sideslipDegPerDeg: 2.0,
  alphaLimiterOnsetMarginDeg: 3,
  /** AoA/g limiter: full g available up to this alpha, falling linearly to 1 g at the alpha limit. */
  gLimiterFadeStartDeg: 15,
  /** Roll-rate authority: full up to this alpha, fading to `rollFadeMinFraction` at the alpha limit. */
  rollFadeStartDeg: 15,
  rollFadeMinFraction: 0.25,
  /** Aileron–rudder interconnect: rudder deg per (aileron deg × alpha rad). */
  ariGain: 1.5,
  /** Stability-axis roll: rudder per rad/s of yaw-rate error from r = p·tanα (rolls about the velocity vector). */
  stabilityAxisRollDegPerRadps: 40,
  /** Yaw-damper washout time constant (s): steady turn rate is not opposed. */
  yawDamperWashoutS: 1.0,
  /** Pedal authority fades between these alphas. */
  pedalFadeStartDeg: 20,
  pedalFadeEndDeg: 30,
  scheduleMin: 0.25,
  scheduleMax: 4
});

export class F16FlightControls {
  private pitchIntegral = 0;
  private filteredNzCmd = 1;
  private rollIntegral = 0;
  private yawRateLowPass = 0;

  public reset(): void {
    this.pitchIntegral = 0;
    this.filteredNzCmd = 1;
    this.rollIntegral = 0;
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
    // AoA/g limiter: available g falls from max at the fade start to 1 g at the alpha limit.
    const alphaNow = s.alphaRad * DEG;
    const fade = clamp((alphaNow - g.gLimiterFadeStartDeg) / (lim.alphaLimitDeg.value - g.gLimiterFadeStartDeg), 0, 1);
    nzCmd = Math.min(nzCmd, lim.maxPositiveG.value - (lim.maxPositiveG.value - 1) * fade);
    this.filteredNzCmd += (nzCmd - this.filteredNzCmd) * (1 - Math.exp(-dt / g.commandPrefilterS));

    // AoA limiter: above the onset, alpha and pitch rate drive the stabilator nose-down directly,
    // and the g-loop integrator is frozen so it cannot fight the limiter.
    const onset = lim.alphaLimitDeg.value - g.alphaLimiterOnsetMarginDeg;
    // Lead: act on alpha predicted a short time ahead from pitch rate, so momentum cannot carry past the limit.
    const excess = (s.alphaRad + g.alphaLimiterLeadS * Math.max(0, q)) * DEG - onset;
    const alphaLimiting = excess > 0;
    const limiterDeg = alphaLimiting ? g.alphaLimiterDegPerDeg * excess + g.alphaLimiterRateDegPerRadps * Math.max(0, q) : 0;

    const error = this.filteredNzCmd - s.nzG;
    const elevLimit = F16_ACTUATORS.elevatorLimitDeg.value;
    // The g loop fades out over the first few degrees of excess so the limiter always wins.
    const gLoopWeight = alphaLimiting ? clamp(1 - excess / g.alphaLimiterBlendDeg, 0, 1) : 1;
    const gLoop = -(g.pitchProportionalDegPerG * error + g.pitchIntegralDegPerGs * this.pitchIntegral) * gLoopWeight;
    const unsaturated = (gLoop + g.pitchRateDampingDegPerRadps * q + limiterDeg) * schedule;
    // Anti-windup: freeze the integrator near the alpha limit or when saturated against the error,
    // and bleed it off while limiting so releasing the limiter cannot dump a stored nose-up command.
    if (alphaLimiting) {
      this.pitchIntegral *= Math.exp(-dt / 0.5);
    } else if (excess < -g.integratorFreezeMarginDeg && (Math.abs(unsaturated) < elevLimit || Math.sign(unsaturated) !== -Math.sign(error))) {
      this.pitchIntegral = clamp(this.pitchIntegral + error * dt, -10, 10);
    }
    const elevatorDeg = clamp(unsaturated, -elevLimit, elevLimit);

    // Roll: roll-rate command. Source convention: negative aileron rolls right.
    const rollFade = 1 - (1 - g.rollFadeMinFraction) * clamp((s.alphaRad * DEG - g.rollFadeStartDeg) / (lim.alphaLimitDeg.value - g.rollFadeStartDeg), 0, 1);
    const pCmd = clamp(pilot.roll, -1, 1) * rollFade * lim.maxRollRateDegS.value / DEG;
    const ailLimit = F16_ACTUATORS.aileronLimitDeg.value;
    const rollError = pCmd - p;
    const ailUnsat = -(g.rollProportionalDegPerRadps * rollError + g.rollIntegralDegPerRad * this.rollIntegral) * schedule;
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
