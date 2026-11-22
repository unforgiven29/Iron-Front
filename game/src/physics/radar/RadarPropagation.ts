export interface TerrainElevationSample {
  /** Distance along the radar-to-target path from the radar phase centre. */
  readonly distanceFromRadarM: number;
  /** Terrain elevation above the same vertical datum as both antenna heights. */
  readonly terrainElevationM: number;
}

export interface TerrainLineOfSightRequest {
  readonly rangeM: number;
  readonly radarAntennaHeightM: number;
  readonly targetAntennaHeightM: number;
  readonly wavelengthM: number;
  readonly effectiveEarthRadiusFactor: number;
  readonly terrainProfile: readonly TerrainElevationSample[];
  readonly requiredFirstFresnelClearanceFraction: number;
}

export interface TerrainLineOfSightResult {
  readonly geometricallyVisible: boolean;
  readonly firstFresnelClear: boolean;
  readonly minimumTerrainClearanceM: number;
  readonly minimumFresnelClearanceFraction: number;
  readonly obstructingDistanceM: number | null;
  readonly sampleCount: number;
}

export interface AtmosphericPathRequest {
  readonly rangeM: number;
  readonly oxygenWaterVapourAttenuationDbPerKm: number;
  readonly rainSpecificAttenuationDbPerKm: number;
  readonly cloudFogAttenuationDbPerKm: number;
  readonly foliageAttenuationDbPerKm: number;
  readonly additionalOneWayLossDb: number;
}

export interface AtmosphericPathResult {
  readonly oneWayAttenuationDb: number;
  readonly oneWayTransmissionFraction: number;
  readonly twoWayTransmissionFraction: number;
  readonly receivedPowerFraction: number;
}

function validateNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(name + " must be finite and non-negative.");
  }
}

/**
 * Terrain/earth-curvature visibility using an effective-Earth-radius approximation.
 * The function also reports first-Fresnel clearance; a visible geometric ray may
 * still be diffraction-sensitive when the Fresnel zone is obstructed.
 */
export function evaluateTerrainLineOfSight(
  request: TerrainLineOfSightRequest
): TerrainLineOfSightResult {
  if (!Number.isFinite(request.rangeM) || request.rangeM <= 0 ||
    !Number.isFinite(request.radarAntennaHeightM) ||
    !Number.isFinite(request.targetAntennaHeightM) ||
    !Number.isFinite(request.wavelengthM) || request.wavelengthM <= 0 ||
    !Number.isFinite(request.effectiveEarthRadiusFactor) || request.effectiveEarthRadiusFactor <= 0 ||
    !Number.isFinite(request.requiredFirstFresnelClearanceFraction) ||
    request.requiredFirstFresnelClearanceFraction < 0 ||
    request.requiredFirstFresnelClearanceFraction > 1) {
    throw new RangeError("Terrain LOS geometry and refraction settings are invalid.");
  }

  const effectiveEarthRadiusM = 6_371_000 * request.effectiveEarthRadiusFactor;
  let previousDistance = -Infinity;
  let minimumTerrainClearanceM = Infinity;
  let minimumFresnelClearanceFraction = Infinity;
  let obstructingDistanceM: number | null = null;

  for (const sample of request.terrainProfile) {
    if (!Number.isFinite(sample.distanceFromRadarM) || !Number.isFinite(sample.terrainElevationM) ||
      sample.distanceFromRadarM <= previousDistance ||
      sample.distanceFromRadarM <= 0 || sample.distanceFromRadarM >= request.rangeM) {
      throw new RangeError("Terrain profile samples must be ordered strictly inside the path.");
    }
    previousDistance = sample.distanceFromRadarM;
    const fraction = sample.distanceFromRadarM / request.rangeM;
    const curvatureBulgeM = sample.distanceFromRadarM *
      (request.rangeM - sample.distanceFromRadarM) /
      (2 * effectiveEarthRadiusM);
    const directPathHeightM =
      request.radarAntennaHeightM +
      (request.targetAntennaHeightM - request.radarAntennaHeightM) * fraction -
      curvatureBulgeM;
    const clearanceM = directPathHeightM - sample.terrainElevationM;
    const fresnelRadiusM = Math.sqrt(
      request.wavelengthM * sample.distanceFromRadarM *
      (request.rangeM - sample.distanceFromRadarM) / request.rangeM
    );
    const fresnelFraction = fresnelRadiusM > 0 ? clearanceM / fresnelRadiusM : Infinity;
    minimumTerrainClearanceM = Math.min(minimumTerrainClearanceM, clearanceM);
    minimumFresnelClearanceFraction = Math.min(minimumFresnelClearanceFraction, fresnelFraction);
    if (clearanceM < 0 && obstructingDistanceM === null) {
      obstructingDistanceM = sample.distanceFromRadarM;
    }
  }

  if (request.terrainProfile.length === 0) {
    minimumTerrainClearanceM = Infinity;
    minimumFresnelClearanceFraction = Infinity;
  }
  const geometricallyVisible = obstructingDistanceM === null;
  return {
    geometricallyVisible,
    firstFresnelClear: geometricallyVisible &&
      minimumFresnelClearanceFraction >= request.requiredFirstFresnelClearanceFraction,
    minimumTerrainClearanceM,
    minimumFresnelClearanceFraction,
    obstructingDistanceM,
    sampleCount: request.terrainProfile.length
  };
}

