import type { SeededRandom } from "../../core/random/SeededRandom.js";
import {
  computeAtmosphericPathTransmission,
  evaluateTerrainLineOfSight,
  type AtmosphericPathRequest,
  type TerrainLineOfSightRequest
} from "./RadarPropagation.js";

export const SPEED_OF_LIGHT_MPS = 299_792_458;
export const BOLTZMANN_CONSTANT_J_PER_K = 1.380649e-23;

export type SwerlingModel = "swerling-0" | "swerling-1" | "swerling-3";

export interface AntennaPatternProfile {
  readonly peakGainDb: number;
  readonly horizontalHalfPowerBeamwidthDeg: number;
  readonly verticalHalfPowerBeamwidthDeg: number;
  readonly firstSidelobeLevelDb: number;
  readonly sidelobeFloorDb: number;
  readonly backlobeLevelDb: number;
}

export interface RcsAspectSample {
  readonly aspectDeg: number;
  readonly rcsM2: number;
}

export interface MonostaticRadarLink {
  readonly transmitPowerW: number;
  readonly transmitGainDb: number;
  readonly receiveGainDb: number;
  readonly frequencyHz: number;
  readonly rcsM2: number;
  readonly rangeM: number;
  /** One-way power transmission factor. The monostatic return traverses it twice. */
  readonly oneWayPathTransmission?: number;
  /** Combined hardware, polarization and implementation loss, as a linear ratio >= 1. */
  readonly systemLossLinear?: number;
}

export interface RadarEchoPower {
  readonly receivedPowerW: number;
  readonly wavelengthM: number;
  readonly roundTripTimeSeconds: number;
  readonly freeSpacePathLossDb: number;
}

export interface PhysicalRadarEchoRequest {
  readonly transmitPowerW: number;
  readonly frequencyHz: number;
  readonly antenna: AntennaPatternProfile;
  readonly targetRcsByAspect: readonly RcsAspectSample[];
  readonly targetAspectDeg: number;
  readonly rangeM: number;
  /** Positive range rate is receding. */
  readonly rangeRateMps: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly beamAzimuthDeg: number;
  readonly beamElevationDeg: number;
  readonly oneWayPathTransmission?: number;
  readonly systemLossLinear?: number;
  readonly swerlingModel?: SwerlingModel;
  readonly random?: SeededRandom;
}

export interface PhysicalRadarEcho {
  /** No entity ID is carried across the RF measurement boundary. */
  readonly rangeM: number;
  readonly rangeRateMps: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly receivedPowerW: number;
  readonly meanRcsM2: number;
  readonly sampledRcsM2: number;
  readonly roundTripTimeSeconds: number;
  readonly dopplerHz: number;
  readonly wavelengthM: number;
  readonly freeSpacePathLossDb: number;
}

export interface RadarJammerEmission {
  readonly transmitPowerW: number;
  readonly transmitGainDb: number;
  readonly centerFrequencyHz: number;
  readonly bandwidthHz: number;
  readonly rangeM: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly oneWayPathTransmission?: number;
}

export interface RadarInterferenceRequest {
  readonly receiverCenterFrequencyHz: number;
  readonly receiverBandwidthHz: number;
  readonly receiverAntenna: AntennaPatternProfile;
  readonly receiverBeamAzimuthDeg: number;
  readonly receiverBeamElevationDeg: number;
  readonly receiverSystemLossLinear?: number;
  readonly jammers: readonly RadarJammerEmission[];
}

export interface RadarInterferenceResult {
  readonly totalReceivedPowerW: number;
  readonly contributions: readonly {
    readonly receivedPowerW: number;
    readonly spectralOverlapFraction: number;
  }[];
}

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(name + " must be finite and greater than zero.");
  }
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(name + " must be finite and non-negative.");
  }
}

function toLinearPowerGain(gainDb: number): number {
  if (!Number.isFinite(gainDb)) throw new RangeError("Gain must be finite.");
  return 10 ** (gainDb / 10);
}

