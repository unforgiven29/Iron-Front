export interface RadarRangeDopplerFrame {
  readonly rangeBins: number;
  readonly dopplerBins: number;
  /** Row-major range x Doppler power samples in watts. */
  readonly powerWatts: readonly number[];
  readonly rangeStartM: number;
  /** Physical two-way range resolution set by the processed bandwidth. */
  readonly rangeResolutionM: number;
  /** Range-axis sample spacing; defaults to rangeResolutionM when not oversampled. */
  readonly rangeBinSpacingM?: number;
  /** Positive values mean increasing range / receding target. */
  readonly radialVelocityStartMps: number;
  readonly radialVelocityResolutionMps: number;
  readonly beamAzimuthDeg: number;
  readonly beamElevationDeg: number;
  readonly acquiredAtSeconds: number;
  readonly coherentProcessingIntervalSeconds: number;
  readonly wavelengthM: number;
  readonly horizontalBeamwidthDeg: number;
  readonly verticalBeamwidthDeg: number;
}

export interface CaCfarConfiguration {
  readonly guardRangeCells: number;
  readonly guardDopplerCells: number;
  readonly trainingRangeCells: number;
  readonly trainingDopplerCells: number;
  readonly probabilityOfFalseAlarm: number;
  readonly maximumDetections?: number;
}

export interface RadarMeasurement {
  readonly measurementId: string;
  readonly rangeBin: number;
  readonly dopplerBin: number;
  readonly rangeM: number;
  readonly radialVelocityMps: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly receivedPowerW: number;
  readonly estimatedNoisePowerW: number;
  readonly snrDb: number;
  readonly rangeUncertaintyM: number;
  readonly radialVelocityUncertaintyMps: number;
  readonly azimuthUncertaintyDeg: number;
  readonly elevationUncertaintyDeg: number;
  readonly acquiredAtSeconds: number;
  readonly probabilityOfFalseAlarm: number;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(name + " must be a non-negative integer.");
  }
}

function validateFrame(frame: RadarRangeDopplerFrame): void {
  if (!Number.isInteger(frame.rangeBins) || frame.rangeBins < 1 ||
    !Number.isInteger(frame.dopplerBins) || frame.dopplerBins < 1 ||
    frame.powerWatts.length !== frame.rangeBins * frame.dopplerBins) {
    throw new RangeError("Range-Doppler dimensions do not match the power buffer.");
  }
  for (const value of frame.powerWatts) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError("Power cells must be finite and non-negative.");
  }
  const positive = [
    frame.rangeResolutionM,
    frame.rangeBinSpacingM ?? frame.rangeResolutionM,
    frame.dopplerResolutionMps,
    frame.coherentProcessingIntervalSeconds,
    frame.wavelengthM,
    frame.horizontalBeamwidthDeg,
    frame.verticalBeamwidthDeg
  ];
  if (!positive.every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("Radar resolutions, CPI, wavelength and beamwidths must be positive and finite.");
  }
  if (![frame.rangeStartM, frame.radialVelocityStartMps, frame.beamAzimuthDeg,
    frame.beamElevationDeg, frame.acquiredAtSeconds].every(Number.isFinite) || frame.rangeStartM < 0) {
    throw new RangeError("Radar frame metadata must be finite and range cannot be negative.");
  }
}

function db10(value: number): number {
  return 10 * Math.log10(Math.max(value, Number.MIN_VALUE));
}

/**
 * Two-dimensional cell-averaging CFAR for square/rectangular range-Doppler
 * training windows. It assumes independent exponentially distributed noise
 * power in the reference cells; correlated clutter requires a different model.
 */
