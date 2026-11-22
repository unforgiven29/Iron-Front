import { describe, expect, it } from "vitest";
import { createUniformAesaTestArray, evaluatePlanarAesaArrayFactor } from "../../src/sensors/radar/AesaArray.js";
import { computeAesaRadarEcho } from "../../src/sensors/radar/AesaRadarIntegration.js";

describe("finite planar AESA array factor", () => {
  it("forms a coherent main beam at its steering direction", () => {
    const config = createUniformAesaTestArray(8, 8);
    const result = evaluatePlanarAesaArrayFactor(config, 0, 0, 0, 0);
    expect(result.usable).toBe(true);
    expect(result.relativeGainDb).toBeCloseTo(0, 10);
    expect(result.effectiveApertureFraction).toBe(1);
  });

  it("steers the coherent main beam and includes module failures", () => {
    const config = createUniformAesaTestArray(8, 8);
    const steered = evaluatePlanarAesaArrayFactor(config, 20, 5, 20, 5);
    const broadside = evaluatePlanarAesaArrayFactor(config, 20, 5, 0, 0);
    expect(steered.relativeGainDb).toBeGreaterThan(broadside.relativeGainDb);

    const degraded = {
      ...config,
      elements: config.elements.map((element, index) => ({
        ...element,
        healthFraction: index % 2 === 0 ? 0 : 1
      }))
    };
    const failedModules = evaluatePlanarAesaArrayFactor(degraded, 0, 0, 0, 0);
    expect(failedModules.healthyElementCount).toBe(32);
    expect(failedModules.effectiveApertureFraction).toBeCloseTo(0.5, 10);
    expect(failedModules.relativeGainDb).toBeCloseTo(-6.0206, 3);
  });

  it("couples electronic steering and module health into the radar link budget", () => {
    const array = createUniformAesaTestArray(16, 16);
    const physical = {
      transmitPowerW: 10_000,
      frequencyHz: 10e9,
      antenna: {
        peakGainDb: 40,
        horizontalHalfPowerBeamwidthDeg: 40,
        verticalHalfPowerBeamwidthDeg: 40,
        firstSidelobeLevelDb: -13,
        sidelobeFloorDb: -40,
        backlobeLevelDb: -50
      },
      targetRcsByAspect: [{ aspectDeg: 0, rcsM2: 1 }],
      targetAspectDeg: 0,
      rangeM: 10_000,
      rangeRateMps: 0,
      azimuthDeg: 10,
      elevationDeg: 0,
      beamAzimuthDeg: 10,
      beamElevationDeg: 0
    };
    const incorrectlySteered = computeAesaRadarEcho({
      physical,
      array,
      transmitSteeringAzimuthDeg: 0,
      transmitSteeringElevationDeg: 0,
      receiveSteeringAzimuthDeg: 0,
      receiveSteeringElevationDeg: 0
    });
    const correctlySteered = computeAesaRadarEcho({
      physical,
      array,
      transmitSteeringAzimuthDeg: 10,
      transmitSteeringElevationDeg: 0,
      receiveSteeringAzimuthDeg: 10,
      receiveSteeringElevationDeg: 0
    });
    expect(correctlySteered.echo.receivedPowerW)
      .toBeGreaterThan(incorrectlySteered.echo.receivedPowerW);
    expect(correctlySteered.transmitArray.relativeGainDb).toBeCloseTo(0, 8);
  });

  it("rejects invalid and duplicate element locations", () => {
    const config = createUniformAesaTestArray(2, 2);
    const duplicate = { ...config, elements: [config.elements[0]!, ...config.elements.slice(1).map((item) => ({ ...item, row: 0, column: 0 }))] };
    expect(() => evaluatePlanarAesaArrayFactor(duplicate, 0, 0, 0, 0)).toThrow(RangeError);
  });
});