function wrapAspectDeg(aspectDeg: number): number {
  if (!Number.isFinite(aspectDeg)) throw new RangeError("Aspect angle must be finite.");
  const wrapped = ((aspectDeg % 360) + 360) % 360;
  return wrapped > 180 ? 360 - wrapped : wrapped;
}

/**
 * Smooth engineering approximation for a directional aperture pattern.
 * It resolves the main lobe, a configurable first sidelobe envelope, a
 * sidelobe floor and a rear-hemisphere level. It is not a full-wave EM solver.
 */
export function evaluateAntennaGainDb(
  profile: AntennaPatternProfile,
  azimuthOffAxisDeg: number,
  elevationOffAxisDeg: number
): number {
  assertFinitePositive(profile.horizontalHalfPowerBeamwidthDeg, "Horizontal beamwidth");
  assertFinitePositive(profile.verticalHalfPowerBeamwidthDeg, "Vertical beamwidth");
  if (![profile.peakGainDb, profile.firstSidelobeLevelDb, profile.sidelobeFloorDb,
    profile.backlobeLevelDb, azimuthOffAxisDeg, elevationOffAxisDeg].every(Number.isFinite)) {
    throw new RangeError("Antenna pattern values and angles must be finite.");
  }
  if (profile.firstSidelobeLevelDb > 0 || profile.sidelobeFloorDb > 0 || profile.backlobeLevelDb > 0) {
    throw new RangeError("Sidelobe and backlobe levels must be non-positive relative to peak gain.");
  }

  const az = Math.abs(azimuthOffAxisDeg);
  const el = Math.abs(elevationOffAxisDeg);
  if (az > 90 || el > 90) return profile.peakGainDb + profile.backlobeLevelDb;

  const normalizedOffset = Math.hypot(
    az / (profile.horizontalHalfPowerBeamwidthDeg / 2),
    el / (profile.verticalHalfPowerBeamwidthDeg / 2)
  );
  const mainLobeDb = -12 * normalizedOffset * normalizedOffset;
  const sidelobePosition = normalizedOffset - 1.5;
  const firstSidelobeDb = profile.firstSidelobeLevelDb - 18 * sidelobePosition * sidelobePosition;
  const relativeGainDb = Math.max(mainLobeDb, firstSidelobeDb, profile.sidelobeFloorDb);
  return profile.peakGainDb + relativeGainDb;
}

/** Interpolates an aspect table using folded nose-to-tail aspect (0..180 degrees). */
export function evaluateAspectRcsM2(
  samples: readonly RcsAspectSample[],
  aspectDeg: number
): number {
  if (samples.length === 0) throw new RangeError("At least one RCS aspect sample is required.");
  const aspect = wrapAspectDeg(aspectDeg);
  let previousAngle = -Infinity;
  for (const sample of samples) {
    if (!Number.isFinite(sample.aspectDeg) || sample.aspectDeg < 0 || sample.aspectDeg > 180 ||
      !Number.isFinite(sample.rcsM2) || sample.rcsM2 <= 0 || sample.aspectDeg <= previousAngle) {
      throw new RangeError("RCS samples must be strictly ordered in 0..180 degrees with positive finite area.");
    }
    previousAngle = sample.aspectDeg;
  }
  if (aspect <= samples[0]!.aspectDeg) return samples[0]!.rcsM2;
  const last = samples[samples.length - 1]!;
  if (aspect >= last.aspectDeg) return last.rcsM2;

  for (let index = 1; index < samples.length; index += 1) {
    const upper = samples[index]!;
    const lower = samples[index - 1]!;
    if (aspect <= upper.aspectDeg) {
      const fraction = (aspect - lower.aspectDeg) / (upper.aspectDeg - lower.aspectDeg);
      const lowerLog = Math.log(lower.rcsM2);
      const upperLog = Math.log(upper.rcsM2);
      return Math.exp(lowerLog + (upperLog - lowerLog) * fraction);
    }
  }
  return last.rcsM2;
}

