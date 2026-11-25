/**
 * Shared radar physics (owner: physics/radar): target scattering by aspect, the two-way path
 * (antenna pattern, range, atmospheric loss, terrain masking) and the Doppler/clutter geometry of
 * each return. It answers "what physically comes back from this beam", nothing more. Detection,
 * Doppler filtering, thresholds and tracking belong to the radar equipment (game/src/sensors/radar).
 *
 * The world calls `radarEchoes` with its own truth; a radar only ever sees the resulting echoes.
 *
 * Not modelled (stated, not implied): multipath and ground-bounce lobing, rotor/JEM modulation,
 * glint, ducting, rain attenuation, Earth curvature (the simulated world is flat), jamming and chaff.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { angleBetween, dot, norm, scale, sub, sweepRelation, unit } from "../sensing/SweepGeometry.js";
import type { AntennaPattern } from "./Aperture.js";

/**
 * Radar cross-section by aspect, m². Aspect angle 0 = seen from the nose, 180° = from the tail,
 * 90° = beam. Values between table points are interpolated in log space. Elevation aspect blends
 * toward `topBottomM2` as the line of sight leaves the target's wing plane.
 */
export interface RcsModel {
  readonly id: string;
  readonly aspectDeg: readonly number[];
  readonly rcsM2: readonly number[];
  readonly topBottomM2: number;
  /** Swerling case of the target's fluctuation (1: scan-to-scan Rayleigh; 3: one dominant + many). */
  readonly swerling: 1 | 3;
  readonly provenance: string;
}

/** Mean RCS for a line of sight. `losTargetBody` is the direction FROM the radar TO the target, in the target's body (FRD) frame. */
export function aspectRcsM2(model: RcsModel, losTargetBody: Vector3): number {
  // Direction from target toward the radar.
  const toRadar: Vector3 = [-losTargetBody[0], -losTargetBody[1], -losTargetBody[2]];
  const horizontal = Math.hypot(toRadar[0], toRadar[1]);
  const aspect = (Math.atan2(horizontal === 0 ? 0 : Math.abs(toRadar[1]), toRadar[0]) * 180) / Math.PI;
  const { aspectDeg: a, rcsM2: s } = model;
  let inPlane = s[s.length - 1] as number;
  for (let i = 1; i < a.length; i++) {
    if (aspect <= (a[i] as number)) {
      const t = (aspect - (a[i - 1] as number)) / ((a[i] as number) - (a[i - 1] as number));
      inPlane = Math.exp(Math.log(s[i - 1] as number) * (1 - t) + Math.log(s[i] as number) * t);
      break;
    }
  }
  const elev = Math.atan2(Math.abs(toRadar[2]), horizontal); // 0 in the wing plane, π/2 from above/below
  const w = Math.sin(elev) ** 2;
  return Math.exp(Math.log(inPlane) * (1 - w) + Math.log(model.topBottomM2) * w);
}

/** A physical scatterer the world exposes to radar physics (truth; never handed to a sensor). */
export interface RadarScatterer {
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  /** World direction → target body FRD. */
  toBody(v: Vector3): Vector3;
  readonly rcs: RcsModel;
}

/** Transmitter, antenna and receiver state for one look: the radar equation's inputs. */
export interface RadarLook {
  readonly antenna: AntennaPattern;
  readonly peakPowerW: number;
  /** Transmit duty cycle = pulse width × PRF. Average power = peak × duty. */
  readonly dutyCycle: number;
  /** System noise temperature, K (T0·F for a receiver of noise figure F, plus antenna temperature). */
  readonly systemNoiseTempK: number;
  /** Total RF/processing losses (radome, plumbing, filter mismatch, straddle, CFAR...), dB, positive. */
  readonly lossesDb: number;
}

/** What a radar asks of the world for one tick of beam motion. */
export interface RadarBeamQuery {
  readonly originEnuM: Vector3;
  readonly ownVelocityEnuMps: Vector3;
  /** Beam centre at the start and end of the tick (world unit vectors). Equal = staring (track). */
  readonly beamFrom: Vector3;
  readonly beamTo: Vector3;
  readonly look: RadarLook;
  /**
   * Coherent integration time the target gets from this look, s: time on target for a sweep
   * (beamwidth / scan rate), the tick length when staring. Energy on target = Pavg × time.
   */
  readonly integrationTimeS: number;
  /** Echoes weaker than this (linear SNR) are not reported. */
  readonly reportFloorSnr: number;
  readonly maxRangeM: number;
}

const BOLTZMANN = 1.380649e-23;

/**
 * Radar equation, matched-filter SNR of one look (Skolnik, "Radar Handbook", 3rd ed., ch. 1):
 *   SNR = Pavg·G²·g(θ)²·λ²·σ·Tint / ((4π)³·R⁴·k·Ts·L)
 * where G is the antenna's peak gain, g(θ) its one-way relative pattern at the target's offset.
 */
