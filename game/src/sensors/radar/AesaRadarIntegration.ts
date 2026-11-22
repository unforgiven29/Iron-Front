import {
  computePhysicalRadarEcho,
  type PhysicalRadarEcho,
  type PhysicalRadarEchoRequest
} from "../../physics/radar/RadarPhysics.js";
import {
  evaluatePlanarAesaArrayFactor,
  type AesaArrayFactorResult,
  type PlanarAesaConfiguration
} from "./AesaArray.js";

export interface AesaRadarEchoRequest {
  readonly physical: Omit<
    PhysicalRadarEchoRequest,
    "transmitArrayFactorRelativeGainDb" | "receiveArrayFactorRelativeGainDb"
  >;
  readonly array: PlanarAesaConfiguration;
  readonly transmitSteeringAzimuthDeg: number;
  readonly transmitSteeringElevationDeg: number;
  readonly receiveSteeringAzimuthDeg: number;
  readonly receiveSteeringElevationDeg: number;
}

export interface AesaRadarEchoResult {
  readonly echo: PhysicalRadarEcho;
  readonly transmitArray: AesaArrayFactorResult;
  readonly receiveArray: AesaArrayFactorResult;
}

/**
 * Couples element-level T/R module state and electronic steering into the physical
 * monostatic radar equation. Peak gain in the antenna profile is the ideal coherent
 * array peak; the evaluated array-factor ratios replace the smooth envelope for
 * this call so the same main-beam loss is not counted twice.
 */
export function computeAesaRadarEcho(
  request: AesaRadarEchoRequest
): AesaRadarEchoResult {
  const transmitArray = evaluatePlanarAesaArrayFactor(
    request.array,
    request.transmitSteeringAzimuthDeg,
    request.transmitSteeringElevationDeg,
    request.physical.azimuthDeg,
    request.physical.elevationDeg
  );
  const receiveArray = evaluatePlanarAesaArrayFactor(
    request.array,
    request.receiveSteeringAzimuthDeg,
    request.receiveSteeringElevationDeg,
    request.physical.azimuthDeg,
    request.physical.elevationDeg
  );
  const echo = computePhysicalRadarEcho({
    ...request.physical,
    transmitArrayFactorRelativeGainDb: transmitArray.relativeGainDb,
    receiveArrayFactorRelativeGainDb: receiveArray.relativeGainDb
  });
  return { echo, transmitArray, receiveArray };
}