export function detectCaCfar(
  frame: RadarRangeDopplerFrame,
  config: CaCfarConfiguration
): readonly RadarMeasurement[] {
  validateFrame(frame);
  assertNonNegativeInteger(config.guardRangeCells, "Range guard cells");
  assertNonNegativeInteger(config.guardDopplerCells, "Doppler guard cells");
  assertNonNegativeInteger(config.trainingRangeCells, "Range training cells");
  assertNonNegativeInteger(config.trainingDopplerCells, "Doppler training cells");
  if (config.trainingRangeCells < 1 || config.trainingDopplerCells < 1) {
    throw new RangeError("At least one training cell is required in each dimension.");
  }
  if (!Number.isFinite(config.probabilityOfFalseAlarm) ||
    config.probabilityOfFalseAlarm <= 0 || config.probabilityOfFalseAlarm >= 1) {
    throw new RangeError("Probability of false alarm must be strictly between zero and one.");
  }

  const outerRange = config.guardRangeCells + config.trainingRangeCells;
  const outerDoppler = config.guardDopplerCells + config.trainingDopplerCells;
  const innerRange = config.guardRangeCells;
  const innerDoppler = config.guardDopplerCells;
  const outerCellCount = (2 * outerRange + 1) * (2 * outerDoppler + 1);
  const guardCellCount = (2 * innerRange + 1) * (2 * innerDoppler + 1);
  const referenceCellCount = outerCellCount - guardCellCount;
  if (referenceCellCount < 1) throw new RangeError("CFAR window must contain reference cells.");
  const thresholdScale = referenceCellCount *
    (config.probabilityOfFalseAlarm ** (-1 / referenceCellCount) - 1);

  const detections: RadarMeasurement[] = [];
  const cellPower = (rangeIndex: number, dopplerIndex: number): number =>
    frame.powerWatts[rangeIndex * frame.dopplerBins + dopplerIndex]!;

  for (let rangeIndex = outerRange; rangeIndex < frame.rangeBins - outerRange; rangeIndex += 1) {
    for (let dopplerIndex = outerDoppler; dopplerIndex < frame.dopplerBins - outerDoppler; dopplerIndex += 1) {
      let referencePowerSum = 0;
      for (let rOffset = -outerRange; rOffset <= outerRange; rOffset += 1) {
        for (let dOffset = -outerDoppler; dOffset <= outerDoppler; dOffset += 1) {
          if (Math.abs(rOffset) <= innerRange && Math.abs(dOffset) <= innerDoppler) continue;
          referencePowerSum += cellPower(rangeIndex + rOffset, dopplerIndex + dOffset);
        }
      }
      const noiseEstimateW = referencePowerSum / referenceCellCount;
      const thresholdW = noiseEstimateW * thresholdScale;
      const receivedPowerW = cellPower(rangeIndex, dopplerIndex);
      if (receivedPowerW <= thresholdW || noiseEstimateW <= 0) continue;

      let isLocalMaximum = true;
      for (let rOffset = -1; rOffset <= 1 && isLocalMaximum; rOffset += 1) {
        for (let dOffset = -1; dOffset <= 1; dOffset += 1) {
          if (rOffset === 0 && dOffset === 0) continue;
          if (cellPower(rangeIndex + rOffset, dopplerIndex + dOffset) > receivedPowerW) {
            isLocalMaximum = false;
            break;
          }
        }
      }
      if (!isLocalMaximum) continue;

      const snrLinear = receivedPowerW / noiseEstimateW;
      const snrRoot = Math.sqrt(Math.max(1, snrLinear));
      const angularDenominator = 2.355 * snrRoot;
      detections.push({
        measurementId: "rd-" + frame.acquiredAtSeconds.toFixed(6) + "-" + rangeIndex + "-" + dopplerIndex,
        rangeBin: rangeIndex,
        dopplerBin: dopplerIndex,
        rangeM: frame.rangeStartM + rangeIndex * (frame.rangeBinSpacingM ?? frame.rangeResolutionM),
        radialVelocityMps: frame.radialVelocityStartMps + dopplerIndex * frame.radialVelocityResolutionMps,
        azimuthDeg: frame.beamAzimuthDeg,
        elevationDeg: frame.beamElevationDeg,
        receivedPowerW,
        estimatedNoisePowerW: noiseEstimateW,
        snrDb: db10(snrLinear),
        rangeUncertaintyM: frame.rangeResolutionM / (Math.sqrt(12) * snrRoot),
        radialVelocityUncertaintyMps: frame.radialVelocityResolutionMps / (Math.sqrt(12) * snrRoot),
        azimuthUncertaintyDeg: frame.horizontalBeamwidthDeg / angularDenominator,
        elevationUncertaintyDeg: frame.verticalBeamwidthDeg / angularDenominator,
        acquiredAtSeconds: frame.acquiredAtSeconds,
        probabilityOfFalseAlarm: config.probabilityOfFalseAlarm
      });
    }
  }

  detections.sort((a, b) => b.receivedPowerW - a.receivedPowerW ||
    a.rangeBin - b.rangeBin || a.dopplerBin - b.dopplerBin);
  const maximumDetections = config.maximumDetections ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isInteger(maximumDetections) || maximumDetections < 1) {
    throw new RangeError("Maximum detections must be a positive integer.");
  }
  return detections.slice(0, maximumDetections);
}
