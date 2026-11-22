import type { SeededRandom } from "../../core/random/SeededRandom.js";
import {
  BOLTZMANN_CONSTANT_J_PER_K,
  evaluateAntennaGainDb,
  SPEED_OF_LIGHT_MPS,
  type AntennaPatternProfile
} from "../../physics/radar/RadarPhysics.js";

export type RwrBearingArchitecture =
  | "amplitude-comparison"
  | "phase-interferometer"
  | "time-difference"
  | "correlative-interferometer";

export type RadarPulseModulation = "unmodulated" | "linear-fm" | "phase-coded" | "frequency-agile" | "unknown";

export interface RadarEmissionSnapshot {
  readonly positionWorldM: readonly [number, number, number];
  readonly frequencyHz: number;
  readonly bandwidthHz: number;
  readonly peakTransmitPowerW: number;
  readonly transmitAntenna: AntennaPatternProfile;
  readonly beamAzimuthWorldDeg: number;
  readonly beamElevationWorldDeg: number;
  readonly pulseWidthSeconds: number;
  readonly pulseRepetitionFrequencyHz: number;
  readonly pulseModulation: RadarPulseModulation;
  readonly beamOnReceiverFraction: number;
  readonly pathTransmissionFraction: number;
  readonly transmitting: boolean;
}

export interface RwrReceiverConfiguration {
  readonly minimumFrequencyHz: number;
  readonly maximumFrequencyHz: number;
  readonly instantaneousBandwidthHz: number;
  readonly noiseTemperatureK: number;
  readonly noiseFigureDb: number;
  readonly antennaGainDb: number;
  readonly sensitivityDbm: number;
  readonly minimumSnrDb: number;
  readonly observationWindowSeconds: number;
  readonly bearingArchitecture: RwrBearingArchitecture;
  readonly nominalBearingAccuracyDeg: number;
  readonly frequencyMeasurementAccuracyFraction: number;
  readonly pulseWidthMeasurementAccuracyFraction: number;
  readonly priMeasurementAccuracyFraction: number;
}

export interface RwrEmitterSignature {
  readonly libraryId: string;
  readonly label: string;
  readonly minimumFrequencyHz: number;
  readonly maximumFrequencyHz: number;
  readonly minimumBandwidthHz: number;
  readonly maximumBandwidthHz: number;
  readonly minimumPulseWidthSeconds: number;
  readonly maximumPulseWidthSeconds: number;
  readonly minimumPrfHz: number;
  readonly maximumPrfHz: number;
  readonly modulation: RadarPulseModulation;
}

export interface RwrEmitterObservation {
  readonly observationId: string;
  readonly acquiredAtSeconds: number;
  readonly bearingDeg: number;
  readonly bearingStandardDeviationDeg: number;
  readonly bearingArchitecture: RwrBearingArchitecture;
  readonly receivedPowerDbm: number;
  readonly snrDb: number;
  readonly frequencyHz: number;
  readonly measuredBandwidthHz: number;
  readonly pulseWidthSeconds: number;
  readonly pulseRepetitionFrequencyHz: number;
  readonly detectedPulseCount: number;
  readonly pulseModulation: RadarPulseModulation;
  readonly classifiedEmitter: string;
  readonly classificationLibraryId: string | null;
  readonly classificationConfidence: number;
  readonly classificationMeaning: "unvalidated-signature-match";
  /** A passive warning receiver does not directly measure emitter range. */
  readonly rangeEstimateM: null;
}

export interface RwrInterceptResult {
  readonly observations: readonly RwrEmitterObservation[];
  readonly rejectedEmissionCount: number;
}

function wrapDegrees(angleDeg: number): number {
  return ((angleDeg % 360) + 360) % 360;
}

function signedAngleDifferenceDeg(angleDeg: number, referenceDeg: number): number {
  let result = (angleDeg - referenceDeg) % 360;
  if (result > 180) result -= 360;
  if (result < -180) result += 360;
  return result;
}

