import type { SeededRandom } from "../../core/random/SeededRandom.js";
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import type { SeekerFeatureObservation } from "./SeekerDiscrimination.js";

export const PLANCK_CONSTANT_J_S = 6.62607015e-34;
export const BOLTZMANN_CONSTANT_J_PER_K = 1.380649e-23;
export const STEFAN_BOLTZMANN_CONSTANT_W_M2_K4 = 5.670374419e-8;
export const SPEED_OF_LIGHT_MPS = 299_792_458;

export interface ThermalEmitterState {
  readonly measurementId: string;
  readonly positionWorldM: Vector3;
  readonly velocityWorldMps: Vector3;
  readonly temperatureK: number;
  readonly projectedAreaM2: number;
  readonly emissivity: number;
  readonly temperatureRateKPerSecond: number;
}

export interface ThermalSpectralBand {
  readonly minimumWavelengthM: number;
  readonly maximumWavelengthM: number;
  readonly relativeSensitivity: number;
}

export interface InfraredSeekerOptics {
  readonly apertureAreaM2: number;
  readonly opticalTransmission: number;
  readonly spectralBands: readonly ThermalSpectralBand[];
  readonly detectorNoisePowerW: number;
  readonly minimumSignalPowerW: number;
  readonly angularResolutionRad: number;
}

export interface InfraredPathState {
  readonly rangeM: number;
  readonly atmosphericTransmissionByBand: readonly number[];
  readonly backgroundRadianceWPerM2SrPerM?: readonly number[];
}

export interface InfraredSeekerObservationResult {
  readonly observations: readonly SeekerFeatureObservation[];
  readonly bandSignalPowerW: readonly (readonly number[])[];
  readonly weakestBandSnrDb: number;
}

export interface FlareThermalModel {
  readonly initialTemperatureK: number;
  readonly massKg: number;
  readonly specificHeatJPerKgK: number;
  readonly emittingAreaM2: number;
  readonly emissivity: number;
  readonly convectiveHeatTransferWPerM2K: number;
  readonly chemicalHeatReleaseW: number;
  readonly chemicalBurnDurationSeconds: number;
}

export interface FlareThermalState {
  readonly temperatureK: number;
  readonly elapsedSeconds: number;
  readonly cumulativeRadiatedEnergyJ: number;
}

export interface FlareThermalStep {
  readonly state: FlareThermalState;
  readonly radiatedPowerW: number;
  readonly convectiveLossW: number;
  readonly chemicalInputPowerW: number;
  readonly netCoolingRateKPerSecond: number;
}

export interface ChaffCloudModel {
  readonly initialParticleCount: number;
  readonly particleLengthMeanM: number;
  readonly particleLengthStandardDeviationM: number;
  readonly peakSingleParticleRcsM2: number;
  readonly resonanceFractionalBandwidth: number;
  readonly orientationEfficiency: number;
  readonly initialCloudRadiusM: number;
  readonly turbulentDiffusivityM2PerSecond: number;
  readonly cloudLifetimeSeconds: number;
  readonly windCouplingTimeConstantSeconds: number;
  readonly terminalFallSpeedMps: number;
}

export interface ChaffCloudState {
  readonly positionWorldM: Vector3;
  readonly velocityWorldMps: Vector3;
  readonly ageSeconds: number;
  readonly particleCount: number;
  readonly cloudRadiusM: number;
}

export interface ChaffCloudStepInput {
  readonly deltaTimeSeconds: number;
  readonly windWorldMps: Vector3;
}

export interface ChaffCloudRadarReturn {
  readonly totalRcsM2: number;
  readonly meanParticleRcsM2: number;
  readonly effectiveParticleCount: number;
  readonly rangeRateMps: number;
  readonly cloudRadiusM: number;
  readonly ageSeconds: number;
  readonly visible: boolean;
}

