/**
 * Standard atmosphere, gravity, wind sampling and local air velocity.
 *
 * Owner: physics/environment. Platform-neutral. Aerodynamics, propulsion, weapons and sensors
 * sample this rather than holding their own atmosphere constants.
 *
 * Reference model: ISO 2533:1975 Standard Atmosphere (identical to ICAO Doc 7488/3 and the
 * U.S. Standard Atmosphere 1976 below 32 km geopotential). Defined constants, not fitted data:
 *   g0 = 9.80665 m/s², R = 287.05287 J/(kg·K), gamma = 1.4, T0 = 288.15 K, p0 = 101325 Pa,
 *   layer base heights 0 / 11 000 / 20 000 / 32 000 m geopotential with lapse rates
 *   -6.5 / 0.0 / +1.0 K/km, Earth radius for the geopotential conversion r0 = 6 356 766 m.
 *
 * Validity envelope: -2 000 m to 32 000 m geopotential. Outside it the sample throws: an
 * unknown atmosphere is not silently extrapolated or set to zero.
 *
 * Non-standard day: an optional temperature offset (ISA + dT) shifts temperature at every height
 * while keeping the standard pressure-height relation. Density and speed of sound follow from
 * the ideal-gas law. Humidity, weather systems and turbulence are not modelled in this slice.
 *
 * Local approximation: altitude = scenario origin altitude (MSL) + ENU z. Earth curvature over
 * the local tangent plane is ignored here and owned by the future world/geodesy slice.
 */
import type { Quaternion, Vector3 } from "../../core/coordinates/CoordinateFrames.js";

export const ISA = Object.freeze({
  g0: 9.80665,
  gasConstant: 287.05287,
  gamma: 1.4,
  earthRadiusM: 6_356_766,
  seaLevelTemperatureK: 288.15,
  seaLevelPressurePa: 101_325,
  minimumGeopotentialM: -2_000,
  maximumGeopotentialM: 32_000
});

/** Layer bases: [base geopotential height m, base temperature K, lapse K/m]. */
const LAYERS: readonly (readonly [number, number, number])[] = [
  [0, 288.15, -0.0065],
  [11_000, 216.65, 0],
  [20_000, 216.65, 0.001]
];

/** Base pressures computed once from the layer definitions, so the profile is continuous by construction. */
const LAYER_BASE_PRESSURE: readonly number[] = (() => {
  const out: number[] = [ISA.seaLevelPressurePa];
  for (let i = 1; i < LAYERS.length; i++) {
    const [h0, t0, lapse] = LAYERS[i - 1] as readonly [number, number, number];
    out.push(pressureInLayer(out[i - 1] as number, t0, lapse, (LAYERS[i] as readonly [number, number, number])[0] - h0));
  }
  return out;
})();

function pressureInLayer(basePressure: number, baseTemperature: number, lapse: number, dh: number): number {
  const gOverR = ISA.g0 / ISA.gasConstant;
  if (lapse === 0) return basePressure * Math.exp((-gOverR * dh) / baseTemperature);
  return basePressure * ((baseTemperature + lapse * dh) / baseTemperature) ** (-gOverR / lapse);
}

export class AtmosphereEnvelopeError extends RangeError {
  constructor(readonly geopotentialAltitudeM: number) {
    super(`Altitude ${geopotentialAltitudeM.toFixed(1)} m geopotential is outside the standard-atmosphere envelope [${ISA.minimumGeopotentialM}, ${ISA.maximumGeopotentialM}] m.`);
    this.name = "AtmosphereEnvelopeError";
  }
}

export function geometricToGeopotential(geometricAltitudeM: number): number {
  return (ISA.earthRadiusM * geometricAltitudeM) / (ISA.earthRadiusM + geometricAltitudeM);
}

/** Gravitational acceleration magnitude at a geometric altitude (inverse-square from g0). */
export function gravityMagnitude(geometricAltitudeM: number): number {
  const r = ISA.earthRadiusM / (ISA.earthRadiusM + geometricAltitudeM);
  return ISA.g0 * r * r;
}

export interface AtmosphereSample {
  readonly geometricAltitudeM: number;
  readonly geopotentialAltitudeM: number;
  readonly temperatureK: number;
  readonly pressurePa: number;
  readonly densityKgM3: number;
  readonly speedOfSoundMps: number;
  /** Model identity and fidelity, carried with every sample. */
  readonly model: "ISO 2533:1975 standard atmosphere";
  readonly temperatureOffsetK: number;
}

export function standardAtmosphere(geometricAltitudeM: number, temperatureOffsetK = 0): AtmosphereSample {
  if (!Number.isFinite(geometricAltitudeM)) throw new RangeError("Altitude must be finite.");
  if (!Number.isFinite(temperatureOffsetK) || Math.abs(temperatureOffsetK) > 60) {
    throw new RangeError(`Temperature offset ${temperatureOffsetK} K is outside the supported ±60 K.`);
  }
  // A 1 µm tolerance absorbs floating-point round-off at the envelope bounds only.
  const raw = geometricToGeopotential(geometricAltitudeM);
  if (raw < ISA.minimumGeopotentialM - 1e-6 || raw > ISA.maximumGeopotentialM + 1e-6) throw new AtmosphereEnvelopeError(raw);
  const h = Math.min(ISA.maximumGeopotentialM, Math.max(ISA.minimumGeopotentialM, raw));
  let i = LAYERS.length - 1;
  while (i > 0 && h < (LAYERS[i] as readonly [number, number, number])[0]) i--;
  const [hb, tb, lapse] = LAYERS[i] as readonly [number, number, number];
  const dh = h - hb;
  const standardTemperature = tb + lapse * dh;
  const pressure = pressureInLayer(LAYER_BASE_PRESSURE[i] as number, tb, lapse, dh);
  const temperature = standardTemperature + temperatureOffsetK;
  return {
    geometricAltitudeM,
    geopotentialAltitudeM: h,
    temperatureK: temperature,
    pressurePa: pressure,
    densityKgM3: pressure / (ISA.gasConstant * temperature),
    speedOfSoundMps: Math.sqrt(ISA.gamma * ISA.gasConstant * temperature),
    model: "ISO 2533:1975 standard atmosphere",
    temperatureOffsetK
  };
}

