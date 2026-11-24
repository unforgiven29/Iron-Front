/**
 * MiG-29 flight controls — mechanical linkage with feel-control unit and SAU augmentation, NOT
 * fly-by-wire. Architecture and limits from GAF T.O. 1F-MIG29-1 Section 1 (MiG-29G; product 9.13
 * applicability unverified). Gains marked "estimated" in MiG29Data.ts are not published.
 *
 *  - Pitch: stick displacement commands taileron angle (not g). Authority is set by the feel-control
 *    unit (ARU): full 35° up / 15° down, reduced to 17°45' / 5°45' at 470–650 KTAS near the ground,
 *    less reduction with altitude, full authority above 30,000 ft. SAU pitch damper; AoA limiter
 *    "pitch kicker" at 15° (LEF in) or 26° (LEF out), inhibited unless the gear is up.
 *  - Roll: ailerons (authority reduced above 18° AoA) plus ±5° differential tailerons that are
 *    disabled whenever the LEF are extended. SAU roll damper.
 *  - Yaw: rudders ±25°, SAU yaw damper and aileron–rudder interconnect at AoA.
 * Surface conventions (this package): elevator + nose down, aileron + roll right, rudder + nose left.
 */
import type { FlightControlSystem } from "../common/AircraftDefinition.js";
import { MIG29_CONTROLS as K } from "./MiG29Data.js";

const DEG = 180 / Math.PI;
const KT = 1.943844, FT = 0.3048;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ramp = (x: number, a: number, b: number) => clamp((x - a) / (b - a), 0, 1);

/** ISA pressure altitude (ft) from static pressure. */
export const pressureAltitudeFt = (staticPa: number) => (44330.8 * (1 - (staticPa / 101325) ** 0.190263)) / FT;

/**
 * Feel-unit retraction (0 = full authority, 1 = minimum authority). Below 3,000 ft speed-only, as
 * published; between 3,000 and 30,000 ft the manual says only "smaller" — linear fade is an estimate.
 */
export function feelUnitRetraction(ktas: number, altitudeFt: number): number {
  const bySpeed = ramp(ktas, K.feelUnitRetractStartKtas.value, K.feelUnitRetractedKtas.value) * (1 - ramp(ktas, K.feelUnitExtendStartKtas.value, K.feelUnitExtendedKtas.value));
  return bySpeed * (1 - ramp(altitudeFt, K.feelUnitLowAltitudeFt.value, K.feelUnitFullAuthorityFt.value));
}

/** Taileron travel available to the stick: [nose-up, nose-down] degrees. */
export function stabilatorAuthority(ktas: number, altitudeFt: number): readonly [number, number] {
  const f = feelUnitRetraction(ktas, altitudeFt);
  return [
    K.stabilatorNoseUpDeg.value - f * (K.stabilatorNoseUpDeg.value - K.stabilatorMinNoseUpDeg.value),
    K.stabilatorNoseDownDeg.value - f * (K.stabilatorNoseDownDeg.value - K.stabilatorMinNoseDownDeg.value)
  ];
}

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
    step: (pilot, s, surfaces, dt) => {
      const [p, q, r] = s.ratesRadps.map((x) => x * DEG) as [number, number, number];
      const alpha = s.alphaRad * DEG;
      // The SAU/AFCS is shed when the AC bus is on the PTO converter or the DC bus is on batteries
      // (GAF T.O. electrical failure lists); without an electrical installation it is always powered.
      const bus = (id: string) => { const b = s.electricalBuses?.[id]; return b === undefined || (b.powered && !b.shed); };
      const sauPowered = bus("ac") && bus("dc");
      const damp = sau === "ON" && sauPowered ? 1 : 0;
      const lefOut = (surfaces["lef"] ?? 0) > 1;
      const [upAuth, downAuth] = stabilatorAuthority(s.trueAirspeedMps * KT, pressureAltitudeFt(s.staticPressurePa));
      // Automatic trim: hands-off, drive pitch rate to zero, within 80 % of the available authority.
      if (Math.abs(pilot.pitch) < 0.05 && !s.weightOnWheels) {
        trim = clamp(trim + clamp(0.3 * q, -K.autoTrimRateDegS.value, K.autoTrimRateDegS.value) * dt, -K.pitchTrimAuthority.value * upAuth, K.pitchTrimAuthority.value * downAuth);
      }
      // AoA limiter (pitch kicker); the system is inhibited on the ground / gear down (no WOW proxy beyond squat).
      const maxAlpha = lefOut ? K.maxAlphaLefOutDeg.value : K.maxAlphaLefInDeg.value;
      const kicker = s.weightOnWheels ? 0 : Math.max(0, alpha - maxAlpha) * K.kickerGainDegPerDeg.value;
      const stick = pilot.pitch >= 0 ? -upAuth * pilot.pitch : -downAuth * pilot.pitch;
      const elevator = clamp(stick + trim + damp * K.pitchDamperDegPerDegS.value * q + kicker, -upAuth, downAuth);
      // Roll: ailerons (reduced above 18° AoA) + differential tailerons only with LEF retracted.
      const ailAuth = K.aileronLimitDeg.value * (1 - 0.5 * ramp(alpha, K.aileronReductionAlphaDeg.value, K.maxAlphaLefOutDeg.value));
      const rollCmd = clamp(pilot.roll - damp * K.rollDamperDegPerDegS.value * p / K.aileronLimitDeg.value, -1, 1);
      const aileron = ailAuth * rollCmd;
      const differentialStabilator = lefOut ? 0 : K.differentialStabilatorDeg.value * rollCmd;
      const ari = -0.3 * aileron * Math.max(0, s.alphaRad);
      const rudder = clamp(-K.rudderLimitDeg.value * pilot.yaw + damp * K.yawDamperDegPerDegS.value * r * clamp(s.dynamicPressurePa / 20_000, 0.2, 1) + ari, -K.rudderLimitDeg.value, K.rudderLimitDeg.value);
      return {
        mode: `SAU ${sau}`,
        annunciations: [...(sau === "OFF" ? ["SAU OFF (TEST)"] : !sauPowered ? ["SAU OFF (NO POWER)"] : []), ...(kicker > 0 ? ["AOA LIMIT"] : [])],
        commands: { elevator, aileron, differentialStabilator, rudder, speedbrake: speedbrake ? 60 : 0 }
      };
    }
  };
}
