export type RadarRfArchitecture = "mechanical" | "pesa" | "aesa";

export interface RadarBeamTask {
  readonly id: string;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly dwellSeconds: number;
  readonly priority: number;
  readonly mode: string;
}

export interface RadarSchedulerConfiguration {
  readonly architecture: RadarRfArchitecture;
  readonly maximumConcurrentBeams: number;
  readonly independentTransmitChannels: number;
  readonly totalTrModules?: number;
  readonly minimumTrModulesPerBeam?: number;
  readonly mechanicalAzimuthSlewDegPerSecond?: number;
  readonly mechanicalElevationSlewDegPerSecond?: number;
  readonly electronicSteeringSettlingSeconds?: number;
}

export interface RadarResourceAvailability {
  readonly transmitPowerFraction: number;
  readonly coolingFraction: number;
  readonly availableTimeFraction: number;
  readonly healthyTrModules?: number;
  readonly temperatureK: number;
  readonly maximumOperatingTemperatureK: number;
}

export interface ScheduledRadarBeam extends RadarBeamTask {
  readonly startOffsetSeconds: number;
  readonly endOffsetSeconds: number;
  readonly assignedChannel: number;
}

export interface RejectedRadarTask {
  readonly taskId: string;
  readonly reason: "invalid-task" | "no-power" | "thermal-limit" | "no-healthy-aperture" | "time-budget";
}

export interface RadarSchedule {
  readonly beams: readonly ScheduledRadarBeam[];
  readonly rejected: readonly RejectedRadarTask[];
  readonly concurrentBeamCapacity: number;
  readonly consumedTimeSeconds: number;
}

function assertFraction(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(name + " must be within [0, 1].");
  }
}

function absoluteAngleDifference(a: number, b: number): number {
  let delta = Math.abs(a - b) % 360;
  if (delta > 180) delta = 360 - delta;
  return delta;
}

function getConcurrency(
  config: RadarSchedulerConfiguration,
  resources: RadarResourceAvailability
): number {
  if (!Number.isInteger(config.maximumConcurrentBeams) || config.maximumConcurrentBeams < 1 ||
    !Number.isInteger(config.independentTransmitChannels) || config.independentTransmitChannels < 1) {
    throw new RangeError("Radar concurrency and transmit-channel counts must be positive integers.");
  }
  if (config.architecture !== "aesa") return 1;
  const totalModules = config.totalTrModules ?? 0;
  const minimumPerBeam = config.minimumTrModulesPerBeam ?? 0;
  const healthyModules = resources.healthyTrModules ?? 0;
  if (!Number.isInteger(totalModules) || totalModules < 1 ||
    !Number.isInteger(minimumPerBeam) || minimumPerBeam < 1 ||
    !Number.isInteger(healthyModules) || healthyModules < 0 || healthyModules > totalModules) return 0;
  return Math.max(0, Math.min(
    config.maximumConcurrentBeams,
    config.independentTransmitChannels,
    Math.floor(healthyModules / minimumPerBeam)
  ));
}

/**
 * Deterministic priority scheduler. Mechanical and PESA architectures retain a
 * single active beam; AESA capacity is bounded by channels and healthy T/R modules.
 * Task order is stable across platforms and independent of insertion order.
 */
