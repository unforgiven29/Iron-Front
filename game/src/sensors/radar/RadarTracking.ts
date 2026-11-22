import type { RadarMeasurement } from "./RadarProcessing.js";

export type RadarTrackStatus = "tentative" | "confirmed" | "coasting";

export interface RadarTrack {
  readonly id: string;
  readonly status: RadarTrackStatus;
  readonly positionLocalM: readonly [number, number, number];
  readonly velocityLocalMps: readonly [number, number, number];
  readonly positionVarianceM2: number;
  readonly velocityVarianceM2PerS2: number;
  readonly lastMeasurementTimeSeconds: number;
  readonly lastUpdateTimeSeconds: number;
  readonly hitCount: number;
  readonly missedUpdates: number;
  readonly lastRangeRateMps: number;
}

export interface RadarTrackingConfiguration {
  readonly alpha: number;
  readonly beta: number;
  readonly initialPositionVarianceM2: number;
  readonly initialVelocityVarianceM2PerS2: number;
  readonly minimumHitsToConfirm: number;
  readonly maximumMissedUpdates: number;
  readonly baseGateRadiusM: number;
  readonly uncertaintyGateScale: number;
  readonly coastProcessNoiseM2PerSecond: number;
}

export interface RadarTrackingUpdate {
  readonly tracks: readonly RadarTrack[];
  readonly associatedMeasurementIds: readonly string[];
  readonly unassociatedMeasurementIds: readonly string[];
}

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(name + " must be positive and finite.");
}

function toLocalPosition(
  rangeM: number,
  azimuthDeg: number,
  elevationDeg: number
): readonly [number, number, number] {
  const azimuth = azimuthDeg * Math.PI / 180;
  const elevation = elevationDeg * Math.PI / 180;
  const horizontal = rangeM * Math.cos(elevation);
  return [
    horizontal * Math.sin(azimuth),
    horizontal * Math.cos(azimuth),
    rangeM * Math.sin(elevation)
  ];
}

