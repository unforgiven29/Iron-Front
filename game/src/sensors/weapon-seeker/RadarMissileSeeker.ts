import type { SeededRandom } from "../../core/random/SeededRandom.js";
import {
  BOLTZMANN_CONSTANT_J_PER_K,
  computeMonostaticDopplerHz,
  computePhysicalRadarEcho,
  type AntennaPatternProfile,
  type PhysicalRadarEchoRequest
} from "../../physics/radar/RadarPhysics.js";
import { SPEED_OF_LIGHT_MPS } from "../../physics/radar/RadarPhysics.js";
import type { SeekerFeatureObservation } from "./SeekerDiscrimination.js";

export type RadarMissileSeekerMode = "active" | "semi-active";

export interface RadarMissileSeekerWaveform {
  readonly centerFrequencyHz: number;
  readonly receiverBandwidthHz: number;
  readonly pulseWidthSeconds: number;
  readonly pulseRepetitionFrequencyHz: number;
  readonly coherentProcessingIntervalSeconds: number;
  readonly probabilityOfFalseAlarm: number;
  readonly rangeGateMinimumM: number;
  readonly rangeGateMaximumM: number;
  readonly dopplerGateMaximumMps: number;
}

export interface RadarMissileSeekerReceiver {
  readonly antenna: AntennaPatternProfile;
  readonly systemTemperatureK: number;
  readonly noiseFigureDb: number;
  readonly sensitivityDbm: number;
  readonly minimumDetectionSnrDb: number;
  readonly rangeMeasurementStandardDeviationM: number;
  readonly radialVelocityStandardDeviationMps: number;
  readonly angleMeasurementStandardDeviationDeg: number;
  readonly trackingMemorySeconds: number;
}

export interface ActiveRadarMissileSeekerTransmitter {
  readonly peakPowerW: number;
  readonly systemLossLinear: number;
  readonly oneWayPathTransmission: number;
}

export interface SemiActiveIlluminationState {
  readonly available: boolean;
  readonly illuminatorTransmitPowerW: number;
  readonly illuminatorTransmitGainDb: number;
  readonly illuminatorToTargetRangeM: number;
  readonly illuminatorPathTransmission: number;
  readonly illuminationQuality: number;
}

export interface RadarMissileSeekerCandidate {
  readonly measurementId: string;
  readonly rangeM: number;
  /** Positive radial velocity means the target is receding from the seeker. */
  readonly rangeRateMps: number;
  readonly targetAspectDeg: number;
  readonly targetRcsByAspect: readonly { readonly aspectDeg: number; readonly rcsM2: number }[];
  readonly azimuthOffBoresightDeg: number;
  readonly elevationOffBoresightDeg: number;
  readonly pathTransmission: number;
  readonly angularRateDegPerSecond: number;
  readonly apparentAngularSizeDeg: number;
  readonly thermalSpectralRatio: number;
  readonly thermalDecayRatePerSecond: number;
}

export interface RadarMissileSeekerRequest {
  readonly mode: RadarMissileSeekerMode;
  readonly waveform: RadarMissileSeekerWaveform;
  readonly receiver: RadarMissileSeekerReceiver;
  readonly candidate: RadarMissileSeekerCandidate;
  readonly activeTransmitter?: ActiveRadarMissileSeekerTransmitter;
  readonly semiActiveIllumination?: SemiActiveIlluminationState;
  readonly seekerRangeFromIlluminatorM?: number;
  readonly timeSeconds: number;
  readonly random: SeededRandom;
}