// ---------------- wind ----------------

/** A wind field returns the air-mass velocity (world ENU, m/s) at a position and simulation time. */
export interface WindField {
  readonly id: string;
  sample(positionEnuM: Vector3, timeSeconds: number): Vector3;
}

export function uniformWind(id: string, velocityEnuMps: Vector3): WindField {
  if (!velocityEnuMps.every(Number.isFinite)) throw new RangeError("Wind velocity must be finite.");
  const v: Vector3 = [velocityEnuMps[0], velocityEnuMps[1], velocityEnuMps[2]];
  return { id, sample: () => v };
}

/**
 * Wind varying with height above the scenario origin, linearly interpolated between layers.
 * Below the lowest or above the highest layer the nearest layer is held (stated, not extrapolated).
 */
export function layeredWind(id: string, layers: readonly { readonly heightM: number; readonly velocityEnuMps: Vector3 }[]): WindField {
  if (layers.length === 0) throw new RangeError("A layered wind needs at least one layer.");
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i] as (typeof layers)[number];
    if (!Number.isFinite(l.heightM) || !l.velocityEnuMps.every(Number.isFinite)) throw new RangeError(`Wind layer ${i} contains non-finite values.`);
    if (i > 0 && l.heightM <= (layers[i - 1] as (typeof layers)[number]).heightM) throw new RangeError("Wind layers must be strictly increasing in height.");
  }
  const copy = layers.map((l) => ({ heightM: l.heightM, v: [...l.velocityEnuMps] as unknown as Vector3 }));
  return {
    id,
    sample: (p) => {
      const z = p[2];
      const first = copy[0] as (typeof copy)[number];
      const last = copy[copy.length - 1] as (typeof copy)[number];
      if (z <= first.heightM) return first.v;
      if (z >= last.heightM) return last.v;
      let i = 1;
      while ((copy[i] as (typeof copy)[number]).heightM < z) i++;
      const a = copy[i - 1] as (typeof copy)[number];
      const b = copy[i] as (typeof copy)[number];
      const t = (z - a.heightM) / (b.heightM - a.heightM);
      return [a.v[0] + (b.v[0] - a.v[0]) * t, a.v[1] + (b.v[1] - a.v[1]) * t, a.v[2] + (b.v[2] - a.v[2]) * t];
    }
  };
}

// ---------------- environment sampling ----------------

export interface EnvironmentConfig {
  /** Altitude of the ENU origin above mean sea level, m. */
  readonly originAltitudeMslM: number;
  readonly temperatureOffsetK: number;
  readonly wind: WindField;
}

export interface EnvironmentSample {
  readonly atmosphere: AtmosphereSample;
  readonly windEnuMps: Vector3;
  /** Gravity acceleration vector, world ENU (straight down in the local tangent plane). */
  readonly gravityEnuMps2: Vector3;
}

export function sampleEnvironment(config: EnvironmentConfig, positionEnuM: Vector3, timeSeconds: number): EnvironmentSample {
  if (!positionEnuM.every(Number.isFinite)) throw new RangeError("Sample position must be finite.");
  const altitude = config.originAltitudeMslM + positionEnuM[2];
  const wind = config.wind.sample(positionEnuM, timeSeconds);
  if (!wind.every(Number.isFinite)) throw new RangeError(`Wind field "${config.wind.id}" returned a non-finite value.`);
  return {
    atmosphere: standardAtmosphere(altitude, config.temperatureOffsetK),
    windEnuMps: wind,
    gravityEnuMps2: [0, 0, -gravityMagnitude(altitude)]
  };
}

export interface LocalAirflow {
  /** Velocity of the body relative to the air mass, world ENU. */
  readonly airVelocityEnuMps: Vector3;
  /** Same, in body FRD. */
  readonly airVelocityBodyMps: Vector3;
  readonly trueAirspeedMps: number;
  readonly machNumber: number;
  readonly dynamicPressurePa: number;
}

function rotate(q: Quaternion, v: Vector3): Vector3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

/**
 * Air-relative velocity of a point. Compute this per surface/element (with that element's own
 * velocity) rather than once per vehicle when rotation or wind gradients matter.
 */
export function localAirflow(velocityEnuMps: Vector3, bodyToWorld: Quaternion, sample: EnvironmentSample): LocalAirflow {
  const rel: Vector3 = [velocityEnuMps[0] - sample.windEnuMps[0], velocityEnuMps[1] - sample.windEnuMps[1], velocityEnuMps[2] - sample.windEnuMps[2]];
  const inverse: Quaternion = [-bodyToWorld[0], -bodyToWorld[1], -bodyToWorld[2], bodyToWorld[3]];
  const tas = Math.hypot(...rel);
  return {
    airVelocityEnuMps: rel,
    airVelocityBodyMps: rotate(inverse, rel),
    trueAirspeedMps: tas,
    machNumber: tas / sample.atmosphere.speedOfSoundMps,
    dynamicPressurePa: 0.5 * sample.atmosphere.densityKgM3 * tas * tas
  };
}