function validateFiniteVector(vector: Vector3, label: string): void {
  if (vector.length !== 3 || !vector.every(Number.isFinite)) {
    throw new RangeError(label + " must contain exactly three finite components.");
  }
}
function add(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function subtract(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function scale(a: Vector3, value: number): Vector3 {
  return [a[0] * value, a[1] * value, a[2] * value];
}
function magnitude(a: Vector3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
function db10(value: number): number {
  return 10 * Math.log10(Math.max(value, Number.MIN_VALUE));
}
function validatePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(label + " must be positive and finite.");
}
function validateFraction(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(label + " must be in [0, 1].");
}

/** Planck spectral radiance in W/(m²·sr·m) at the stated wavelength and temperature. */
export function computeBlackbodySpectralRadiance(
  wavelengthM: number,
  temperatureK: number
): number {
  validatePositive(wavelengthM, "Wavelength");
  validatePositive(temperatureK, "Temperature");
  const exponent = (PLANCK_CONSTANT_J_S * SPEED_OF_LIGHT_MPS) /
    (wavelengthM * BOLTZMANN_CONSTANT_J_PER_K * temperatureK);
  if (exponent > 700) return 0;
  return (2 * PLANCK_CONSTANT_J_S * SPEED_OF_LIGHT_MPS ** 2) /
    (wavelengthM ** 5 * Math.expm1(exponent));
}

/** Integrates a top-hat spectral band using deterministic Simpson quadrature. */
export function integrateBlackbodyBandRadiance(
  minimumWavelengthM: number,
  maximumWavelengthM: number,
  temperatureK: number,
  emissivity = 1,
  integrationIntervals = 48
): number {
  validatePositive(minimumWavelengthM, "Minimum wavelength");
  validatePositive(maximumWavelengthM, "Maximum wavelength");
  validatePositive(temperatureK, "Temperature");
  validateFraction(emissivity, "Emissivity");
  if (maximumWavelengthM <= minimumWavelengthM ||
    !Number.isInteger(integrationIntervals) || integrationIntervals < 2 ||
    integrationIntervals % 2 !== 0) {
    throw new RangeError("Spectral band and Simpson integration intervals are invalid.");
  }
  const width = maximumWavelengthM - minimumWavelengthM;
  const step = width / integrationIntervals;
  let sum = computeBlackbodySpectralRadiance(minimumWavelengthM, temperatureK) +
    computeBlackbodySpectralRadiance(maximumWavelengthM, temperatureK);
  for (let index = 1; index < integrationIntervals; index += 1) {
    const wavelength = minimumWavelengthM + step * index;
    sum += (index % 2 === 0 ? 2 : 4) *
      computeBlackbodySpectralRadiance(wavelength, temperatureK);
  }
  return emissivity * sum * step / 3;
}

/**
 * Advances a single flare thermal lumped-capacitance model. It balances chemical
 * heat input, Stefan-Boltzmann radiation and convection; it does not assume
 * constant flare brightness or an instantaneous binary decoy.
 */
export function stepFlareThermalState(
  previous: FlareThermalState,
  model: FlareThermalModel,
  ambientTemperatureK: number,
  deltaTimeSeconds: number
): FlareThermalStep {
  validatePositive(model.massKg, "Flare mass");
  validatePositive(model.specificHeatJPerKgK, "Flare specific heat");
  validatePositive(model.emittingAreaM2, "Flare emitting area");
  validateFraction(model.emissivity, "Flare emissivity");
  if (![model.initialTemperatureK, model.convectiveHeatTransferWPerM2K,
    model.chemicalHeatReleaseW, model.chemicalBurnDurationSeconds,
    ambientTemperatureK, deltaTimeSeconds, previous.temperatureK,
    previous.elapsedSeconds, previous.cumulativeRadiatedEnergyJ].every(Number.isFinite) ||
    model.initialTemperatureK <= 0 || model.convectiveHeatTransferWPerM2K < 0 ||
    model.chemicalHeatReleaseW < 0 || model.chemicalBurnDurationSeconds < 0 ||
    ambientTemperatureK <= 0 || deltaTimeSeconds <= 0 ||
    previous.temperatureK <= 0 || previous.elapsedSeconds < 0 ||
    previous.cumulativeRadiatedEnergyJ < 0) {
    throw new RangeError("Flare thermal state or model is invalid.");
  }
  const chemicalInputPowerW = previous.elapsedSeconds < model.chemicalBurnDurationSeconds
    ? model.chemicalHeatReleaseW
    : 0;
  const radiatedPowerW = model.emissivity * STEFAN_BOLTZMANN_CONSTANT_W_M2_K4 *
    model.emittingAreaM2 *
    (previous.temperatureK ** 4 - ambientTemperatureK ** 4);
  const convectiveLossW = model.convectiveHeatTransferWPerM2K *
    model.emittingAreaM2 * (previous.temperatureK - ambientTemperatureK);
  const heatCapacityJPerK = model.massKg * model.specificHeatJPerKgK;
  const netCoolingRateKPerSecond = (radiatedPowerW + convectiveLossW -
    chemicalInputPowerW) / heatCapacityJPerK;
  const temperatureK = Math.max(
    ambientTemperatureK,
    previous.temperatureK - netCoolingRateKPerSecond * deltaTimeSeconds
  );
  const state: FlareThermalState = {
    temperatureK,
    elapsedSeconds: previous.elapsedSeconds + deltaTimeSeconds,
    cumulativeRadiatedEnergyJ: previous.cumulativeRadiatedEnergyJ +
      Math.max(0, radiatedPowerW) * deltaTimeSeconds
  };
  return {
    state,
    radiatedPowerW: Math.max(0, radiatedPowerW),
    convectiveLossW: Math.max(0, convectiveLossW),
    chemicalInputPowerW,
    netCoolingRateKPerSecond
  };
}

/** Creates an initial thermally active flare state using its declared material profile. */
export function createFlareThermalState(model: FlareThermalModel): FlareThermalState {
  validatePositive(model.initialTemperatureK, "Initial flare temperature");
  return {
    temperatureK: model.initialTemperatureK,
    elapsedSeconds: 0,
    cumulativeRadiatedEnergyJ: 0
  };
}

/**
 * Converts thermal emitters into sensor observations using band-integrated
 * blackbody radiance, aperture/optics, range, atmosphere, band response and noise.
 * The output carries only sensor measurements and numeric features, never a
 * target/flare entity classification.
 */
export function observeInfraredEmitters(
  emitters: readonly ThermalEmitterState[],
  optics: InfraredSeekerOptics,
  paths: readonly InfraredPathState[],
  acquiredAtSeconds: number
): InfraredSeekerObservationResult {
  validatePositive(optics.apertureAreaM2, "Seeker aperture area");
  validateFraction(optics.opticalTransmission, "Optical transmission");
  validatePositive(optics.detectorNoisePowerW, "Detector noise power");
  validatePositive(optics.minimumSignalPowerW, "Minimum signal power");
  validatePositive(optics.angularResolutionRad, "Angular resolution");
  if (!Number.isFinite(acquiredAtSeconds) || acquiredAtSeconds < 0 ||
    optics.spectralBands.length < 2 || paths.length !== emitters.length) {
    throw new RangeError("Infrared seeker observation setup is invalid.");
  }
  for (const band of optics.spectralBands) {
    if (![band.minimumWavelengthM, band.maximumWavelengthM,
      band.relativeSensitivity].every(Number.isFinite) ||
      band.minimumWavelengthM <= 0 || band.maximumWavelengthM <= band.minimumWavelengthM ||
      band.relativeSensitivity < 0) {
      throw new RangeError("Infrared spectral band configuration is invalid.");
    }
  }

  const bandSignalPowerW: number[][] = [];
  const observations: SeekerFeatureObservation[] = [];
  let weakestBandSnrDb = Infinity;
  for (let emitterIndex = 0; emitterIndex < emitters.length; emitterIndex += 1) {
    const emitter = emitters[emitterIndex]!;
    const path = paths[emitterIndex]!;
    validateFiniteVector(emitter.positionWorldM, "Thermal emitter position");
    validateFiniteVector(emitter.velocityWorldMps, "Thermal emitter velocity");
    validatePositive(emitter.temperatureK, "Emitter temperature");
    validatePositive(emitter.projectedAreaM2, "Emitter projected area");
    validateFraction(emitter.emissivity, "Emitter emissivity");
    validatePositive(path.rangeM, "Infrared path range");
    if (path.atmosphericTransmissionByBand.length !== optics.spectralBands.length ||
      (path.backgroundRadianceWPerM2SrPerM &&
        path.backgroundRadianceWPerM2SrPerM.length !== optics.spectralBands.length)) {
      throw new RangeError("Infrared path must supply one atmospheric value per sensor band.");
    }
    const powers: number[] = [];
    const snrs: number[] = [];
    const bandRadiances: number[] = [];
    const bandBackground: number[] = [];
    for (let bandIndex = 0; bandIndex < optics.spectralBands.length; bandIndex += 1) {
      const band = optics.spectralBands[bandIndex]!;
      const transmission = path.atmosphericTransmissionByBand[bandIndex]!;
      validateFraction(transmission, "Atmospheric band transmission");
      const radiance = integrateBlackbodyBandRadiance(
        band.minimumWavelengthM,
        band.maximumWavelengthM,
        emitter.temperatureK,
        emitter.emissivity
      );
      const background = path.backgroundRadianceWPerM2SrPerM?.[bandIndex] ?? 0;
      if (!Number.isFinite(background) || background < 0) {
        throw new RangeError("Background radiance must be finite and non-negative.");
      }
      const sourcePower = radiance * emitter.projectedAreaM2 / (path.rangeM ** 2) *
        optics.apertureAreaM2 * optics.opticalTransmission *
        transmission * band.relativeSensitivity;
      const backgroundPower = background * optics.apertureAreaM2 *
        optics.opticalTransmission * transmission * band.relativeSensitivity;
      const signalPower = Math.max(0, sourcePower - backgroundPower);
      const snr = signalPower / optics.detectorNoisePowerW;
      powers.push(signalPower);
      snrs.push(snr);
      bandRadiances.push(radiance);
      bandBackground.push(background);
      weakestBandSnrDb = Math.min(weakestBandSnrDb, db10(snr));
    }

    const totalPowerW = powers.reduce((sum, value) => sum + value, 0);
    const angularSizeRad = 2 * Math.atan(Math.sqrt(emitter.projectedAreaM2 / Math.PI) / path.rangeM);
    const featureSignalToNoiseDb = db10(totalPowerW / optics.detectorNoisePowerW);
    const strongest = powers[0]! + powers[1]!;
    const spectralRatio = strongest > 0
      ? (powers[0]! + Number.MIN_VALUE) / (powers[1]! + Number.MIN_VALUE)
      : 0;
    observations.push({
      measurementId: emitter.measurementId,
      azimuthOffBoresightDeg: 0,
      elevationOffBoresightDeg: 0,
      azimuthFromBodyDeg: 0,
      elevationFromBodyDeg: 0,
      rangeM: path.rangeM,
      features: {
        signalToNoiseDb: featureSignalToNoiseDb,
        apparentAngularSizeDeg: angularSizeRad * 180 / Math.PI,
        spectralRatio,
        thermalDecayRatePerSecond: emitter.temperatureRateKPerSecond,
        trackContinuitySeconds: 0
      }
    });
    bandSignalPowerW.push(powers);
    void snrs;
    void bandRadiances;
    void bandBackground;
  }
  return {
    observations,
    bandSignalPowerW,
    weakestBandSnrDb: weakestBandSnrDb === Infinity ? -Infinity : weakestBandSnrDb
  };
}

/** Creates the initial dispersed chaff cloud state after ejection. */
export function createChaffCloudState(
  initialPositionWorldM: Vector3,
  initialVelocityWorldMps: Vector3,
  model: ChaffCloudModel
): ChaffCloudState {
  validateFiniteVector(initialPositionWorldM, "Chaff position");
  validateFiniteVector(initialVelocityWorldMps, "Chaff velocity");
  validatePositive(model.particleLengthMeanM, "Chaff particle length mean");
  validatePositive(model.particleLengthStandardDeviationM, "Chaff particle length deviation");
  validatePositive(model.peakSingleParticleRcsM2, "Chaff single-particle peak RCS");
  validatePositive(model.resonanceFractionalBandwidth, "Chaff resonance bandwidth");
  validateFraction(model.orientationEfficiency, "Chaff orientation efficiency");
  validatePositive(model.initialCloudRadiusM, "Initial chaff cloud radius");
  validatePositive(model.cloudLifetimeSeconds, "Chaff cloud lifetime");
  validatePositive(model.windCouplingTimeConstantSeconds, "Chaff wind coupling time");
  if (!Number.isInteger(model.initialParticleCount) || model.initialParticleCount < 1 ||
    !Number.isFinite(model.turbulentDiffusivityM2PerSecond) || model.turbulentDiffusivityM2PerSecond < 0 ||
    !Number.isFinite(model.terminalFallSpeedMps) || model.terminalFallSpeedMps < 0) {
    throw new RangeError("Chaff particle count, diffusivity or terminal velocity is invalid.");
  }
  return {
    positionWorldM: initialPositionWorldM,
    velocityWorldMps: initialVelocityWorldMps,
    ageSeconds: 0,
    particleCount: model.initialParticleCount,
    cloudRadiusM: model.initialCloudRadiusM
  };
}

/** Advects, disperses and depletes a chaff cloud under wind coupling and gravity. */
export function stepChaffCloud(
  previous: ChaffCloudState,
  model: ChaffCloudModel,
  environment: { readonly windWorldMps: Vector3; readonly gravityMps2: number },
  input: ChaffCloudStepInput
): ChaffCloudState {
  validateFiniteVector(previous.positionWorldM, "Chaff cloud position");
  validateFiniteVector(previous.velocityWorldMps, "Chaff cloud velocity");
  validateFiniteVector(environment.windWorldMps, "Wind");
  validateFiniteVector(input.windWorldMps, "Input wind");
  if (!Number.isFinite(input.deltaTimeSeconds) || input.deltaTimeSeconds <= 0 ||
    !Number.isFinite(environment.gravityMps2) || environment.gravityMps2 < 0 ||
    !Number.isFinite(previous.ageSeconds) || previous.ageSeconds < 0 ||
    !Number.isFinite(previous.particleCount) || previous.particleCount < 0 ||
    !Number.isFinite(previous.cloudRadiusM) || previous.cloudRadiusM <= 0) {
    throw new RangeError("Chaff cloud state or integration interval is invalid.");
  }
  const dt = input.deltaTimeSeconds;
  const wind = input.windWorldMps;
  const coupling = 1 - Math.exp(-dt / model.windCouplingTimeConstantSeconds);
  const windAcceleration = scale(subtract(wind, previous.velocityWorldMps), coupling / dt);
  const acceleration: Vector3 = [
    windAcceleration[0],
    windAcceleration[1],
    windAcceleration[2] - environment.gravityMps2
  ];
  const velocityWorldMps = add(previous.velocityWorldMps, scale(acceleration, dt));
  const positionWorldM = add(previous.positionWorldM,
    add(scale(previous.velocityWorldMps, dt), scale(acceleration, 0.5 * dt * dt)));
  const ageSeconds = previous.ageSeconds + dt;
  const survival = Math.exp(-dt / model.cloudLifetimeSeconds);
  return {
    positionWorldM,
    velocityWorldMps,
    ageSeconds,
    particleCount: previous.particleCount * survival,
    cloudRadiusM: Math.sqrt(previous.cloudRadiusM ** 2 +
      2 * model.turbulentDiffusivityM2PerSecond * ageSeconds)
  };
}

/**
 * Computes an incoherent first-order chaff cloud RCS from a half-wave dipole
 * resonance envelope and the current particle count. Particle response is a
 * configurable empirical profile; it must be calibrated for the real chaff
 * material, length distribution, polarization and radar band.
 */
export function evaluateChaffCloudRadarReturn(
  state: ChaffCloudState,
  model: ChaffCloudModel,
  radarFrequencyHz: number,
  radarToCloudUnitVector: Vector3
): ChaffCloudRadarReturn {
  validatePositive(radarFrequencyHz, "Radar frequency");
  validateFiniteVector(radarToCloudUnitVector, "Radar line of sight");
  const losLength = magnitude(radarToCloudUnitVector);
  if (losLength <= 0) throw new RangeError("Radar line of sight cannot be zero.");
  const losUnit = scale(radarToCloudUnitVector, 1 / losLength);
  const wavelengthM = SPEED_OF_LIGHT_MPS / radarFrequencyHz;
  const resonantLengthM = wavelengthM / 2;
  const lengthError = (resonantLengthM - model.particleLengthMeanM) /
    model.particleLengthStandardDeviationM;
  const resonance = Math.exp(-0.5 * lengthError * lengthError /
    (model.resonanceFractionalBandwidth ** 2));
  const particleRcsM2 = model.peakSingleParticleRcsM2 * resonance *
    model.orientationEfficiency;
  const decay = Math.exp(-state.ageSeconds / model.cloudLifetimeSeconds);
  const effectiveParticleCount = Math.max(0, Math.min(
    state.particleCount,
    model.initialParticleCount * decay
  ));
  const totalRcsM2 = particleRcsM2 * effectiveParticleCount;
  const rangeRateMps = -dot(state.velocityWorldMps, losUnit);
  return {
    totalRcsM2,
    meanParticleRcsM2: particleRcsM2,
    effectiveParticleCount,
    rangeRateMps,
    cloudRadiusM: state.cloudRadiusM,
    ageSeconds: state.ageSeconds,
    visible: totalRcsM2 > 0 && effectiveParticleCount >= 1
  };
}

/** Samples a small zero-mean thermal fluctuation using the deterministic game random stream. */
export function applyThermalMeasurementNoise(
  temperatureK: number,
  standardDeviationK: number,
  random: SeededRandom
): number {
  validatePositive(temperatureK, "Temperature");
  if (!Number.isFinite(standardDeviationK) || standardDeviationK < 0) {
    throw new RangeError("Thermal measurement standard deviation must be non-negative.");
  }
  const first = Math.max(Number.MIN_VALUE, 1 - random.nextFloat());
  const second = random.nextFloat();
  const gaussian = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  return Math.max(0, temperatureK + standardDeviationK * gaussian);
}
