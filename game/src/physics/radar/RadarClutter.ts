import type { SeededRandom } from "../../core/random/SeededRandom.js";
import {
  computeMonostaticEchoPower,
  SPEED_OF_LIGHT_MPS
} from "./RadarPhysics.js";

export interface SurfaceBackscatterSample {
  readonly grazingAngleDeg: number;
  /** Normalized surface radar cross section σ0 in dB, relative to one square metre. */
  readonly sigmaZeroDb: number;
}

export interface SurfaceClutterModel {
  readonly profileId: string;
  readonly centerFrequencyHz: number;
  readonly polarization: "horizontal" | "vertical" | "circular";
  readonly sigmaZeroByGrazingAngle: readonly SurfaceBackscatterSample[];
  readonly frequencyExponent: number;
  readonly additionalSystemLossLinear: number;
  readonly windCouplingFraction: number;
  readonly baseDopplerSpreadMps: number;
  readonly windDopplerSpreadFraction: number;
}

export interface SurfaceClutterCell {
  readonly rangeM: number;
  readonly rangeResolutionM: number;
  readonly beamAzimuthWidthDeg: number;
  readonly grazingAngleDeg: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly radarToCellUnitVectorWorld: readonly [number, number, number];
  readonly platformVelocityWorldMps: readonly [number, number, number];
  readonly surfaceCurrentWorldMps: readonly [number, number, number];
  readonly windWorldMps: readonly [number, number, number];
  readonly oneWayPathTransmission: number;
  readonly illuminated: boolean;
}

export interface SurfaceClutterGenerationConfiguration {
  readonly transmitPowerW: number;
  readonly antennaGainDb: number;
  readonly scatterersPerCell: number;
}

export interface SurfaceClutterReturn {
  readonly rangeM: number;
  /** Positive radial rate is receding, consistent with radar target measurements. */
  readonly rangeRateMps: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly receivedPowerW: number;
  readonly phaseRadians: number;
  readonly cellRcsM2: number;
  readonly surfaceProfileId: string;
  readonly polarization: SurfaceClutterModel["polarization"];
}

export interface SurfaceClutterDiagnostics {
  readonly profileId: string;
  readonly illuminatedCells: number;
  readonly generatedScatterers: number;
  readonly totalClutterPowerW: number;
  readonly minimumSigmaZeroDb: number;
  readonly maximumSigmaZeroDb: number;
}