export interface RadarMissileSeekerMeasurement {
  readonly measurement: SeekerFeatureObservation;
  readonly receivedPowerW: number;
  readonly noisePowerW: number;
  readonly snrDb: number;
  readonly detectionThresholdSnrDb: number;
  readonly detectionMarginDb: number;
  readonly rangeResolutionM: number;
  readonly unambiguousRangeM: number;
  readonly radialVelocityResolutionMps: number;
  readonly unambiguousRadialVelocityMps: number;
  readonly measuredRangeM: number;
  readonly measuredRangeRateMps: number;
  readonly measuredDopplerHz: number;
  readonly measuredAzimuthDeg: number;
  readonly measuredElevationDeg: number;
  readonly illuminationQuality: number;
  readonly detection: boolean;
  readonly classificationMeaning: "unvalidated-radar-seeker-measurement";
}

function validateWaveform(waveform: RadarMissileSeekerWaveform): void {
  if (![waveform.centerFrequencyHz, waveform.receiverBandwidthHz,
    waveform.pulseWidthSeconds, waveform.pulseRepetitionFrequencyHz,
    waveform.coherentProcessingIntervalSeconds, waveform.rangeGateMaximumM,
    waveform.dopplerGateMaximumMps].every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isFinite(waveform.rangeGateMinimumM) || waveform.rangeGateMinimumM < 0 ||
    waveform.rangeGateMaximumM <= waveform.rangeGateMinimumM ||
    !Number.isFinite(waveform.probabilityOfFalseAlarm) ||
    waveform.probabilityOfFalseAlarm <= 0 || waveform.probabilityOfFalseAlarm >= 1) {
    throw new RangeError("Radar seeker waveform/gate configuration is invalid.");
  }
}
function gaussian(random: SeededRandom): number {
  const first = Math.max(Number.MIN_VALUE, 1 - random.nextFloat());
  const second = random.nextFloat();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}
function db10(value: number): number {
  return 10 * Math.log10(Math.max(value, Number.MIN_VALUE));
}
function dbm(powerW: number): number {
  return 10 * Math.log10(Math.max(powerW, Number.MIN_VALUE) / 1e-3);
}
function validateReceiver(receiver: RadarMissileSeekerReceiver): void {
  if (!Number.isFinite(receiver.systemTemperatureK) || receiver.systemTemperatureK <= 0 ||
    !Number.isFinite(receiver.noiseFigureDb) || receiver.noiseFigureDb < 0 ||
    !Number.isFinite(receiver.sensitivityDbm) ||
    !Number.isFinite(receiver.minimumDetectionSnrDb) ||
    !Number.isFinite(receiver.rangeMeasurementStandardDeviationM) ||
    receiver.rangeMeasurementStandardDeviationM <= 0 ||
    !Number.isFinite(receiver.radialVelocityStandardDeviationMps) ||
    receiver.radialVelocityStandardDeviationMps <= 0 ||
    !Number.isFinite(receiver.angleMeasurementStandardDeviationDeg) ||
    receiver.angleMeasurementStandardDeviationDeg <= 0 ||
    !Number.isFinite(receiver.trackingMemorySeconds) || receiver.trackingMemorySeconds < 0) {
    throw new RangeError("Radar missile seeker receiver configuration is invalid.");
  }
}
function validateCandidate(candidate: RadarMissileSeekerCandidate): void {
  if (!candidate.measurementId ||
    ![candidate.rangeM, candidate.rangeRateMps, candidate.targetAspectDeg,
      candidate.azimuthOffBoresightDeg, candidate.elevationOffBoresightDeg,
      candidate.pathTransmission, candidate.angularRateDegPerSecond,
      candidate.apparentAngularSizeDeg, candidate.thermalSpectralRatio,
      candidate.thermalDecayRatePerSecond].every(Number.isFinite) ||
    candidate.rangeM <= 0 || candidate.pathTransmission < 0 ||
    candidate.pathTransmission > 1 || candidate.apparentAngularSizeDeg < 0 ||
    candidate.thermalSpectralRatio < 0 || candidate.elevationOffBoresightDeg < -90 ||
    candidate.elevationOffBoresightDeg > 90) {
    throw new RangeError("Radar seeker candidate observation is invalid.");
  }
}

