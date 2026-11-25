/**
 * Shared infrared physics (owner: physics/infrared): target radiant intensity in the 3–5 µm
 * band by aspect and engine state, one-way atmospheric transmission along the real path, the
 * background behind the target and the sun's position. It answers "what irradiance arrives at
 * this sensor from inside its field", not whether a sensor detects it.
 *
 * Model (all coefficients ESTIMATED unless a package states otherwise):
 *  - Plume: scales with power (≈ throttle²·⁵ dry) and ×(1 + abGain) in afterburner; seen fully
 *    from the tail and only `frontalPlumeFraction` of it from the nose (the airframe hides it).
 *  - Hot parts (nozzle cavity, turbine face): visible inside a rear cone only.
 *  - Skin: grey body at the adiabatic recovery temperature T·(1 + 0.2·r·M²), band radiance from
 *    a Planck integral, minus the background it hides (contrast can be negative).
 *  - Transmission: Beer–Lambert with water vapour (scale height 2.1 km) and aerosol (1.2 km)
 *    extinction, integrated along the actual slant path.
 * Not modelled: clouds, rain/fog, spectral line structure, plume self-absorption, flares, sun glints.
 */
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { standardAtmosphere } from "../environment/Atmosphere.js";
import { angleBetween, norm, scale, sub, sweepRelation, unit } from "../sensing/SweepGeometry.js";
import { lineOfSightClear, type RadarTerrain } from "../radar/RadarPhysics.js";

export interface IrSignatureModel {
  readonly id: string;
  /** Plume intensity seen from the tail at full dry power (MIL), W/sr, 3–5 µm. */
  readonly plumeMilWsr: number;
  /** Afterburner multiplier on the plume at full afterburner: plume ×(1 + abGain). */
  readonly abGain: number;
  /** Fraction of the plume still visible from the nose (0..1). */
  readonly frontalPlumeFraction: number;
  /** Hot-parts intensity at MIL seen straight up the tail, W/sr. */
  readonly hotPartsMilWsr: number;
  /** Half-angle of the rear cone in which hot parts are visible, deg. */
  readonly hotPartsConeDeg: number;
  /** Projected skin area seen from front/side/top, m². */
  readonly skinAreaM2: { readonly front: number; readonly side: number; readonly top: number };
  readonly skinEmissivity: number;
  readonly provenance: string;
}

export interface IrEmitterState {
  /** Fraction of dry power (0 = idle, 1 = MIL). */
  readonly throttle: number;
  /** Afterburner 0..1. */
  readonly afterburner: number;
  readonly mach: number;
}

const H = 6.62607015e-34, C = 299792458, KB = 1.380649e-23;
/** In-band (3–5 µm) black-body radiance, W/(m²·sr). */
export function bandRadiance(temperatureK: number, fromM = 3e-6, toM = 5e-6): number {
  const n = 24, dl = (toM - fromM) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const l = fromM + (i + 0.5) * dl;
    sum += ((2 * H * C * C) / l ** 5) / Math.expm1((H * C) / (l * KB * temperatureK));
  }
  return sum * dl;
}

/**
 * Radiant intensity contrast, W/sr, of a target seen along `losTargetBody` (radar→target direction
 * in the target's body frame), against a background of radiance `backgroundWm2sr`.
 */
export function radiantIntensityWsr(sig: IrSignatureModel, state: IrEmitterState, losTargetBody: Vector3, altitudeM: number, backgroundWm2sr: number): number {
  const toSensor = unit([-losTargetBody[0], -losTargetBody[1], -losTargetBody[2]]);
  // cosTail = 1 when the sensor is straight behind the target.
  const cosTail = -toSensor[0];
  const thr = Math.min(1, Math.max(0, state.throttle));
  const ab = Math.min(1, Math.max(0, state.afterburner));
  const power = (0.12 + 0.88 * thr ** 2.5) * (1 + sig.abGain * ab);
  const rearVisibility = sig.frontalPlumeFraction + (1 - sig.frontalPlumeFraction) * ((1 + cosTail) / 2) ** 1.5;
  const plume = sig.plumeMilWsr * power * rearVisibility;
  const cone = Math.cos((sig.hotPartsConeDeg * Math.PI) / 180);
  const hot = cosTail > cone ? sig.hotPartsMilWsr * (0.25 + 0.75 * thr ** 2) * ((cosTail - cone) / (1 - cone)) ** 1.5 : 0;
  const atm = standardAtmosphere(Math.min(80000, Math.max(0, altitudeM)));
  const skinT = atm.temperatureK * (1 + 0.2 * 0.85 * state.mach ** 2);
  const area = sig.skinAreaM2.front * Math.abs(toSensor[0]) + sig.skinAreaM2.side * Math.abs(toSensor[1]) + sig.skinAreaM2.top * Math.abs(toSensor[2]);
  const skin = (sig.skinEmissivity * bandRadiance(skinT) - backgroundWm2sr) * area;
  return plume + hot + skin;
}