function dot(
  a: readonly [number, number, number],
  b: readonly [number, number, number]
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function magnitude(
  a: readonly [number, number, number]
): number {
  return Math.hypot(a[0], a[1], a[2]);
}
function gaussian(random: SeededRandom): number {
  const first = Math.max(Number.MIN_VALUE, 1 - random.nextFloat());
  const second = random.nextFloat();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}
function interpolateSigmaZeroDb(
  samples: readonly SurfaceBackscatterSample[],
  grazingAngleDeg: number
): number {
  if (samples.length < 2 || !Number.isFinite(grazingAngleDeg) ||
    grazingAngleDeg < 0 || grazingAngleDeg > 90) {
    throw new RangeError("Surface backscatter profile or grazing angle is invalid.");
  }
  let previous = -Infinity;
  for (const sample of samples) {
    if (!Number.isFinite(sample.grazingAngleDeg) || sample.grazingAngleDeg <= previous ||
      sample.grazingAngleDeg < 0 || sample.grazingAngleDeg > 90 ||
      !Number.isFinite(sample.sigmaZeroDb)) {
      throw new RangeError("Surface σ0 samples must be ordered and finite.");
    }
    previous = sample.grazingAngleDeg;
  }
  if (grazingAngleDeg <= samples[0]!.grazingAngleDeg) return samples[0]!.sigmaZeroDb;
  if (grazingAngleDeg >= samples[samples.length - 1]!.grazingAngleDeg) {
    return samples[samples.length - 1]!.sigmaZeroDb;
  }
  for (let index = 1; index < samples.length; index += 1) {
    const lower = samples[index - 1]!;
    const upper = samples[index]!;
    if (grazingAngleDeg <= upper.grazingAngleDeg) {
      const fraction = (grazingAngleDeg - lower.grazingAngleDeg) /
        (upper.grazingAngleDeg - lower.grazingAngleDeg);
      return lower.sigmaZeroDb + (upper.sigmaZeroDb - lower.sigmaZeroDb) * fraction;
    }
  }
  return samples[samples.length - 1]!.sigmaZeroDb;
}

/**
 * Generates distributed land/sea/urban clutter scatterer returns from user-supplied
 * measured/derived σ0 profiles. Cell area is projected from range resolution and
 * azimuth beamwidth; each cell is split into incoherent sub-scatterers with random
 * phase and a wind/platform-dependent Doppler spread.
 *
 * This is an empirical surface-scattering interface, not an electromagnetic
 * rough-surface solver. A profile must declare its source and exact frequency,
 * polarization, surface type, moisture/sea state and grazing-angle validity range.
 */
export function generateSurfaceClutterReturns(
  model: SurfaceClutterModel,
  cells: readonly SurfaceClutterCell[],
  configuration: SurfaceClutterGenerationConfiguration,
  random: SeededRandom
): { readonly returns: readonly SurfaceClutterReturn[]; readonly diagnostics: SurfaceClutterDiagnostics } {
  if (!model.profileId ||
    !Number.isFinite(model.centerFrequencyHz) || model.centerFrequencyHz <= 0 ||
    !Number.isFinite(model.frequencyExponent) ||
    !Number.isFinite(model.additionalSystemLossLinear) || model.additionalSystemLossLinear < 1 ||
    !Number.isFinite(model.windCouplingFraction) || model.windCouplingFraction < 0 ||
    model.windCouplingFraction > 1 ||
    !Number.isFinite(model.baseDopplerSpreadMps) || model.baseDopplerSpreadMps < 0 ||
    !Number.isFinite(model.windDopplerSpreadFraction) || model.windDopplerSpreadFraction < 0) {
    throw new RangeError("Surface clutter model is invalid.");
  }
  if (!Number.isFinite(configuration.transmitPowerW) || configuration.transmitPowerW <= 0 ||
    !Number.isFinite(configuration.antennaGainDb) ||
    !Number.isInteger(configuration.scatterersPerCell) || configuration.scatterersPerCell < 1) {
    throw new RangeError("Surface clutter generation configuration is invalid.");
  }
  const wavelengthM = SPEED_OF_LIGHT_MPS / model.centerFrequencyHz;
  const sigmaReferenceFrequencyHz = 10e9;
  const frequencyScale = (model.centerFrequencyHz / sigmaReferenceFrequencyHz) ** model.frequencyExponent;
  const returns: SurfaceClutterReturn[] = [];
  let totalClutterPowerW = 0;
  let minimumSigmaZeroDb = Infinity;
  let maximumSigmaZeroDb = -Infinity;
  let illuminatedCells = 0;

  for (const cell of cells) {
    if (![cell.rangeM, cell.rangeResolutionM, cell.beamAzimuthWidthDeg,
      cell.grazingAngleDeg, cell.azimuthDeg, cell.elevationDeg,
      cell.oneWayPathTransmission].every(Number.isFinite) ||
      cell.rangeM <= 0 || cell.rangeResolutionM <= 0 ||
      cell.beamAzimuthWidthDeg <= 0 || cell.beamAzimuthWidthDeg >= 180 ||
      cell.grazingAngleDeg <= 0 || cell.grazingAngleDeg > 90 ||
      cell.oneWayPathTransmission < 0 || cell.oneWayPathTransmission > 1 ||
      ![cell.radarToCellUnitVectorWorld, cell.platformVelocityWorldMps,
        cell.surfaceCurrentWorldMps, cell.windWorldMps].every((vector) =>
          vector.length === 3 && vector.every(Number.isFinite))) {
      throw new RangeError("Surface clutter cell geometry or propagation is invalid.");
    }
    if (!cell.illuminated || cell.oneWayPathTransmission === 0) continue;
    illuminatedCells += 1;
    const sigmaZeroDb = interpolateSigmaZeroDb(model.sigmaZeroByGrazingAngle, cell.grazingAngleDeg) +
      10 * Math.log10(frequencyScale);
    const sigmaZeroLinear = 10 ** (sigmaZeroDb / 10);
    const beamWidthRad = cell.beamAzimuthWidthDeg * Math.PI / 180;
    const illuminatedAreaM2 = cell.rangeResolutionM * cell.rangeM * beamWidthRad /
      Math.max(0.01, Math.sin(cell.grazingAngleDeg * Math.PI / 180));
    const cellRcsM2 = sigmaZeroLinear * illuminatedAreaM2;
    const link = computeMonostaticEchoPower({
      transmitPowerW: configuration.transmitPowerW,
      transmitGainDb: configuration.antennaGainDb,
      receiveGainDb: configuration.antennaGainDb,
      frequencyHz: model.centerFrequencyHz,
      rcsM2: cellRcsM2,
      rangeM: cell.rangeM,
      oneWayPathTransmission: cell.oneWayPathTransmission,
      systemLossLinear: model.additionalSystemLossLinear
    });

    const surfaceVelocity: readonly [number, number, number] = [
      cell.surfaceCurrentWorldMps[0] + cell.windWorldMps[0] * model.windCouplingFraction,
      cell.surfaceCurrentWorldMps[1] + cell.windWorldMps[1] * model.windCouplingFraction,
      cell.surfaceCurrentWorldMps[2] + cell.windWorldMps[2] * model.windCouplingFraction
    ];
    const relativeVelocity = [
      surfaceVelocity[0] - cell.platformVelocityWorldMps[0],
      surfaceVelocity[1] - cell.platformVelocityWorldMps[1],
      surfaceVelocity[2] - cell.platformVelocityWorldMps[2]
    ] as const;
    const losLength = magnitude(cell.radarToCellUnitVectorWorld);
    if (losLength <= 0) throw new RangeError("Surface clutter line of sight cannot be zero.");
    const losUnit = [
      cell.radarToCellUnitVectorWorld[0] / losLength,
      cell.radarToCellUnitVectorWorld[1] / losLength,
      cell.radarToCellUnitVectorWorld[2] / losLength
    ] as const;
    const meanRangeRateMps = dot(relativeVelocity, losUnit);
    const windSpeed = magnitude(cell.windWorldMps);
    const dopplerSpread = model.baseDopplerSpreadMps +
      model.windDopplerSpreadFraction * windSpeed;
    const scattererPowerW = link.receivedPowerW / configuration.scatterersPerCell;
    for (let index = 0; index < configuration.scatterersPerCell; index += 1) {
      returns.push({
        rangeM: cell.rangeM,
        rangeRateMps: meanRangeRateMps + dopplerSpread * gaussian(random),
        azimuthDeg: cell.azimuthDeg,
        elevationDeg: cell.elevationDeg,
        receivedPowerW: scattererPowerW,
        phaseRadians: random.nextFloat() * 2 * Math.PI,
        cellRcsM2: cellRcsM2 / configuration.scatterersPerCell,
        surfaceProfileId: model.profileId,
        polarization: model.polarization
      });
    }
    totalClutterPowerW += link.receivedPowerW;
    minimumSigmaZeroDb = Math.min(minimumSigmaZeroDb, sigmaZeroDb);
    maximumSigmaZeroDb = Math.max(maximumSigmaZeroDb, sigmaZeroDb);
  }

  return {
    returns,
    diagnostics: {
      profileId: model.profileId,
      illuminatedCells,
      generatedScatterers: returns.length,
      totalClutterPowerW,
      minimumSigmaZeroDb: illuminatedCells > 0 ? minimumSigmaZeroDb : -Infinity,
      maximumSigmaZeroDb: illuminatedCells > 0 ? maximumSigmaZeroDb : -Infinity
    }
  };
}
