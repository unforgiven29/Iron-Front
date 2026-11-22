export interface AesaElementState {
  readonly row: number;
  readonly column: number;
  readonly amplitudeWeight: number;
  /** Residual phase error after calibration, radians. */
  readonly phaseErrorRadians: number;
  readonly healthFraction: number;
}

export interface PlanarAesaConfiguration {
  readonly rows: number;
  readonly columns: number;
  readonly spacingXInWavelengths: number;
  readonly spacingYInWavelengths: number;
  readonly elements: readonly AesaElementState[];
}

export interface AesaArrayFactorResult {
  /** Normalized power gain relative to the ideal coherent broadside peak. */
  readonly relativeGainDb: number;
  readonly normalizedFieldMagnitude: number;
  readonly installedElementCount: number;
  readonly healthyElementCount: number;
  readonly effectiveApertureFraction: number;
  readonly usable: boolean;
}

/**
 * Evaluates a finite planar array factor in direction-cosine coordinates.
 * Element weights, phase calibration errors and per-module health are explicit.
 * Mutual coupling, embedded element patterns, radome scattering and full-wave
 * electromagnetic effects are outside this reduced-order array model.
 */
export function evaluatePlanarAesaArrayFactor(
  config: PlanarAesaConfiguration,
  steeringAzimuthDeg: number,
  steeringElevationDeg: number,
  observationAzimuthDeg: number,
  observationElevationDeg: number
): AesaArrayFactorResult {
  if (!Number.isInteger(config.rows) || config.rows < 1 ||
    !Number.isInteger(config.columns) || config.columns < 1 ||
    !Number.isFinite(config.spacingXInWavelengths) || config.spacingXInWavelengths <= 0 ||
    !Number.isFinite(config.spacingYInWavelengths) || config.spacingYInWavelengths <= 0) {
    throw new RangeError("AESA dimensions and element spacing must be positive.");
  }
  const angles = [
    steeringAzimuthDeg,
    steeringElevationDeg,
    observationAzimuthDeg,
    observationElevationDeg
  ];
  if (!angles.every(Number.isFinite) || Math.abs(steeringElevationDeg) > 90 ||
    Math.abs(observationElevationDeg) > 90) {
    throw new RangeError("AESA steering and observation angles must be finite and valid.");
  }
  if (config.elements.length !== config.rows * config.columns) {
    throw new RangeError("AESA element table must cover every physical array position.");
  }

  const seen = new Set<string>();
  let coherentReal = 0;
  let coherentImaginary = 0;
  let healthyWeightSum = 0;
  let installedWeightSum = 0;
  let healthyElementCount = 0;
  const steeringU = directionU(steeringAzimuthDeg, steeringElevationDeg);
  const steeringV = directionV(steeringElevationDeg);
  const observationU = directionU(observationAzimuthDeg, observationElevationDeg);
  const observationV = directionV(observationElevationDeg);

  for (const element of config.elements) {
    if (!Number.isInteger(element.row) || element.row < 0 || element.row >= config.rows ||
      !Number.isInteger(element.column) || element.column < 0 || element.column >= config.columns ||
      !Number.isFinite(element.amplitudeWeight) || element.amplitudeWeight < 0 ||
      !Number.isFinite(element.phaseErrorRadians) ||
      !Number.isFinite(element.healthFraction) || element.healthFraction < 0 || element.healthFraction > 1) {
      throw new RangeError("AESA element state is invalid.");
    }
    const key = element.row + ":" + element.column;
    if (seen.has(key)) throw new RangeError("AESA element coordinates must be unique.");
    seen.add(key);
    const weight = element.amplitudeWeight;
    installedWeightSum += weight;
    const effectiveWeight = weight * element.healthFraction;
    if (effectiveWeight <= 0) continue;
    healthyElementCount += 1;
    healthyWeightSum += effectiveWeight;

    const spatialPhase = 2 * Math.PI * (
      element.column * config.spacingXInWavelengths * (observationU - steeringU) +
      element.row * config.spacingYInWavelengths * (observationV - steeringV)
    );
    const phase = spatialPhase + element.phaseErrorRadians;
    coherentReal += effectiveWeight * Math.cos(phase);
    coherentImaginary += effectiveWeight * Math.sin(phase);
  }

  if (seen.size !== config.rows * config.columns) {
    throw new RangeError("AESA element table has missing array positions.");
  }
  if (installedWeightSum <= 0 || healthyWeightSum <= 0) {
    return {
      relativeGainDb: -120,
      normalizedFieldMagnitude: 0,
      installedElementCount: config.elements.length,
      healthyElementCount,
      effectiveApertureFraction: 0,
      usable: false
    };
  }
  const normalizedFieldMagnitude = Math.min(1, Math.hypot(coherentReal, coherentImaginary) / installedWeightSum);
  const relativeGainDb = 20 * Math.log10(Math.max(1e-6, normalizedFieldMagnitude));
  return {
    relativeGainDb,
    normalizedFieldMagnitude,
    installedElementCount: config.elements.length,
    healthyElementCount,
    effectiveApertureFraction: healthyWeightSum / installedWeightSum,
    usable: true
  };
}

function directionU(azimuthDeg: number, elevationDeg: number): number {
  return Math.cos(elevationDeg * Math.PI / 180) * Math.sin(azimuthDeg * Math.PI / 180);
}

function directionV(elevationDeg: number): number {
  return Math.sin(elevationDeg * Math.PI / 180);
}

/** Uniform square lattice generator for synthetic test/lab configurations only. */
export function createUniformAesaTestArray(
  rows: number,
  columns: number,
  phaseErrorRadians = 0
): PlanarAesaConfiguration {
  if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(columns) || columns < 1 ||
    !Number.isFinite(phaseErrorRadians)) {
    throw new RangeError("Synthetic AESA test-array inputs are invalid.");
  }
  const elements: AesaElementState[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      elements.push({ row, column, amplitudeWeight: 1, phaseErrorRadians, healthFraction: 1 });
    }
  }
  return {
    rows,
    columns,
    spacingXInWavelengths: 0.5,
    spacingYInWavelengths: 0.5,
    elements
  };
}
