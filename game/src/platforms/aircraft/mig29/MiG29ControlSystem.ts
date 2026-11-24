/**
 * MiG-29 flight controls — mechanical linkage with SAU stability augmentation, NOT fly-by-wire.
 * Architecture per the GAF T.O. 1F-MIG29-1 description (mechanical controls, artificial feel,
 * electro-hydraulic SAU dampers, AoA limiting); every gain and schedule is ESTIMATED.
 *
 *  - Pitch: stick → stabilator through a gearing that reduces with dynamic pressure (stick
 *    displacement commands surface angle, not g); SAU pitch-rate damper; stick-pusher-type AoA
 *    limiting above the onset; automatic trim (stand-in for the trim button) nulls pitch rate
 *    when the stick is centred.
 *  - Roll: stick → ailerons/differential stabilators with q̄-reduced gearing; SAU roll damper.
 *  - Yaw: pedals → rudders; SAU yaw damper and a small aileron–rudder interconnect at AoA.
 * Surface conventions (this package): elevator + nose down, aileron + roll right, rudder + nose left.
 */
import type { FlightControlSystem } from "../common/AircraftDefinition.js";
import { MIG29_CONTROLS as K } from "./MiG29Data.js";

const DEG = 180 / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Gearing falls from its low-q̄ value to 35 % at 60 kPa (estimated). */
const gearing = (lowQ: number, q: number) => lowQ * (1 - 0.65 * clamp((q - 10_000) / 50_000, 0, 1));

export type SauMode = "ON" | "OFF";

export function mig29ControlSystem(): FlightControlSystem & { setSau(mode: SauMode): void; setSpeedbrake(out: boolean): void } {
  let sau: SauMode = "ON";
  let speedbrake = false;
  let trim = 0;
  return {
    reset: () => { trim = 0; },
    mode: () => `SAU ${sau}`,
    setSau: (m) => { sau = m; },
    setSpeedbrake: (out) => { speedbrake = out; },
    step: (pilot, s, _surfaces, dt) => {
      const [p, q, r] = s.ratesRadps.map((x) => x * DEG) as [number, number, number];
      const alpha = s.alphaRad * DEG;
      const damp = sau === "ON" ? 1 : 0;
      // Automatic trim: hands-off, drive pitch rate to zero (bounded, slow).
      if (Math.abs(pilot.pitch) < 0.05 && !s.weightOnWheels) trim = clamp(trim + clamp(0.3 * q, -K.autoTrimRateDegS.value, K.autoTrimRateDegS.value) * dt, -10, 10);
      const pusher = Math.max(0, alpha - K.aoaLimiterOnsetDeg.value) * 3;
      const elevator = clamp(-gearing(K.pitchGearingDegAtLowQ.value, s.dynamicPressurePa) * pilot.pitch + trim + damp * K.pitchDamperDegPerDegS.value * q + pusher, -K.stabilatorLimitDeg.value, K.stabilatorLimitDeg.value);
      const aileron = clamp(gearing(K.aileronLimitDeg.value, s.dynamicPressurePa) * pilot.roll - damp * K.rollDamperDegPerDegS.value * p, -K.aileronLimitDeg.value, K.aileronLimitDeg.value);
      const ari = -0.3 * aileron * Math.max(0, s.alphaRad);
      const rudder = clamp(-K.rudderLimitDeg.value * pilot.yaw + damp * K.yawDamperDegPerDegS.value * r * clamp(s.dynamicPressurePa / 20_000, 0.2, 1) + ari, -K.rudderLimitDeg.value, K.rudderLimitDeg.value);
      return {
        mode: `SAU ${sau}`,
        annunciations: [...(sau === "OFF" ? ["SAU OFF (TEST)"] : []), ...(pusher > 0 ? ["AOA LIMIT"] : [])],
        commands: { elevator, aileron, rudder, speedbrake: speedbrake ? 60 : 0 }
      };
    }
  };
}