/** One-way 3–5 µm transmission along a slant path (ESTIMATED extinction coefficients). */
export function pathTransmission(rangeM: number, h1M: number, h2M: number): number {
  const vapourPerM = 0.11e-3, vapourScaleM = 2100;
  const aerosolPerM = 0.06e-3, aerosolScaleM = 1200;
  const integral = (beta: number, scaleH: number) => {
    const a = Math.max(0, h1M), b = Math.max(0, h2M);
    const dh = b - a;
    if (Math.abs(dh) < 1) return beta * Math.exp(-a / scaleH) * rangeM;
    return beta * rangeM * (scaleH / dh) * (Math.exp(-a / scaleH) - Math.exp(-b / scaleH));
  };
  return Math.exp(-(integral(vapourPerM, vapourScaleM) + integral(aerosolPerM, aerosolScaleM)));
}

export type IrBackground = "sky" | "ground";

/**
 * Background radiance behind a line of sight, W/(m²·sr).
 *  - ground: grey body (ε 0.9) at the surface air temperature;
 *  - sky: emission of the air path to space along the line of sight, L(T_air)·(1 − e^−δ), with the
 *    slant optical depth δ from the same vapour/aerosol extinction as `pathTransmission`
 *    (plane-parallel, grazing paths limited to an air mass of ≈35). Bright near the horizon, dark overhead.
 */
export function backgroundRadiance(kind: IrBackground, sensorAltitudeM: number, losElevationRad = 0): number {
  if (kind === "ground") return 0.9 * bandRadiance(288);
  const h = Math.max(0, sensorAltitudeM);
  const vertical = 0.11e-3 * 2100 * Math.exp(-h / 2100) + 0.06e-3 * 1200 * Math.exp(-h / 1200);
  const airMass = 1 / Math.max(Math.sin(Math.max(0, losElevationRad)), 1 / 35);
  const t = standardAtmosphere(Math.min(80000, h)).temperatureK;
  return bandRadiance(t) * (1 - Math.exp(-vertical * airMass));
}

export interface IrSource {
  readonly positionEnuM: Vector3;
  toBody(v: Vector3): Vector3;
  readonly signature: IrSignatureModel;
  readonly state: IrEmitterState;
}

export interface IrFieldQuery {
  readonly originEnuM: Vector3;
  /** Detector field centre at start/end of the tick (world unit vectors); equal = staring. */
  readonly fieldFrom: Vector3;
  readonly fieldTo: Vector3;
  /** Half-size of the instantaneous field across the scan, rad. */
  readonly fieldHalfRad: number;
  readonly maxRangeM: number;
}

export interface IrPoint {
  /** Contrast irradiance at the aperture, W/m² (negative = colder than background). */
  readonly irradianceWm2: number;
  readonly losEnu: Vector3;
  readonly offFieldRad: number;
  readonly background: IrBackground;
  /** Angle between the line of sight and the sun, rad. */
  readonly sunAngleRad: number;
  /** Background radiance behind the target, W/(m²·sr). */
  readonly backgroundWm2sr: number;
  /** Exact range (for laser rangefinding only; a passive sensor must not use it). */
  readonly rangeM: number;
}

/** Point sources inside the detector field this tick. */
export function infraredPoints(query: IrFieldQuery, sources: readonly IrSource[], sunEnu: Vector3, terrain?: RadarTerrain): IrPoint[] {
  const out: IrPoint[] = [];
  for (const s of sources) {
    const r = sub(s.positionEnuM, query.originEnuM);
    const range = norm(r);
    if (range < 1 || range > query.maxRangeM) continue;
    const los = scale(r, 1 / range);
    const rel = sweepRelation(los, query.fieldFrom, query.fieldTo);
    if (!rel.crossed || rel.offsetRad > query.fieldHalfRad) continue;
    if (!lineOfSightClear(terrain, query.originEnuM, s.positionEnuM)) continue;
    // Background: ground when the line of sight continued past the target hits the terrain within ~3x range.
    const beyond: Vector3 = [query.originEnuM[0] + los[0] * range * 3, query.originEnuM[1] + los[1] * range * 3, query.originEnuM[2] + los[2] * range * 3];
    const background: IrBackground = los[2] < 0 && !lineOfSightClear(terrain ?? { heightAt: () => 0 }, s.positionEnuM, beyond) ? "ground" : "sky";
    const bg = backgroundRadiance(background, query.originEnuM[2], Math.asin(Math.max(-1, Math.min(1, los[2]))));
    const intensity = radiantIntensityWsr(s.signature, s.state, unit(s.toBody(los)), s.positionEnuM[2], bg);
    const tau = pathTransmission(range, query.originEnuM[2], s.positionEnuM[2]);
    out.push({ irradianceWm2: (intensity * tau) / range ** 2, losEnu: los, offFieldRad: rel.offsetRad, background, backgroundWm2sr: bg, sunAngleRad: angleBetween(los, sunEnu), rangeM: range });
  }
  return out;
}