export function scheduleRadarBeams(
  tasks: readonly RadarBeamTask[],
  config: RadarSchedulerConfiguration,
  resources: RadarResourceAvailability,
  frameDurationSeconds: number,
  currentPointing: { readonly azimuthDeg: number; readonly elevationDeg: number } = {
    azimuthDeg: 0,
    elevationDeg: 0
  }
): RadarSchedule {
  if (!Number.isFinite(frameDurationSeconds) || frameDurationSeconds <= 0) {
    throw new RangeError("Frame duration must be finite and greater than zero.");
  }
  assertFraction(resources.transmitPowerFraction, "Transmit power fraction");
  assertFraction(resources.coolingFraction, "Cooling fraction");
  assertFraction(resources.availableTimeFraction, "Available time fraction");
  if (!Number.isFinite(resources.temperatureK) || !Number.isFinite(resources.maximumOperatingTemperatureK) ||
    resources.maximumOperatingTemperatureK <= 0) {
    throw new RangeError("Radar temperatures must be finite and maximum operating temperature positive.");
  }

  const rejected: RejectedRadarTask[] = [];
  const valid: RadarBeamTask[] = [];
  const seenIds = new Set<string>();
  for (const task of tasks) {
    if (!task.id || seenIds.has(task.id) || ![task.azimuthDeg, task.elevationDeg, task.dwellSeconds, task.priority].every(Number.isFinite) ||
      task.dwellSeconds <= 0 || task.elevationDeg < -90 || task.elevationDeg > 90) {
      rejected.push({ taskId: task.id, reason: "invalid-task" });
      continue;
    }
    seenIds.add(task.id);
    valid.push(task);
  }

  if (resources.transmitPowerFraction <= 0) {
    for (const task of valid) rejected.push({ taskId: task.id, reason: "no-power" });
    return { beams: [], rejected, concurrentBeamCapacity: 0, consumedTimeSeconds: 0 };
  }
  if (resources.coolingFraction <= 0 || resources.temperatureK >= resources.maximumOperatingTemperatureK) {
    for (const task of valid) rejected.push({ taskId: task.id, reason: "thermal-limit" });
    return { beams: [], rejected, concurrentBeamCapacity: 0, consumedTimeSeconds: 0 };
  }

  const capacity = getConcurrency(config, resources);
  if (capacity === 0) {
    for (const task of valid) rejected.push({ taskId: task.id, reason: "no-healthy-aperture" });
    return { beams: [], rejected, concurrentBeamCapacity: 0, consumedTimeSeconds: 0 };
  }

  const sorted = [...valid].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const timeBudget = frameDurationSeconds * resources.availableTimeFraction;
  const channelEnds = Array.from({ length: capacity }, () => 0);
  const channelPointing = Array.from({ length: capacity }, () => currentPointing);
  const beams: ScheduledRadarBeam[] = [];
  for (const task of sorted) {
    let channel = 0;
    for (let index = 1; index < channelEnds.length; index += 1) {
      if (channelEnds[index]! < channelEnds[channel]!) channel = index;
    }
    let settlingSeconds = config.electronicSteeringSettlingSeconds ?? 0;
    if (config.architecture === "mechanical") {
      const azRate = config.mechanicalAzimuthSlewDegPerSecond ?? 0;
      const elRate = config.mechanicalElevationSlewDegPerSecond ?? 0;
      if (!Number.isFinite(azRate) || azRate <= 0 || !Number.isFinite(elRate) || elRate <= 0) {
        throw new RangeError("Mechanical scan requires positive finite azimuth and elevation slew rates.");
      }
      const previous = channelPointing[channel]!;
      settlingSeconds = Math.max(
        absoluteAngleDifference(previous.azimuthDeg, task.azimuthDeg) / azRate,
        Math.abs(previous.elevationDeg - task.elevationDeg) / elRate
      );
    } else if (!Number.isFinite(settlingSeconds) || settlingSeconds < 0) {
      throw new RangeError("Electronic steering settling time must be finite and non-negative.");
    }
    const startOffsetSeconds = channelEnds[channel]! + settlingSeconds;
    const endOffsetSeconds = startOffsetSeconds + task.dwellSeconds;
    if (endOffsetSeconds > timeBudget + 1e-12) {
      rejected.push({ taskId: task.id, reason: "time-budget" });
      continue;
    }
    beams.push({ ...task, startOffsetSeconds, endOffsetSeconds, assignedChannel: channel });
    channelEnds[channel] = endOffsetSeconds;
    channelPointing[channel] = { azimuthDeg: task.azimuthDeg, elevationDeg: task.elevationDeg };
  }

  return {
    beams,
    rejected,
    concurrentBeamCapacity: capacity,
    consumedTimeSeconds: channelEnds.length > 0 ? Math.max(...channelEnds) : 0
  };
}