/** Computes one-way atmospheric/foliage power transmission from supplied path coefficients. */
export function computeAtmosphericPathTransmission(
  request: AtmosphericPathRequest
): AtmosphericPathResult {
  if (!Number.isFinite(request.rangeM) || request.rangeM < 0) {
    throw new RangeError("Path range must be finite and non-negative.");
  }
  validateNonNegative(request.oxygenWaterVapourAttenuationDbPerKm, "Gas attenuation");
  validateNonNegative(request.rainSpecificAttenuationDbPerKm, "Rain attenuation");
  validateNonNegative(request.cloudFogAttenuationDbPerKm, "Cloud/fog attenuation");
  validateNonNegative(request.foliageAttenuationDbPerKm, "Foliage attenuation");
  validateNonNegative(request.additionalOneWayLossDb, "Additional one-way loss");

  const rangeKm = request.rangeM / 1000;
  const oneWayAttenuationDb = (
    request.oxygenWaterVapourAttenuationDbPerKm +
    request.rainSpecificAttenuationDbPerKm +
    request.cloudFogAttenuationDbPerKm +
    request.foliageAttenuationDbPerKm
  ) * rangeKm + request.additionalOneWayLossDb;
  const oneWayTransmissionFraction = 10 ** (-oneWayAttenuationDb / 10);
  const twoWayTransmissionFraction = oneWayTransmissionFraction ** 2;
  return {
    oneWayAttenuationDb,
    oneWayTransmissionFraction,
    twoWayTransmissionFraction,
    receivedPowerFraction: twoWayTransmissionFraction
  };
}

/**
 * Simple knife-edge diffraction estimate for a single dominant obstruction.
 * It is a screening approximation; multiple-edge terrain needs a dedicated method.
 */
export function estimateKnifeEdgeDiffractionLossDb(
  wavelengthM: number,
  rangeToEdgeM: number,
  totalRangeM: number,
  obstacleClearanceAboveDirectPathM: number
): number {
  if (![wavelengthM, rangeToEdgeM, totalRangeM].every(Number.isFinite) ||
    wavelengthM <= 0 || rangeToEdgeM <= 0 || totalRangeM <= rangeToEdgeM ||
    !Number.isFinite(obstacleClearanceAboveDirectPathM)) {
    throw new RangeError("Knife-edge diffraction geometry is invalid.");
  }
  const fresnelRadiusM = Math.sqrt(
    wavelengthM * rangeToEdgeM * (totalRangeM - rangeToEdgeM) / totalRangeM
  );
  const diffractionParameter = Math.sqrt(2) * obstacleClearanceAboveDirectPathM / fresnelRadiusM;
  if (diffractionParameter <= -0.78) return 0;
  return 6.9 + 20 * Math.log10(
    Math.sqrt((diffractionParameter - 0.1) ** 2 + 1) +
    diffractionParameter - 0.1
  );
}