/** Samples target fluctuation power while preserving the configured mean RCS. */
export function sampleSwerlingRcsM2(
  meanRcsM2: number,
  model: SwerlingModel,
  random: SeededRandom
): number {
  assertFinitePositive(meanRcsM2, "Mean RCS");
  if (model === "swerling-0") return meanRcsM2;
  const first = Math.max(Number.MIN_VALUE, 1 - random.nextFloat());
  const exponential1 = -Math.log(first);
  if (model === "swerling-1") return meanRcsM2 * exponential1;
  const second = Math.max(Number.MIN_VALUE, 1 - random.nextFloat());
  const exponential2 = -Math.log(second);
  return meanRcsM2 * (exponential1 + exponential2) / 2;
}

/** Monostatic radar equation with two-way path transmission and explicit system loss. */
export function computeMonostaticEchoPower(link: MonostaticRadarLink): RadarEchoPower {
  assertFinitePositive(link.transmitPowerW, "Transmit power");
  assertFinitePositive(link.frequencyHz, "Frequency");
  assertFinitePositive(link.rcsM2, "RCS");
  assertFinitePositive(link.rangeM, "Range");
  const pathTransmission = link.oneWayPathTransmission ?? 1;
  const systemLoss = link.systemLossLinear ?? 1;
  if (!Number.isFinite(pathTransmission) || pathTransmission < 0 || pathTransmission > 1) {
    throw new RangeError("One-way path transmission must be in [0, 1].");
  }
  if (!Number.isFinite(systemLoss) || systemLoss < 1) {
    throw new RangeError("System loss must be a finite linear ratio >= 1.");
  }

  const wavelengthM = SPEED_OF_LIGHT_MPS / link.frequencyHz;
  const transmitGain = toLinearPowerGain(link.transmitGainDb);
  const receiveGain = toLinearPowerGain(link.receiveGainDb);
  const rangeFourth = link.rangeM ** 4;
  const receivedPowerW = link.transmitPowerW * transmitGain * receiveGain *
    wavelengthM ** 2 * link.rcsM2 * pathTransmission ** 2 /
    (((4 * Math.PI) ** 3) * rangeFourth * systemLoss);
  return {
    receivedPowerW,
    wavelengthM,
    roundTripTimeSeconds: (2 * link.rangeM) / SPEED_OF_LIGHT_MPS,
    freeSpacePathLossDb: 20 * Math.log10((4 * Math.PI * link.rangeM) / wavelengthM)
  };
}

/** Thermal receiver noise kTB including the receiver noise figure. */
export function computeThermalNoisePowerW(
  systemTemperatureK: number,
  receiverBandwidthHz: number,
  noiseFigureDb: number
): number {
  assertFinitePositive(systemTemperatureK, "System temperature");
  assertFinitePositive(receiverBandwidthHz, "Receiver bandwidth");
  if (!Number.isFinite(noiseFigureDb) || noiseFigureDb < 0) {
    throw new RangeError("Noise figure must be finite and non-negative.");
  }
  return BOLTZMANN_CONSTANT_J_PER_K * systemTemperatureK * receiverBandwidthHz *
    10 ** (noiseFigureDb / 10);
}

/** Monostatic Doppler convention: positive range rate (receding) produces negative Doppler. */
export function computeMonostaticDopplerHz(rangeRateMps: number, wavelengthM: number): number {
  if (!Number.isFinite(rangeRateMps)) throw new RangeError("Range rate must be finite.");
  assertFinitePositive(wavelengthM, "Wavelength");
  return (-2 * rangeRateMps) / wavelengthM;
}

/** Two-way propagation delay for a monostatic radar. */
export function computeRoundTripTimeSeconds(rangeM: number): number {
  assertFiniteNonNegative(rangeM, "Range");
  return (2 * rangeM) / SPEED_OF_LIGHT_MPS;
}