function computeSemiActiveReceivedPower(
  request: RadarMissileSeekerRequest,
  illumination: SemiActiveIlluminationState
): number {
  const candidate = request.candidate;
  const rangeToSeeker = request.seekerRangeFromIlluminatorM ?? candidate.rangeM;
  if (!Number.isFinite(illumination.illuminatorTransmitPowerW) ||
    illumination.illuminatorTransmitPowerW <= 0 ||
    !Number.isFinite(illumination.illuminatorTransmitGainDb) ||
    !Number.isFinite(illumination.illuminatorToTargetRangeM) ||
    illumination.illuminatorToTargetRangeM <= 0 ||
    !Number.isFinite(rangeToSeeker) || rangeToSeeker <= 0 ||
    !Number.isFinite(illumination.illuminatorPathTransmission) ||
    illumination.illuminatorPathTransmission < 0 ||
    illumination.illuminatorPathTransmission > 1 ||
    !Number.isFinite(illumination.illuminationQuality) ||
    illumination.illuminationQuality < 0 || illumination.illuminationQuality > 1) {
    throw new RangeError("Semi-active illumination geometry/resources are invalid.");
  }
  const rcsProfile = candidate.targetRcsByAspect;
  if (rcsProfile.length === 0) throw new RangeError("Semi-active seeker requires an aspect RCS profile.");
  const meanRcs = interpolateRcs(rcsProfile, candidate.targetAspectDeg);
  const wavelengthM = SPEED_OF_LIGHT_MPS / request.waveform.centerFrequencyHz;
  const receiverGainDb = request.receiver.antenna.peakGainDb +
    evaluateReceiverAngularGain(request.receiver.antenna,
      candidate.azimuthOffBoresightDeg, candidate.elevationOffBoresightDeg);
  const receivedPowerW =
    illumination.illuminatorTransmitPowerW *
    10 ** (illumination.illuminatorTransmitGainDb / 10) *
    10 ** (receiverGainDb / 10) *
    wavelengthM ** 2 * meanRcs *
    illumination.illuminatorPathTransmission *
    candidate.pathTransmission *
    illumination.illuminationQuality /
    (((4 * Math.PI) ** 3) *
      illumination.illuminatorToTargetRangeM ** 2 *
      rangeToSeeker ** 2);
  return receivedPowerW;
}
function interpolateRcs(
  profile: readonly { readonly aspectDeg: number; readonly rcsM2: number }[],
  aspectDeg: number
): number {
  if (profile.length === 0) return 0;
  const normalized = ((aspectDeg % 360) + 360) % 360;
  let previous = -Infinity;
  for (const sample of profile) {
    if (!Number.isFinite(sample.aspectDeg) || !Number.isFinite(sample.rcsM2) ||
      sample.aspectDeg <= previous || sample.aspectDeg < 0 ||
      sample.aspectDeg > 180 || sample.rcsM2 <= 0) {
      throw new RangeError("Radar seeker target RCS profile is invalid.");
    }
    previous = sample.aspectDeg;
  }
  const folded = normalized > 180 ? 360 - normalized : normalized;
  if (folded <= profile[0]!.aspectDeg) return profile[0]!.rcsM2;
  if (folded >= profile[profile.length - 1]!.aspectDeg) return profile[profile.length - 1]!.rcsM2;
  for (let index = 1; index < profile.length; index += 1) {
    const lower = profile[index - 1]!;
    const upper = profile[index]!;
    if (folded <= upper.aspectDeg) {
      const fraction = (folded - lower.aspectDeg) / (upper.aspectDeg - lower.aspectDeg);
      return 10 ** (
        Math.log10(lower.rcsM2) +
        (Math.log10(upper.rcsM2) - Math.log10(lower.rcsM2)) * fraction
      );
    }
  }
  return profile[profile.length - 1]!.rcsM2;
}
function evaluateReceiverAngularGain(
  antenna: AntennaPatternProfile,
  azimuthDeg: number,
  elevationDeg: number
): number {
  // Reuse the standard pattern envelope by calculating its loss from peak gain.
  // evaluateAntennaGainDb is imported lazily here through the shared RF module.
  return evaluateAntennaGainDb(antenna, azimuthDeg, elevationDeg) - antenna.peakGainDb;
}