function distanceSquared(a: readonly number[], b: readonly number[]): number {
  return (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;
}

/** Nearest-neighbour association and alpha-beta estimation in the radar-local ENU frame. */
export function updateRadarTracks(
  previousTracks: readonly RadarTrack[],
  measurements: readonly RadarMeasurement[],
  timeSeconds: number,
  config: RadarTrackingConfiguration
): RadarTrackingUpdate {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) throw new RangeError("Time must be finite and non-negative.");
  if (!Number.isFinite(config.alpha) || config.alpha <= 0 || config.alpha > 1 ||
    !Number.isFinite(config.beta) || config.beta < 0 || config.beta > 1) {
    throw new RangeError("Alpha and beta gains must be in their documented ranges.");
  }
  assertFinitePositive(config.initialPositionVarianceM2, "Initial position variance");
  assertFinitePositive(config.initialVelocityVarianceM2PerS2, "Initial velocity variance");
  assertFinitePositive(config.minimumHitsToConfirm, "Minimum hits");
  if (!Number.isInteger(config.minimumHitsToConfirm) ||
    !Number.isInteger(config.maximumMissedUpdates) || config.maximumMissedUpdates < 0 ||
    !Number.isFinite(config.baseGateRadiusM) || config.baseGateRadiusM <= 0 ||
    !Number.isFinite(config.uncertaintyGateScale) || config.uncertaintyGateScale < 0 ||
    !Number.isFinite(config.coastProcessNoiseM2PerSecond) || config.coastProcessNoiseM2PerSecond < 0) {
    throw new RangeError("Tracking gates, lifecycle counts and process noise are invalid.");
  }

  const predicted = previousTracks.map((track) => {
    const dt = Math.max(0, timeSeconds - track.lastUpdateTimeSeconds);
    const position: readonly [number, number, number] = [
      track.positionLocalM[0] + track.velocityLocalMps[0] * dt,
      track.positionLocalM[1] + track.velocityLocalMps[1] * dt,
      track.positionLocalM[2] + track.velocityLocalMps[2] * dt
    ];
    return {
      track,
      dt,
      position,
      positionVarianceM2: track.positionVarianceM2 + track.velocityVarianceM2PerS2 * dt * dt +
        config.coastProcessNoiseM2PerSecond * dt
    };
  });

  const assignedTracks = new Set<string>();
  const usedMeasurements = new Set<string>();
  const nextTracks: RadarTrack[] = [];
  const associatedMeasurementIds: string[] = [];
  let nextId = previousTracks.reduce((maximum, track) => {
    const parsed = Number(track.id.replace(/^rt-/, ""));
    return Number.isSafeInteger(parsed) ? Math.max(maximum, parsed) : maximum;
  }, 0) + 1;

  for (const item of predicted) {
    let bestIndex = -1;
    let bestDistanceSquared = Infinity;
    for (let index = 0; index < measurements.length; index += 1) {
      const measurement = measurements[index]!;
      if (usedMeasurements.has(measurement.measurementId) ||
        measurement.acquiredAtSeconds > timeSeconds + 1e-9) continue;
      const measuredPosition = toLocalPosition(
        measurement.rangeM,
        measurement.azimuthDeg,
        measurement.elevationDeg
      );
      const residualSquared = distanceSquared(item.position, measuredPosition);
      const measurementVariance = Math.max(1, measurement.rangeUncertaintyM ** 2);
      const gateRadius = config.baseGateRadiusM + config.uncertaintyGateScale *
        Math.sqrt(item.positionVarianceM2 + measurementVariance);
      if (residualSquared <= gateRadius * gateRadius && residualSquared < bestDistanceSquared) {
        bestIndex = index;
        bestDistanceSquared = residualSquared;
      }
    }

    if (bestIndex < 0) {
      const missedUpdates = item.track.missedUpdates + 1;
      if (missedUpdates <= config.maximumMissedUpdates) {
        nextTracks.push({
          ...item.track,
          status: "coasting",
          positionLocalM: item.position,
          positionVarianceM2: item.positionVarianceM2,
          lastUpdateTimeSeconds: timeSeconds,
          missedUpdates
        });
      }
      continue;
    }

    const measurement = measurements[bestIndex]!;
    const measuredPosition = toLocalPosition(
      measurement.rangeM,
      measurement.azimuthDeg,
      measurement.elevationDeg
    );
    const residual: readonly [number, number, number] = [
      measuredPosition[0] - item.position[0],
      measuredPosition[1] - item.position[1],
      measuredPosition[2] - item.position[2]
    ];
    const dt = Math.max(1e-6, item.dt);
    const position: readonly [number, number, number] = [
      item.position[0] + config.alpha * residual[0],
      item.position[1] + config.alpha * residual[1],
      item.position[2] + config.alpha * residual[2]
    ];
    const velocity: readonly [number, number, number] = [
      item.track.velocityLocalMps[0] + (config.beta / dt) * residual[0],
      item.track.velocityLocalMps[1] + (config.beta / dt) * residual[1],
      item.track.velocityLocalMps[2] + (config.beta / dt) * residual[2]
    ];
    const hitCount = item.track.hitCount + 1;
    nextTracks.push({
      ...item.track,
      status: hitCount >= config.minimumHitsToConfirm ? "confirmed" : "tentative",
      positionLocalM: position,
      velocityLocalMps: velocity,
      positionVarianceM2: Math.max(1, item.positionVarianceM2 * (1 - config.alpha)),
      velocityVarianceM2PerS2: Math.max(0.25, item.track.velocityVarianceM2PerS2 * (1 - config.beta)),
      lastMeasurementTimeSeconds: measurement.acquiredAtSeconds,
      lastUpdateTimeSeconds: timeSeconds,
      hitCount,
      missedUpdates: 0,
      lastRangeRateMps: measurement.radialVelocityMps
    });
    assignedTracks.add(item.track.id);
    usedMeasurements.add(measurement.measurementId);
    associatedMeasurementIds.push(measurement.measurementId);
  }

  for (const measurement of measurements) {
    if (usedMeasurements.has(measurement.measurementId) || measurement.acquiredAtSeconds > timeSeconds + 1e-9) continue;
    const position = toLocalPosition(measurement.rangeM, measurement.azimuthDeg, measurement.elevationDeg);
    const id = "rt-" + nextId;
    nextId += 1;
    nextTracks.push({
      id,
      status: config.minimumHitsToConfirm <= 1 ? "confirmed" : "tentative",
      positionLocalM: position,
      velocityLocalMps: [
        position[0] / Math.max(measurement.rangeM, 1) * measurement.radialVelocityMps,
        position[1] / Math.max(measurement.rangeM, 1) * measurement.radialVelocityMps,
        position[2] / Math.max(measurement.rangeM, 1) * measurement.radialVelocityMps
      ],
      positionVarianceM2: Math.max(1, measurement.rangeUncertaintyM ** 2),
      velocityVarianceM2PerS2: config.initialVelocityVarianceM2PerS2,
      lastMeasurementTimeSeconds: measurement.acquiredAtSeconds,
      lastUpdateTimeSeconds: timeSeconds,
      hitCount: 1,
      missedUpdates: 0,
      lastRangeRateMps: measurement.radialVelocityMps
    });
    usedMeasurements.add(measurement.measurementId);
  }

  const unassociatedMeasurementIds = measurements
    .filter((measurement) => !associatedMeasurementIds.includes(measurement.measurementId))
    .map((measurement) => measurement.measurementId);
  nextTracks.sort((a, b) => a.id.localeCompare(b.id));
  return { tracks: nextTracks, associatedMeasurementIds, unassociatedMeasurementIds };
}