function signedAngleDifferenceDeg(angleDeg: number, referenceDeg: number): number {
  let difference = (angleDeg - referenceDeg) % 360;
  if (difference > 180) difference -= 360;
  if (difference < -180) difference += 360;
  return difference;
}

/**
 * Converts an aspect-dependent physical target response into an RF echo.
 * Peak antenna gain and off-axis pattern are both applied in the radar equation;
 * the returned sample contains no target identity.
 */
export function computePhysicalRadarEcho(
  request: PhysicalRadarEchoRequest
): PhysicalRadarEcho {
  if (!Number.isFinite(request.rangeRateMps) ||
    ![request.azimuthDeg, request.elevationDeg, request.beamAzimuthDeg, request.beamElevationDeg].every(Number.isFinite) ||
    request.elevationDeg < -90 || request.elevationDeg > 90 ||
    request.beamElevationDeg < -90 || request.beamElevationDeg > 90) {
    throw new RangeError("Radar echo geometry is invalid.");
  }
  const azimuthOffAxis = signedAngleDifferenceDeg(request.azimuthDeg, request.beamAzimuthDeg);
  const elevationOffAxis = request.elevationDeg - request.beamElevationDeg;
  const gainDb = evaluateAntennaGainDb(request.antenna, azimuthOffAxis, elevationOffAxis);
  const meanRcsM2 = evaluateAspectRcsM2(request.targetRcsByAspect, request.targetAspectDeg);
  const sampledRcsM2 = request.swerlingModel && request.swerlingModel !== "swerling-0"
    ? sampleSwerlingRcsM2(meanRcsM2, request.swerlingModel, requireRandom(request.random))
    : meanRcsM2;
  const link = computeMonostaticEchoPower({
    transmitPowerW: request.transmitPowerW,
    transmitGainDb: gainDb,
    receiveGainDb: gainDb,
    frequencyHz: request.frequencyHz,
    rcsM2: sampledRcsM2,
    rangeM: request.rangeM,
    ...(request.oneWayPathTransmission === undefined ? {} : {
      oneWayPathTransmission: request.oneWayPathTransmission
    }),
    ...(request.systemLossLinear === undefined ? {} : {
      systemLossLinear: request.systemLossLinear
    })
  });
  return {
    rangeM: request.rangeM,
    rangeRateMps: request.rangeRateMps,
    azimuthDeg: request.azimuthDeg,
    elevationDeg: request.elevationDeg,
    receivedPowerW: link.receivedPowerW,
    meanRcsM2,
    sampledRcsM2,
    roundTripTimeSeconds: link.roundTripTimeSeconds,
    dopplerHz: computeMonostaticDopplerHz(request.rangeRateMps, link.wavelengthM),
    wavelengthM: link.wavelengthM,
    freeSpacePathLossDb: link.freeSpacePathLossDb
  };
}

function requireRandom(random: SeededRandom | undefined): SeededRandom {
  if (!random) throw new RangeError("Swerling fluctuation requires an explicit seeded random stream.");
  return random;
}

/**
 * One-way jammer coupling into the radar receiver. It integrates only spectral
 * overlap with the receiver passband and applies the radar's receive antenna
 * pattern, path transmission and receiver loss.
 */