function vectorDifference(
  a: readonly [number, number, number],
  b: readonly [number, number, number]
): readonly [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function magnitude(vector: readonly [number, number, number]): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function db10(value: number): number {
  return 10 * Math.log10(Math.max(value, Number.MIN_VALUE));
}

function dbm(powerW: number): number {
  return 10 * Math.log10(Math.max(powerW, Number.MIN_VALUE) / 1e-3);
}

function gaussian(random: SeededRandom): number {
  const first = Math.max(Number.MIN_VALUE, 1 - random.nextFloat());
  const second = random.nextFloat();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function validateReceiver(receiver: RwrReceiverConfiguration): void {
  if (![receiver.minimumFrequencyHz, receiver.maximumFrequencyHz,
    receiver.instantaneousBandwidthHz, receiver.noiseTemperatureK,
    receiver.observationWindowSeconds, receiver.nominalBearingAccuracyDeg].every(
      (value) => Number.isFinite(value) && value > 0
    ) || receiver.maximumFrequencyHz <= receiver.minimumFrequencyHz ||
    !Number.isFinite(receiver.noiseFigureDb) || receiver.noiseFigureDb < 0 ||
    !Number.isFinite(receiver.antennaGainDb) ||
    !Number.isFinite(receiver.sensitivityDbm) ||
    !Number.isFinite(receiver.minimumSnrDb) ||
    !Number.isFinite(receiver.frequencyMeasurementAccuracyFraction) ||
    receiver.frequencyMeasurementAccuracyFraction < 0 ||
    !Number.isFinite(receiver.pulseWidthMeasurementAccuracyFraction) ||
    receiver.pulseWidthMeasurementAccuracyFraction < 0 ||
    !Number.isFinite(receiver.priMeasurementAccuracyFraction) ||
    receiver.priMeasurementAccuracyFraction < 0) {
    throw new RangeError("RWR receiver configuration is invalid.");
  }
}

function validateSignature(signature: RwrEmitterSignature): void {
  if (!signature.libraryId || !signature.label ||
    ![signature.minimumFrequencyHz, signature.maximumFrequencyHz,
      signature.minimumBandwidthHz, signature.maximumBandwidthHz,
      signature.minimumPulseWidthSeconds, signature.maximumPulseWidthSeconds,
      signature.minimumPrfHz, signature.maximumPrfHz].every(
        (value) => Number.isFinite(value) && value > 0
      ) || signature.maximumFrequencyHz < signature.minimumFrequencyHz ||
    signature.maximumBandwidthHz < signature.minimumBandwidthHz ||
    signature.maximumPulseWidthSeconds < signature.minimumPulseWidthSeconds ||
    signature.maximumPrfHz < signature.minimumPrfHz) {
    throw new RangeError("RWR signature library entry is invalid.");
  }
}

function classifyEmitter(
  emission: RadarEmissionSnapshot,
  measuredFrequencyHz: number,
  measuredBandwidthHz: number,
  measuredPulseWidthSeconds: number,
  measuredPrfHz: number,
  signatures: readonly RwrEmitterSignature[]
): { readonly label: string; readonly libraryId: string | null; readonly confidence: number } {
  let best: RwrEmitterSignature | null = null;
  let bestScore = 0;
  for (const signature of signatures) {
    let matched = 0;
    if (measuredFrequencyHz >= signature.minimumFrequencyHz &&
      measuredFrequencyHz <= signature.maximumFrequencyHz) matched += 1;
    if (measuredBandwidthHz >= signature.minimumBandwidthHz &&
      measuredBandwidthHz <= signature.maximumBandwidthHz) matched += 1;
    if (measuredPulseWidthSeconds >= signature.minimumPulseWidthSeconds &&
      measuredPulseWidthSeconds <= signature.maximumPulseWidthSeconds) matched += 1;
    if (measuredPrfHz >= signature.minimumPrfHz &&
      measuredPrfHz <= signature.maximumPrfHz) matched += 1;
    if (signature.modulation === emission.pulseModulation) matched += 1;
    const score = matched / 5;
    if (score > bestScore) {
      bestScore = score;
      best = signature;
    }
  }
  return best && bestScore >= 0.8
    ? { label: best.label, libraryId: best.libraryId, confidence: bestScore }
    : { label: "unknown emitter", libraryId: null, confidence: bestScore };
}

/**
 * Passive RF interception from instantaneous radar emission snapshots. The
 * receiver estimates bearing and pulse traits, performs a signature-library
 * match, and deliberately provides no direct emitter entity ID or range.
 */
export function interceptRadarEmissions(
  receiver: RwrReceiverConfiguration,
  receiverPositionWorldM: readonly [number, number, number],
  receiverHeadingWorldDeg: number,
  emissions: readonly RadarEmissionSnapshot[],
  signatures: readonly RwrEmitterSignature[],
  acquiredAtSeconds: number,
  random: SeededRandom
): RwrInterceptResult {
  validateReceiver(receiver);
  if (!receiverPositionWorldM.every(Number.isFinite) || !Number.isFinite(receiverHeadingWorldDeg) ||
    !Number.isFinite(acquiredAtSeconds) || acquiredAtSeconds < 0) {
    throw new RangeError("RWR receiver pose and acquisition time are invalid.");
  }
  signatures.forEach(validateSignature);

  const observations: RwrEmitterObservation[] = [];
  let rejectedEmissionCount = 0;
  const receiverLower = receiver.minimumFrequencyHz;
  const receiverUpper = receiver.maximumFrequencyHz;

  for (let index = 0; index < emissions.length; index += 1) {
    const emission = emissions[index]!;
    if (!emission.transmitting) continue;
    const values = [
      emission.frequencyHz,
      emission.bandwidthHz,
      emission.peakTransmitPowerW,
      emission.pulseWidthSeconds,
      emission.pulseRepetitionFrequencyHz,
      emission.beamAzimuthWorldDeg,
      emission.beamElevationWorldDeg,
      emission.beamOnReceiverFraction,
      emission.pathTransmissionFraction
    ];
    if (!emission.positionWorldM.every(Number.isFinite) ||
      !values.every(Number.isFinite) || emission.frequencyHz <= 0 ||
      emission.bandwidthHz <= 0 || emission.peakTransmitPowerW <= 0 ||
      emission.pulseWidthSeconds <= 0 || emission.pulseRepetitionFrequencyHz <= 0 ||
      emission.beamOnReceiverFraction < 0 || emission.beamOnReceiverFraction > 1 ||
      emission.pathTransmissionFraction < 0 || emission.pathTransmissionFraction > 1) {
      throw new RangeError("Radar emission snapshot is invalid.");
    }

    const lower = emission.frequencyHz - emission.bandwidthHz / 2;
    const upper = emission.frequencyHz + emission.bandwidthHz / 2;
    const overlapHz = Math.max(0, Math.min(receiverUpper, upper) - Math.max(receiverLower, lower));
    const overlapFraction = overlapHz / emission.bandwidthHz;
    if (overlapFraction <= 0) {
      rejectedEmissionCount += 1;
      continue;
    }

    const receiverToEmitter = vectorDifference(emission.positionWorldM, receiverPositionWorldM);
    const rangeM = magnitude(receiverToEmitter);
    if (rangeM <= 1) {
      rejectedEmissionCount += 1;
      continue;
    }
    const azimuthFromReceiverDeg = wrapDegrees(
      Math.atan2(receiverToEmitter[0], receiverToEmitter[1]) * 180 / Math.PI
    );
    const elevationFromReceiverDeg = Math.atan2(
      receiverToEmitter[2],
      Math.hypot(receiverToEmitter[0], receiverToEmitter[1])
    ) * 180 / Math.PI;
    const receiverToEmitterBearingFromRadarDeg = wrapDegrees(azimuthFromReceiverDeg + 180);
    const transmitGainDb = evaluateAntennaGainDb(
      emission.transmitAntenna,
      signedAngleDifferenceDeg(receiverToEmitterBearingFromRadarDeg, emission.beamAzimuthWorldDeg),
      elevationFromReceiverDeg - emission.beamElevationWorldDeg
    );
    const wavelengthM = SPEED_OF_LIGHT_MPS / emission.frequencyHz;
    const receivedPowerW = emission.peakTransmitPowerW * 10 ** (transmitGainDb / 10) *
      10 ** (receiver.antennaGainDb / 10) * wavelengthM ** 2 *
      emission.pathTransmissionFraction * overlapFraction /
      ((4 * Math.PI * rangeM) ** 2);
    const effectiveNoiseBandwidthHz = Math.min(receiver.instantaneousBandwidthHz, overlapHz);
    const inBandNoiseW = BOLTZMANN_CONSTANT_J_PER_K * receiver.noiseTemperatureK *
      effectiveNoiseBandwidthHz * 10 ** (receiver.noiseFigureDb / 10);
    const snrLinear = receivedPowerW / Math.max(inBandNoiseW, Number.MIN_VALUE);
    const receivedPowerDbm = dbm(receivedPowerW);
    const snrDb = db10(snrLinear);
    if (receivedPowerDbm < receiver.sensitivityDbm || snrDb < receiver.minimumSnrDb) {
      rejectedEmissionCount += 1;
      continue;
    }

    const detectedPulseCount = Math.floor(
      receiver.observationWindowSeconds * emission.pulseRepetitionFrequencyHz *
      emission.beamOnReceiverFraction
    );
    if (detectedPulseCount < 1) {
      rejectedEmissionCount += 1;
      continue;
    }
    const bearingAccuracy = Math.max(
      receiver.nominalBearingAccuracyDeg,
      3 / Math.sqrt(Math.max(1, snrLinear))
    );
    const bearingNoise = bearingAccuracy * gaussian(random);
    const measuredFrequencyHz = emission.frequencyHz *
      (1 + receiver.frequencyMeasurementAccuracyFraction * gaussian(random));
    const measuredPulseWidthSeconds = emission.pulseWidthSeconds *
      (1 + receiver.pulseWidthMeasurementAccuracyFraction * gaussian(random));
    const measuredPrfHz = emission.pulseRepetitionFrequencyHz *
      (1 + receiver.priMeasurementAccuracyFraction * gaussian(random));
    const classification = classifyEmitter(
      emission,
      measuredFrequencyHz,
      emission.bandwidthHz,
      measuredPulseWidthSeconds,
      measuredPrfHz,
      signatures
    );
    observations.push({
      observationId: "rwr-" + acquiredAtSeconds.toFixed(6) + "-" + index,
      acquiredAtSeconds,
      bearingDeg: wrapDegrees(azimuthFromReceiverDeg + bearingNoise),
      bearingStandardDeviationDeg: bearingAccuracy,
      bearingArchitecture: receiver.bearingArchitecture,
      receivedPowerDbm,
      snrDb,
      frequencyHz: measuredFrequencyHz,
      measuredBandwidthHz: emission.bandwidthHz,
      pulseWidthSeconds: measuredPulseWidthSeconds,
      pulseRepetitionFrequencyHz: measuredPrfHz,
      detectedPulseCount,
      pulseModulation: emission.pulseModulation,
      classifiedEmitter: classification.label,
      classificationLibraryId: classification.libraryId,
      classificationConfidence: classification.confidence,
      classificationMeaning: "unvalidated-signature-match",
      rangeEstimateM: null
    });
  }

  observations.sort((a, b) => a.bearingDeg - b.bearingDeg ||
    a.frequencyHz - b.frequencyHz);
  return { observations, rejectedEmissionCount };
}
