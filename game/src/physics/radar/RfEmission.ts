/**
 * Direct-path RF interception (owner: physics/radar — the shared RF owner).
 *
 * World emitters (radar transmitters, active missile seekers) publish what they radiate this tick:
 * position, where the antenna points at the start and end of the tick, carrier, pulse timing and an
 * antenna pattern. A passive receiver asks for the signal arriving at its position and gets, per
 * emitter, the power density it would collect with a 0 dBi antenna, the true direction of arrival
 * and the signal's measurable parameters. Nothing else: no emitter identity, owner, mode name or
 * target. The receiver applies its own antennas, noise and processing.
 *
 * Link budget (one-way Friis, free space): P = Pt·Gt(θ)·λ² / ((4πR)²·L), with Gt(θ) a Gaussian
 * main lobe on a flat sidelobe floor. The scan arc inside the tick is sampled so a sweeping beam
 * that crosses the receiver is seen at its peak, with the fraction of the tick spent in the main lobe.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { lineOfSightClear, type RadarTerrain } from "./RadarPhysics.js";

const C = 299_792_458;

export interface RfAntennaPattern {
  /** Main-lobe peak gain, dBi. */
  readonly peakGainDbi: number;
  /** Half-power (−3 dB) full beamwidth, rad. */
  readonly beamwidthRad: number;
  /** Average sidelobe level relative to the peak, dB (negative). */
  readonly sidelobeDb: number;
}

export interface RfEmitter {
  readonly positionEnuM: Vector3;
  /** Antenna pointing at the start and end of this tick (unit ENU). */
  readonly boresightStartEnu: Vector3;
  readonly boresightEndEnu: Vector3;
  readonly pattern: RfAntennaPattern;
  readonly carrierHz: number;
  /** Peak transmitted power, W. */
  readonly peakPowerW: number;
  /** Continuous wave (no pulses). */
  readonly cw: boolean;
  readonly prfHz: number;
  readonly pulseWidthS: number;
  /** False while the transmitter is silent (standby, receive-only). Silent emitters are never returned. */
  readonly radiating: boolean;
}

export interface RfReceiverQuery {
  readonly positionEnuM: Vector3;
  readonly timeS: number;
  readonly dtS: number;
}

export interface RfIntercept {
  /** Power an ideal 0 dBi antenna would collect at the peak of this tick, W. */
  readonly isotropicPowerW: number;
  /** Fraction of the tick the receiver was inside the emitter's main lobe (0..1). */
  readonly mainlobeFraction: number;
  /** True direction of arrival (unit ENU, from the receiver toward the emitter). */
  readonly arrivalEnu: Vector3;
  readonly carrierHz: number;
  readonly cw: boolean;
  readonly prfHz: number;
  readonly pulseWidthS: number;
}

const dot = (a: Vector3, b: Vector3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vector3) => Math.hypot(a[0], a[1], a[2]);

/** Antenna gain (linear) at angle θ off boresight: Gaussian main lobe, flat sidelobe floor. */
export function patternGain(p: RfAntennaPattern, offAxisRad: number): number {
  const main = p.peakGainDbi - 12 * (offAxisRad / p.beamwidthRad) ** 2; // −3 dB at θ = bw/2
  return 10 ** (Math.max(main, p.peakGainDbi + p.sidelobeDb) / 10);
}

/** Received power with a 0 dBi antenna: one-way Friis. */
export function friisPowerW(peakPowerW: number, txGainLinear: number, carrierHz: number, rangeM: number, lossDb = 0): number {
  const lambda = C / carrierHz;
  return (peakPowerW * txGainLinear * lambda * lambda) / ((4 * Math.PI * Math.max(1, rangeM)) ** 2 * 10 ** (lossDb / 10));
}

/** Interceptions of every radiating emitter at a receiver position over one tick. */
export function rfInterceptsAt(query: RfReceiverQuery, emitters: readonly RfEmitter[], terrain?: RadarTerrain, samples = 9): RfIntercept[] {
  const out: RfIntercept[] = [];
  for (const e of emitters) {
    if (!e.radiating || e.peakPowerW <= 0) continue;
    const toRx: Vector3 = [query.positionEnuM[0] - e.positionEnuM[0], query.positionEnuM[1] - e.positionEnuM[1], query.positionEnuM[2] - e.positionEnuM[2]];
    const r = norm(toRx);
    if (r < 1) continue;
    if (terrain && !lineOfSightClear(terrain, e.positionEnuM, query.positionEnuM)) continue;
    const u: Vector3 = [toRx[0] / r, toRx[1] / r, toRx[2] / r];
    let best = 0, inMain = 0;
    for (let i = 0; i < samples; i++) {
      const t = samples === 1 ? 0 : i / (samples - 1);
      const b: Vector3 = [e.boresightStartEnu[0] * (1 - t) + e.boresightEndEnu[0] * t, e.boresightStartEnu[1] * (1 - t) + e.boresightEndEnu[1] * t, e.boresightStartEnu[2] * (1 - t) + e.boresightEndEnu[2] * t];
      const nb = norm(b) || 1;
      const off = Math.acos(Math.max(-1, Math.min(1, dot(b, u) / nb)));
      const g = patternGain(e.pattern, off);
      if (g > best) best = g;
      if (off < e.pattern.beamwidthRad / 2) inMain++;
    }
    out.push({
      isotropicPowerW: friisPowerW(e.peakPowerW, best, e.carrierHz, r, 2),
      mainlobeFraction: inMain / samples,
      arrivalEnu: [-u[0], -u[1], -u[2]],
      carrierHz: e.carrierHz, cw: e.cw, prfHz: e.prfHz, pulseWidthS: e.pulseWidthS
    });
  }
  return out;
}