export function computeRadarInterference(
  request: RadarInterferenceRequest
): RadarInterferenceResult {
  assertFinitePositive(request.receiverCenterFrequencyHz, "Receiver center frequency");
  assertFinitePositive(request.receiverBandwidthHz, "Receiver bandwidth");
  const receiverLower = request.receiverCenterFrequencyHz - request.receiverBandwidthHz / 2;
  const receiverUpper = request.receiverCenterFrequencyHz + request.receiverBandwidthHz / 2;
  const systemLoss = request.receiverSystemLossLinear ?? 1;
  if (!Number.isFinite(systemLoss) || systemLoss < 1 ||
    ![request.receiverBeamAzimuthDeg, request.receiverBeamElevationDeg].every(Number.isFinite)) {
    throw new RangeError("Receiver beam geometry or system loss is invalid.");
  }

  const contributions = request.jammers.map((jammer) => {
    assertFinitePositive(jammer.transmitPowerW, "Jammer transmit power");
    assertFinitePositive(jammer.centerFrequencyHz, "Jammer center frequency");
    assertFinitePositive(jammer.bandwidthHz, "Jammer bandwidth");
    assertFinitePositive(jammer.rangeM, "Jammer range");
    if (![jammer.transmitGainDb, jammer.azimuthDeg, jammer.elevationDeg].every(Number.isFinite)) {
      throw new RangeError("Jammer geometry and gain must be finite.");
    }
    const jammerLower = jammer.centerFrequencyHz - jammer.bandwidthHz / 2;
    const jammerUpper = jammer.centerFrequencyHz + jammer.bandwidthHz / 2;
    const overlapHz = Math.max(0, Math.min(receiverUpper, jammerUpper) - Math.max(receiverLower, jammerLower));
    const spectralOverlapFraction = overlapHz / jammer.bandwidthHz;
    const pathTransmission = jammer.oneWayPathTransmission ?? 1;
    if (!Number.isFinite(pathTransmission) || pathTransmission < 0 || pathTransmission > 1) {
      throw new RangeError("Jammer one-way path transmission must be within [0, 1].");
    }
    if (spectralOverlapFraction === 0 || pathTransmission === 0) {
      return { receivedPowerW: 0, spectralOverlapFraction };
    }
    const wavelengthM = SPEED_OF_LIGHT_MPS / jammer.centerFrequencyHz;
    const receiveGainDb = evaluateAntennaGainDb(
      request.receiverAntenna,
      signedAngleDifferenceDeg(jammer.azimuthDeg, request.receiverBeamAzimuthDeg),
      jammer.elevationDeg - request.receiverBeamElevationDeg
    );
    const receivedPowerW = jammer.transmitPowerW * toLinearPowerGain(jammer.transmitGainDb) *
      toLinearPowerGain(receiveGainDb) * wavelengthM ** 2 *
      pathTransmission * spectralOverlapFraction /
      (((4 * Math.PI * jammer.rangeM) ** 2) * systemLoss);
    return { receivedPowerW, spectralOverlapFraction };
  });
  return {
    totalReceivedPowerW: contributions.reduce((sum, item) => sum + item.receivedPowerW, 0),
    contributions
  };
}


export interface EnvironmentCoupledRadarEchoRequest {
  readonly physical: PhysicalRadarEchoRequest;
  readonly terrain: TerrainLineOfSightRequest;
  readonly atmosphere: AtmosphericPathRequest;
}

export interface EnvironmentCoupledRadarEchoResult {
  readonly echo: PhysicalRadarEcho | null;
  readonly terrain: ReturnType<typeof evaluateTerrainLineOfSight>;
  readonly atmosphere: ReturnType<typeof computeAtmosphericPathTransmission>;
  readonly blocked: boolean;
}

/** Applies sampled terrain visibility and one-way environment losses to an RF echo. */
export function computeEnvironmentCoupledRadarEcho(
  request: EnvironmentCoupledRadarEchoRequest
): EnvironmentCoupledRadarEchoResult {
  const terrain = evaluateTerrainLineOfSight(request.terrain);
  const atmosphere = computeAtmosphericPathTransmission(request.atmosphere);
  if (!terrain.geometricallyVisible) {
    return { echo: null, terrain, atmosphere, blocked: true };
  }
  const existingTransmission = request.physical.oneWayPathTransmission ?? 1;
  const combinedTransmission = existingTransmission * atmosphere.oneWayTransmissionFraction;
  const echo = computePhysicalRadarEcho({
    ...request.physical,
    oneWayPathTransmission: combinedTransmission
  });
  return { echo, terrain, atmosphere, blocked: false };
}