export function radarEquationSnr(look: RadarLook, integrationTimeS: number, rcsM2: number, rangeM: number, offBeamRad: number): number {
  const g = look.antenna.peakGainLinear * look.antenna.gain(offBeamRad);
  const lambda = look.antenna.wavelengthM;
  const pavg = look.peakPowerW * look.dutyCycle;
  const L = 10 ** (look.lossesDb / 10);
  return (pavg * g * g * lambda * lambda * rcsM2 * integrationTimeS) / ((4 * Math.PI) ** 3 * rangeM ** 4 * BOLTZMANN * look.systemNoiseTempK * L);
}

/** One physical return. Geometry is exact; measurement errors are added by the receiver. */
export interface RadarEcho {
  /** Mean (unfluctuated) SNR for this look, linear. */
  readonly meanSnr: number;
  readonly swerling: 1 | 3;
  readonly rangeM: number;
  /** World unit line of sight from the radar. */
  readonly losEnu: Vector3;
  /** Range rate toward the radar, m/s (positive = closing). */
  readonly closureMps: number;
  /** Target's own velocity along the line of sight toward the radar, m/s: its Doppler offset from main-lobe clutter. */
  readonly targetRadialSpeedMps: number;
  /** Angle of the target from the beam centre at its closest approach in this tick, rad. */
  readonly offBeamRad: number;
  /** The beam reaches the ground before (or near) the target: main-lobe clutter in the same cell. */
  readonly lookDown: boolean;
  /** Radar height above the ground, m (clutter strength). */
  readonly radarAglM: number;
}

export interface RadarTerrain {
  /** Ground elevation at an ENU horizontal position, m; NaN when unknown. */
  heightAt(x: number, y: number): number;
}

/** Straight-line terrain masking between two points (samples every ~250 m). */
export function lineOfSightClear(terrain: RadarTerrain | undefined, a: Vector3, b: Vector3): boolean {
  if (!terrain) return true;
  const d = sub(b, a);
  const n = Math.min(200, Math.max(2, Math.ceil(norm(d) / 250)));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const h = terrain.heightAt(a[0] + d[0] * t, a[1] + d[1] * t);
    if (Number.isFinite(h) && a[2] + d[2] * t < h) return false;
  }
  return true;
}

/**
 * Two-way clear-air absorption (oxygen + water vapour), linear. Sea-level one-way specific
 * attenuation ≈ 0.0067·√(f/10 GHz) (O₂) + 0.0035·(f/10 GHz)² (H₂O) dB/km — an approximation of the
 * ITU-R P.676 curve below 20 GHz, falling with density (O₂, 8 km) and humidity (H₂O, 2.1 km).
 */
export function twoWayAtmosphericLoss(wavelengthM: number, rangeM: number, h1: number, h2: number): number {
  const fRatio = 299792458 / wavelengthM / 10e9;
  const hm = Math.max(0, (h1 + h2) / 2);
  const oneWayDbPerKm = 0.0067 * Math.sqrt(fRatio) * Math.exp(-hm / 8000) + 0.0035 * fRatio * fRatio * Math.exp(-hm / 2100);
  return 10 ** ((-2 * oneWayDbPerKm * rangeM) / 1000 / 10);
}

/** Physical returns from every scatterer the beam (main lobe or sidelobes) touched this tick. */
export function radarEchoes(query: RadarBeamQuery, scatterers: readonly RadarScatterer[], terrain?: RadarTerrain): RadarEcho[] {
  const out: RadarEcho[] = [];
  const groundBelow = terrain?.heightAt(query.originEnuM[0], query.originEnuM[1]);
  const radarAglM = Math.max(1, query.originEnuM[2] - (Number.isFinite(groundBelow) ? (groundBelow as number) : 0));
  for (const s of scatterers) {
    const r = sub(s.positionEnuM, query.originEnuM);
    const range = norm(r);
    if (range < 1 || range > query.maxRangeM) continue;
    const los = scale(r, 1 / range);
    const rel = sweepRelation(los, query.beamFrom, query.beamTo);
    if (!rel.crossed) continue;
    const sigma = aspectRcsM2(s.rcs, unit(s.toBody(los)));
    const meanSnr = radarEquationSnr(query.look, query.integrationTimeS, sigma, range, rel.offsetRad) * twoWayAtmosphericLoss(query.look.antenna.wavelengthM, range, query.originEnuM[2], s.positionEnuM[2]);
    if (meanSnr < query.reportFloorSnr) continue;
    if (!lineOfSightClear(terrain, query.originEnuM, s.positionEnuM)) continue;
    const closure = -dot(sub(s.velocityEnuMps, query.ownVelocityEnuMps), los);
    // Look-down: the line of sight descends and meets the ground within ~1.2 target ranges.
    const descent = -los[2];
    const groundRange = descent > 1e-4 ? radarAglM / descent : Infinity;
    out.push({
      meanSnr, swerling: s.rcs.swerling, rangeM: range, losEnu: los, closureMps: closure,
      targetRadialSpeedMps: -dot(s.velocityEnuMps, los), offBeamRad: rel.offsetRad,
      lookDown: groundRange < range * 1.2, radarAglM
    });
  }
  return out;
}