/**
 * Runs one active or semi-active radar seeker measurement. Active mode emits its
 * own RF pulse and can be intercepted by RWR/ESM. Semi-active mode requires an
 * external illuminator and uses the bistatic two-leg equation. Both modes include
 * receiver noise, ambiguity limits, false-alarm threshold and noisy measurements.
 */
export function measureRadarMissileSeeker(
  request: RadarMissileSeekerRequest
): RadarMissileSeekerMeasurement {
  validateWaveform(request.waveform);
  validateReceiver(request.receiver);
  validateCandidate(request.candidate);
  if (!Number.isFinite(request.timeSeconds) || request.timeSeconds < 0) {
    throw new RangeError("Radar missile seeker time is invalid.");
  }
  const wavelengthM = SPEED_OF_LIGHT_MPS / request.waveform.centerFrequencyHz;
  const coherentPulseCount = Math.max(1, Math.floor(
    request.waveform.pulseRepetitionFrequencyHz *
    request.waveform.coherentProcessingIntervalSeconds
  ));
  const activePulseCompressionGain = Math.max(
    1,
    request.waveform.receiverBandwidthHz * request.waveform.pulseWidthSeconds
  );
  const processingGain = activePulseCompressionGain * coherentPulseCount;
  const noisePowerW = BOLTZMANN_CONSTANT_J_PER_K *
    request.receiver.systemTemperatureK * request.waveform.receiverBandwidthHz *
    10 ** (request.receiver.noiseFigureDb / 10);

  let receivedPowerW: number;
  let illuminationQuality = 1;
  if (request.mode === "active") {
    if (!request.activeTransmitter) throw new RangeError("Active radar seeker requires its own transmitter.");
    const physicalRequest: PhysicalRadarEchoRequest = {
      transmitPowerW: request.activeTransmitter.peakPowerW,
      frequencyHz: request.waveform.centerFrequencyHz,
      antenna: request.receiver.antenna,
      targetRcsByAspect: request.candidate.targetRcsByAspect,
      targetAspectDeg: request.candidate.targetAspectDeg,
      rangeM: request.candidate.rangeM,
      rangeRateMps: request.candidate.rangeRateMps,
      azimuthDeg: request.candidate.azimuthOffBoresightDeg,
      elevationDeg: request.candidate.elevationOffBoresightDeg,
      beamAzimuthDeg: 0,
      beamElevationDeg: 0,
      oneWayPathTransmission:
        request.activeTransmitter.oneWayPathTransmission * request.candidate.pathTransmission,
      systemLossLinear: request.activeTransmitter.systemLossLinear
    };
    if (!Number.isFinite(request.activeTransmitter.peakPowerW) ||
      request.activeTransmitter.peakPowerW <= 0 ||
      !Number.isFinite(request.activeTransmitter.systemLossLinear) ||
      request.activeTransmitter.systemLossLinear < 1 ||
      !Number.isFinite(request.activeTransmitter.oneWayPathTransmission) ||
      request.activeTransmitter.oneWayPathTransmission < 0 ||
      request.activeTransmitter.oneWayPathTransmission > 1) {
      throw new RangeError("Active seeker transmitter profile is invalid.");
    }
    receivedPowerW = computePhysicalRadarEcho(physicalRequest).receivedPowerW;
  } else {
    const illumination = request.semiActiveIllumination;
    if (!illumination || !illumination.available) {
      receivedPowerW = 0;
      illuminationQuality = 0;
    } else {
      illuminationQuality = illumination.illuminationQuality;
      receivedPowerW = computeSemiActiveReceivedPower(request, illumination);
    }
  }

  const integratedSnrLinear = receivedPowerW / noisePowerW * processingGain;
  const snrDb = db10(integratedSnrLinear);
  // For a single noncoherent exponential-noise cell, -ln(Pfa) is the normalized
  // power threshold; processing gain is applied to the signal-to-noise ratio.
  const detectionThresholdSnrDb = db10(-Math.log(request.waveform.probabilityOfFalseAlarm));
  const detectionMarginDb = snrDb - Math.max(
    detectionThresholdSnrDb,
    request.receiver.minimumDetectionSnrDb
  );
  const rangeResolutionM = SPEED_OF_LIGHT_MPS /
    (2 * request.waveform.receiverBandwidthHz);
  const unambiguousRangeM = SPEED_OF_LIGHT_MPS /
    (2 * request.waveform.pulseRepetitionFrequencyHz);
  const radialVelocityResolutionMps = wavelengthM /
    (2 * request.waveform.coherentProcessingIntervalSeconds);
  const unambiguousRadialVelocityMps = wavelengthM *
    request.waveform.pulseRepetitionFrequencyHz / 4;
  const detection = request.candidate.rangeM >= request.waveform.rangeGateMinimumM &&
    request.candidate.rangeM <= request.waveform.rangeGateMaximumM &&
    request.candidate.rangeM <= unambiguousRangeM &&
    Math.abs(request.candidate.rangeRateMps) <=
      Math.min(request.waveform.dopplerGateMaximumMps, unambiguousRadialVelocityMps) &&
    request.candidate.rangeM >= 0 &&
    dbm(receivedPowerW) >= request.receiver.sensitivityDbm &&
    detectionMarginDb >= 0;

  const measuredRangeM = Math.max(0,
    request.candidate.rangeM +
    request.receiver.rangeMeasurementStandardDeviationM * gaussian(request.random));
  const measuredRangeRateMps = request.candidate.rangeRateMps +
    request.receiver.radialVelocityStandardDeviationMps * gaussian(request.random);
  const measuredDopplerHz = computeMonostaticDopplerHz(measuredRangeRateMps, wavelengthM);
  const measuredAzimuthDeg = request.candidate.azimuthOffBoresightDeg +
    request.receiver.angleMeasurementStandardDeviationDeg * gaussian(request.random);
  const measuredElevationDeg = request.candidate.elevationOffBoresightDeg +
    request.receiver.angleMeasurementStandardDeviationDeg * gaussian(request.random);
  const featureObservation: SeekerFeatureObservation = {
    measurementId: request.candidate.measurementId,
    azimuthOffBoresightDeg: measuredAzimuthDeg,
    elevationOffBoresightDeg: measuredElevationDeg,
    azimuthFromBodyDeg: measuredAzimuthDeg,
    elevationFromBodyDeg: measuredElevationDeg,
    rangeM: measuredRangeM,
    features: {
      signalToNoiseDb: snrDb,
      angularRateDegPerSecond: request.candidate.angularRateDegPerSecond,
      apparentAngularSizeDeg: request.candidate.apparentAngularSizeDeg,
      rangeRateMps: measuredRangeRateMps,
      spectralRatio: request.candidate.thermalSpectralRatio,
      thermalDecayRatePerSecond: request.candidate.thermalDecayRatePerSecond
    }
  };
  return {
    measurement: featureObservation,
    receivedPowerW,
    noisePowerW,
    snrDb,
    detectionThresholdSnrDb,
    detectionMarginDb,
    rangeResolutionM,
    unambiguousRangeM,
    radialVelocityResolutionMps,
    unambiguousRadialVelocityMps,
    measuredRangeM,
    measuredRangeRateMps,
    measuredDopplerHz,
    measuredAzimuthDeg,
    measuredElevationDeg,
    illuminationQuality,
    detection,
    classificationMeaning: "unvalidated-radar-seeker-measurement"
  };
}
