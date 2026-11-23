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
  pitchRateDampingDegPerRadps: 16,
  /** Pilot g-command prefilter time constant (s). */
  commandPrefilterS: 0.3,
  /** Stabilator nose-down per degree of alpha above the limiter onset, and per rad/s of pitch rate there. */
  alphaLimiterDegPerDeg: 2.5,
  alphaLimiterRateDegPerRadps: 20,
  /** Degrees of alpha excess over which the g loop hands over to the limiter. */
  alphaLimiterBlendDeg: 3,
  /** The g-loop integrator freezes this many degrees before the limiter onset. */
  integratorFreezeMarginDeg: 3,
  /** Look-ahead (s) applied to pitch rate in the AoA limiter. */
  alphaLimiterLeadS: 0.35,
  rollProportionalDegPerRadps: 6,
  yawRateDampingDegPerRadps: 25,
  sideslipDegPerDeg: 1.0,
  alphaLimiterOnsetMarginDeg: 3,
  scheduleMin: 0.25,
  scheduleMax: 4
});

export class F16FlightControls {
  private pitchIntegral = 0;
  private filteredNzCmd = 1;

  public reset(): void {
    this.pitchIntegral = 0;
    this.filteredNzCmd = 1;
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
    const pCmd = clamp(pilot.roll, -1, 1) * lim.maxRollRateDegS.value / DEG;
    const aileronDeg = clamp(-g.rollProportionalDegPerRadps * (pCmd - p) * schedule, -F16_ACTUATORS.aileronLimitDeg.value, F16_ACTUATORS.aileronLimitDeg.value);

    // Yaw: pedal command plus yaw damper and sideslip feedback. Negative rudder yaws nose right.
    const rudderDeg = clamp(
      -clamp(pilot.yaw, -1, 1) * F16_ACTUATORS.rudderLimitDeg.value + (g.yawRateDampingDegPerRadps * r - g.sideslipDegPerDeg * s.betaRad * DEG) * schedule,
      -F16_ACTUATORS.rudderLimitDeg.value, F16_ACTUATORS.rudderLimitDeg.value
    );

    return { commands: { elevatorDeg, aileronDeg, rudderDeg }, nzCommandG: this.filteredNzCmd, rollRateCommandRadps: pCmd, alphaLimiting };
  }
}