/** Angle between the line of sight and a direction, for diagnostics. */
export const losAngle = angleBetween;

/**
 * Ground clutter seen by one look, integrated over the ground plane (owner: physics/radar).
 *
 * The ground below the radar is divided into patches (azimuth × ground range out to `maxRangeM`).
 * Each patch returns σ0·A through the antenna pattern at its angle from the beam (main lobe AND
 * sidelobes), at Doppler 2·v·d/λ. Reflectivity is the constant-γ model σ0 = γ·sin(ψ) plus a
 * near-vertical specular term (the altitude line). γ is a terrain property (farmland ≈ −15 dB;
 * Nathanson, "Radar Design Principles", ch. 7 — order-of-magnitude, ESTIMATED for this terrain).
 *
 * The result is a list of patches; a radar's processor asks how much of that power falls in a
 * given Doppler filter (after folding by its PRF) and range gate. Main-lobe clutter, the altitude
 * line and the sidelobe-clutter band therefore come out of geometry, speed and the antenna.
 */
export interface ClutterPatch {
  /** Doppler relative to the main-lobe (beam-centre) ground Doppler, Hz. */
  readonly relDopplerHz: number;
  readonly rangeM: number;
  /** Clutter-to-noise ratio this patch alone would give over the look's integration time (linear). */
  readonly cnr: number;
}

export interface ClutterQuery {
  readonly originEnuM: Vector3;
  readonly ownVelocityEnuMps: Vector3;
  readonly beamDirection: Vector3;
  readonly look: RadarLook;
  readonly integrationTimeS: number;
  readonly groundHeightM: number;
  readonly gammaDb: number;
  readonly maxRangeM: number;
}

export function groundClutterPatches(q: ClutterQuery): ClutterPatch[] {
  const h = q.originEnuM[2] - q.groundHeightM;
  if (!(h > 1)) return [];
  const lambda = q.look.antenna.wavelengthM;
  const gamma = 10 ** (q.gammaDb / 10);
  const beamDoppler = (2 * dot(q.ownVelocityEnuMps, q.beamDirection)) / lambda;
  const nAz = 72, nR = 48;
  const maxGround = Math.sqrt(Math.max(0, q.maxRangeM ** 2 - h * h));
  const out: ClutterPatch[] = [];
  // Ground range samples: dense near the nadir (altitude line), log-spaced outward.
  const r0 = Math.max(10, h * 0.05);
  for (let i = 0; i < nR; i++) {
    const g0 = i === 0 ? 0 : r0 * (maxGround / r0) ** ((i - 1) / (nR - 1));
    const g1 = r0 * (maxGround / r0) ** (i / (nR - 1));
    if (g1 <= g0) continue;
    const gm = (g0 + g1) / 2;
    const slant = Math.hypot(gm, h);
    const graze = Math.atan2(h, gm);
    // Constant-γ plus specular near vertical (≈ +10 dB at nadir, 5° wide; ESTIMATED).
    const sigma0 = gamma * Math.sin(graze) + 10 * Math.exp(-(((Math.PI / 2 - graze) / (5 * Math.PI / 180)) ** 2));
    const ringArea = Math.PI * (g1 * g1 - g0 * g0);
    for (let j = 0; j < nAz; j++) {
      const az = ((j + 0.5) / nAz) * 2 * Math.PI;
      const d: Vector3 = [(Math.sin(az) * gm) / slant, (Math.cos(az) * gm) / slant, -h / slant];
      const off = angleBetween(d, q.beamDirection);
      const cnr = radarEquationSnr(q.look, q.integrationTimeS, sigma0 * (ringArea / nAz), slant, off);
      if (cnr < 1e-3) continue;
      out.push({ relDopplerHz: (2 * dot(q.ownVelocityEnuMps, d)) / lambda - beamDoppler, rangeM: slant, cnr });
    }
  }
  return out;
}

/**
 * Clutter-to-noise in one Doppler filter (width 1/T) for a given PRF and range gate:
 * Doppler folds modulo the PRF; with `rangeGateM` > 0 only patches in the same ambiguous range
 * cell (range modulo c/2·PRI, within the gate) count.
 */
export function clutterInCell(patches: readonly ClutterPatch[], targetRelDopplerHz: number, prfHz: number, filterHz: number, targetRangeM: number, rangeGateM: number): number {
  const fold = (f: number) => ((f % prfHz) + prfHz) % prfHz;
  const ft = fold(targetRelDopplerHz);
  const ru = 299792458 / (2 * prfHz);
  const rt = ((targetRangeM % ru) + ru) % ru;
  let c = 0;
  for (const p of patches) {
    let df = Math.abs(fold(p.relDopplerHz) - ft);
    df = Math.min(df, prfHz - df);
    if (df > filterHz / 2) continue;
    if (rangeGateM > 0) {
      let dr = Math.abs((((p.rangeM % ru) + ru) % ru) - rt);
      dr = Math.min(dr, ru - dr);
      if (dr > rangeGateM) continue;
    }
    c += p.cnr;
  }
  return c;
}
