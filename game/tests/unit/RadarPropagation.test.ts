import { describe, expect, it } from "vitest";
import {
  computeAtmosphericPathTransmission,
  estimateKnifeEdgeDiffractionLossDb,
  evaluateTerrainLineOfSight
} from "../../src/physics/radar/RadarPropagation.js";

describe("radar terrain and propagation", () => {
  it("distinguishes geometric visibility from first-Fresnel clearance", () => {
    const result = evaluateTerrainLineOfSight({
      rangeM: 10_000,
      radarAntennaHeightM: 100,
      targetAntennaHeightM: 100,
      wavelengthM: 0.03,
      effectiveEarthRadiusFactor: 4 / 3,
      requiredFirstFresnelClearanceFraction: 0.6,
      terrainProfile: [{ distanceFromRadarM: 1000, terrainElevationM: 99 }]
    });
    expect(result.geometricallyVisible).toBe(true);
    expect(result.firstFresnelClear).toBe(false);
    expect(result.minimumFresnelClearanceFraction).toBeLessThan(0.6);
  });

  it("detects terrain blockage including effective earth curvature", () => {
    const result = evaluateTerrainLineOfSight({
      rangeM: 100_000,
      radarAntennaHeightM: 200,
      targetAntennaHeightM: 200,
      wavelengthM: 0.03,
      effectiveEarthRadiusFactor: 4 / 3,
      requiredFirstFresnelClearanceFraction: 0.6,
      terrainProfile: [{ distanceFromRadarM: 50_000, terrainElevationM: 100 }]
    });
    expect(result.geometricallyVisible).toBe(false);
    expect(result.obstructingDistanceM).toBe(50_000);
    expect(result.minimumTerrainClearanceM).toBeLessThan(0);
  });

  it("applies one-way attenuation twice to monostatic echo power", () => {
    const result = computeAtmosphericPathTransmission({
      rangeM: 50_000,
      oxygenWaterVapourAttenuationDbPerKm: 0.1,
      rainSpecificAttenuationDbPerKm: 0.5,
      cloudFogAttenuationDbPerKm: 0.1,
      foliageAttenuationDbPerKm: 0,
      additionalOneWayLossDb: 1
    });
    expect(result.oneWayAttenuationDb).toBeCloseTo(36, 10);
    expect(result.twoWayTransmissionFraction).toBeCloseTo(10 ** (-7.2), 14);
    expect(result.receivedPowerFraction).toBe(result.twoWayTransmissionFraction);
  });

  it("provides a finite knife-edge diffraction screening estimate", () => {
    const loss = estimateKnifeEdgeDiffractionLossDb(0.03, 5000, 10000, 0);
    expect(loss).toBeGreaterThan(5);
    expect(loss).toBeLessThan(7);
  });
});
