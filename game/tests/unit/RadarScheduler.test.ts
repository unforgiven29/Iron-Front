import { describe, expect, it } from "vitest";
import { scheduleRadarBeams, type RadarBeamTask } from "../../src/sensors/radar/RadarScheduler.js";

const tasks: readonly RadarBeamTask[] = [
  { id: "low", azimuthDeg: 15, elevationDeg: 0, dwellSeconds: 0.01, priority: 1, mode: "search" },
  { id: "high", azimuthDeg: 0, elevationDeg: 0, dwellSeconds: 0.01, priority: 10, mode: "track" }
];

const resources = {
  transmitPowerFraction: 1,
  coolingFraction: 1,
  availableTimeFraction: 1,
  temperatureK: 300,
  maximumOperatingTemperatureK: 400
};

describe("radar beam resource scheduling", () => {
  it("uses deterministic priority ordering and mechanical slew time", () => {
    const schedule = scheduleRadarBeams(tasks, {
      architecture: "mechanical",
      maximumConcurrentBeams: 1,
      independentTransmitChannels: 1,
      mechanicalAzimuthSlewDegPerSecond: 30,
      mechanicalElevationSlewDegPerSecond: 20
    }, resources, 1);
    expect(schedule.beams[0]!.id).toBe("high");
    expect(schedule.beams[1]!.id).toBe("low");
    expect(schedule.beams[1]!.startOffsetSeconds).toBeGreaterThan(0.4);
  });

  it("limits AESA concurrent beams by healthy T/R modules and channels", () => {
    const schedule = scheduleRadarBeams(tasks, {
      architecture: "aesa",
      maximumConcurrentBeams: 4,
      independentTransmitChannels: 2,
      totalTrModules: 64,
      minimumTrModulesPerBeam: 16,
      electronicSteeringSettlingSeconds: 0.001
    }, { ...resources, healthyTrModules: 32 }, 1);
    expect(schedule.concurrentBeamCapacity).toBe(2);
    expect(schedule.beams).toHaveLength(2);
    expect(schedule.beams[0]!.assignedChannel).not.toBe(schedule.beams[1]!.assignedChannel);
  });

  it("rejects emissions when power or thermal resources fail", () => {
    const noPower = scheduleRadarBeams(tasks, {
      architecture: "pesa",
      maximumConcurrentBeams: 1,
      independentTransmitChannels: 1
    }, { ...resources, transmitPowerFraction: 0 }, 1);
    expect(noPower.beams).toHaveLength(0);
    expect(noPower.rejected.every((item) => item.reason === "no-power")).toBe(true);
  });
});
