import {
  BOLTZMANN_CONSTANT_J_PER_K,
  SPEED_OF_LIGHT_MPS,
  type AntennaPatternProfile
} from "../../physics/radar/RadarPhysics.js";
import type { SeededRandom } from "../../core/random/SeededRandom.js";
import type { RadarRangeDopplerFrame } from "./RadarProcessing.js";
import type { PulseDopplerWaveform } from "./PulseDopplerSimulation.js";

export interface RadarWaveformConfiguration {
  readonly family: "pulse" | "pulse-doppler";
  readonly centerFrequencyHz: number;
  readonly pulseWidthSeconds: number;
  readonly pulseRepetitionFrequencyHz: number;
  readonly receiverBandwidthHz: number;
  readonly coherentProcessingIntervalSeconds: number;
  readonly coherentIntegration: boolean;
}

export interface RadarReceiverConfiguration {
  readonly systemTemperatureK: number;
  readonly noiseFigureDb: number;
  readonly clutterPowerPerCellW: number;
}

export interface RadarEquipmentConfiguration {
  readonly waveform: RadarWaveformConfiguration;
  readonly receiver: RadarReceiverConfiguration;
  readonly antenna: AntennaPatternProfile;
  readonly rangeBinCount: number;
  readonly dopplerBinCount: number;
  readonly maximumDutyCycle: number;
  /** Optional sample-level pulse-Doppler path; omitted for the faster reduced-order frame model. */
  readonly pulseDomain?: Omit<PulseDopplerWaveform,
    "centerFrequencyHz" | "pulseWidthSeconds" | "pulseRepetitionIntervalSeconds" |
    "coherentPulseCount" | "rangeBinCount" | "receiverNoisePowerPerComplexSampleW" |
    "interferencePowerPerComplexSampleW"> & {
      readonly coherentPulseCount: number;
      readonly rangeBinCount: number;
    };
}

export interface RadarHardwareThermalModel {
  readonly warmupSeconds: number;
  readonly maximumOperatingTemperatureK: number;
  readonly thermalCapacityJPerK: number;
  readonly heatFractionOfElectricalInput: number;
  readonly maximumHeatRejectionW: number;
  readonly minimumPowerFraction: number;
}

export type RadarHardwareMode = "off" | "warming" | "ready" | "degraded" | "thermal-protect" | "failed";

export interface RadarHardwareState {
  readonly mode: RadarHardwareMode;
  readonly temperatureK: number;
  readonly warmupRemainingSeconds: number;
  readonly hardwareHealthFraction: number;
  readonly operatingTimeSeconds: number;
}

export interface RadarResourceSnapshot {
  readonly enabled: boolean;
  readonly ambientTemperatureK: number;
  readonly availableElectricalPowerW: number;
  readonly requestedElectricalPowerW: number;
  readonly availableCoolingPowerW: number;
}

export interface RadarHardwareStep {
  readonly state: RadarHardwareState;
  readonly transmitPowerFraction: number;
  readonly coolingFraction: number;
  readonly emissionAvailable: boolean;
}

export interface RadarSceneReturn {
  /** RF return values from the shared propagation/scattering layer; no entity ID is carried. */
  readonly rangeM: number;
  readonly rangeRateMps: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly receivedPowerW: number;
  readonly phaseRadians?: number;
}

export interface RadarRangeDopplerScene {
  readonly returns: readonly RadarSceneReturn[];
  readonly interferencePowerW: number;
  readonly additionalClutterPowerWPerCell?: number;
  readonly acquiredAtSeconds: number;
  readonly beamAzimuthDeg: number;
  readonly beamElevationDeg: number;
}

export interface RadarWaveformDerived {
  readonly wavelengthM: number;
  readonly rangeResolutionM: number;
  readonly unambiguousRangeM: number;
  readonly unambiguousRadialVelocityMps: number;
  readonly radialVelocityResolutionMps: number;
  readonly coherentPulsesPerCpi: number;
  readonly pulseDutyCycle: number;
  readonly processingGainLinear: number;
}

/** Validates pulse timing and derives range/Doppler ambiguity and resolution. */
export function deriveRadarWaveform(
  waveform: RadarWaveformConfiguration,
  maximumDutyCycle: number
): RadarWaveformDerived {
  const positive = [
    waveform.centerFrequencyHz,
    waveform.pulseWidthSeconds,
    waveform.pulseRepetitionFrequencyHz,
    waveform.receiverBandwidthHz,
    waveform.coherentProcessingIntervalSeconds
  ];
  if (!positive.every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("Radar waveform frequency, timing and bandwidth must be positive and finite.");
  }
  if (!Number.isFinite(maximumDutyCycle) || maximumDutyCycle <= 0 || maximumDutyCycle > 1) {
    throw new RangeError("Maximum duty cycle must be in (0, 1].");
  }
  const wavelengthM = SPEED_OF_LIGHT_MPS / waveform.centerFrequencyHz;
  const pulseDutyCycle = waveform.pulseWidthSeconds * waveform.pulseRepetitionFrequencyHz;
  if (pulseDutyCycle > maximumDutyCycle + 1e-12) {
    throw new RangeError("Configured pulse width and PRF exceed the equipment duty-cycle limit.");
  }
  const coherentPulsesPerCpi = Math.max(
    1,
    Math.floor(waveform.pulseRepetitionFrequencyHz * waveform.coherentProcessingIntervalSeconds)
  );
  return {
    wavelengthM,
    rangeResolutionM: SPEED_OF_LIGHT_MPS / (2 * waveform.receiverBandwidthHz),
    unambiguousRangeM: SPEED_OF_LIGHT_MPS / (2 * waveform.pulseRepetitionFrequencyHz),
    unambiguousRadialVelocityMps: wavelengthM * waveform.pulseRepetitionFrequencyHz / 4,
    radialVelocityResolutionMps: wavelengthM / (2 * waveform.coherentProcessingIntervalSeconds),
    coherentPulsesPerCpi,
    pulseDutyCycle,
    processingGainLinear: waveform.coherentIntegration
      ? coherentPulsesPerCpi
      : Math.sqrt(coherentPulsesPerCpi)
  };
}

/** Advances radar warm-up and thermal/power state using explicit resource offers. */
export function advanceRadarHardware(
  previous: RadarHardwareState,
  model: RadarHardwareThermalModel,
  resources: RadarResourceSnapshot,
  deltaTimeSeconds: number
): RadarHardwareStep {
  if (!Number.isFinite(deltaTimeSeconds) || deltaTimeSeconds <= 0 ||
    !Number.isFinite(previous.temperatureK) || !Number.isFinite(previous.warmupRemainingSeconds) ||
    previous.warmupRemainingSeconds < 0 || !Number.isFinite(previous.hardwareHealthFraction) ||
    previous.hardwareHealthFraction < 0 || previous.hardwareHealthFraction > 1 ||
    !Number.isFinite(previous.operatingTimeSeconds) || previous.operatingTimeSeconds < 0) {
    throw new RangeError("Radar hardware state or time step is invalid.");
  }
  if (![model.warmupSeconds, model.maximumOperatingTemperatureK, model.thermalCapacityJPerK,
    model.heatFractionOfElectricalInput, model.maximumHeatRejectionW, model.minimumPowerFraction].every(Number.isFinite) ||
    model.warmupSeconds < 0 || model.maximumOperatingTemperatureK <= 0 ||
    model.thermalCapacityJPerK <= 0 || model.heatFractionOfElectricalInput < 0 ||
    model.heatFractionOfElectricalInput > 1 || model.maximumHeatRejectionW < 0 ||
    model.minimumPowerFraction < 0 || model.minimumPowerFraction > 1) {
    throw new RangeError("Radar thermal model is invalid.");
  }
  if (![resources.ambientTemperatureK, resources.availableElectricalPowerW,
    resources.requestedElectricalPowerW, resources.availableCoolingPowerW].every(Number.isFinite) ||
    resources.ambientTemperatureK <= 0 || resources.availableElectricalPowerW < 0 ||
    resources.requestedElectricalPowerW < 0 || resources.availableCoolingPowerW < 0) {
    throw new RangeError("Radar resource snapshot is invalid.");
  }

  const powerFraction = resources.requestedElectricalPowerW <= 0
    ? 0
    : Math.min(1, resources.availableElectricalPowerW / resources.requestedElectricalPowerW);
  const coolingFraction = Math.min(
    1,
    model.maximumHeatRejectionW > 0 ? resources.availableCoolingPowerW / model.maximumHeatRejectionW : 0
  );
  const powerAdequate = powerFraction >= model.minimumPowerFraction;
  const healthAvailable = previous.hardwareHealthFraction > 0;
  const active = resources.enabled && powerAdequate && healthAvailable;
  const warmupRemainingSeconds = resources.enabled && powerAdequate && healthAvailable
    ? Math.max(0, previous.warmupRemainingSeconds - deltaTimeSeconds)
    : previous.warmupRemainingSeconds;
  const heatInputW = active
    ? resources.requestedElectricalPowerW * powerFraction * model.heatFractionOfElectricalInput
    : 0;
  const temperatureExcess = Math.max(0, previous.temperatureK - resources.ambientTemperatureK);
  const coolingW = Math.min(
    resources.availableCoolingPowerW,
    model.maximumHeatRejectionW
  ) * Math.min(1, temperatureExcess / Math.max(1, model.maximumOperatingTemperatureK - resources.ambientTemperatureK));
  const temperatureK = Math.max(
    resources.ambientTemperatureK,
    previous.temperatureK + ((heatInputW - coolingW) / model.thermalCapacityJPerK) * deltaTimeSeconds
  );
  const thermalMargin = Math.max(0, Math.min(1,
    (model.maximumOperatingTemperatureK - temperatureK) /
    Math.max(1, model.maximumOperatingTemperatureK * 0.05)
  ));
  const transmitPowerFraction = active && warmupRemainingSeconds === 0
    ? powerFraction * previous.hardwareHealthFraction * thermalMargin
    : 0;

  let mode: RadarHardwareMode;
  if (!resources.enabled) mode = "off";
  else if (!healthAvailable) mode = "failed";
  else if (!powerAdequate) mode = "degraded";
  else if (temperatureK >= model.maximumOperatingTemperatureK * 0.95) mode = "thermal-protect";
  else if (warmupRemainingSeconds > 0) mode = "warming";
  else if (powerFraction < 0.999 || coolingFraction < 0.999 || previous.hardwareHealthFraction < 0.999) mode = "degraded";
  else mode = "ready";

  const state: RadarHardwareState = {
    mode,
    temperatureK,
    warmupRemainingSeconds,
    hardwareHealthFraction: previous.hardwareHealthFraction,
    operatingTimeSeconds: previous.operatingTimeSeconds + (active ? deltaTimeSeconds : 0)
  };
  return {
    state,
    transmitPowerFraction,
    coolingFraction,
    emissionAvailable: transmitPowerFraction > 0 && mode !== "failed"
  };
}

/**
 * Builds a range-Doppler power frame from physical RF returns and receiver noise.
 * Noise is exponential per cell (square-law detected Gaussian noise); coherent
 * processing gain is applied to signal, not to a hidden detection shortcut.
 */
export function synthesizeRangeDopplerFrame(
  equipment: RadarEquipmentConfiguration,
  scene: RadarRangeDopplerScene,
  random: SeededRandom,
  transmitterPowerFraction: number
): RadarRangeDopplerFrame {
  const derived = deriveRadarWaveform(equipment.waveform, equipment.maximumDutyCycle);
  if (!Number.isInteger(equipment.rangeBinCount) || equipment.rangeBinCount < 3 ||
    !Number.isInteger(equipment.dopplerBinCount) || equipment.dopplerBinCount < 3) {
    throw new RangeError("Range-Doppler grid dimensions must be integers of at least three.");
  }
  if (!Number.isFinite(transmitterPowerFraction) || transmitterPowerFraction < 0 || transmitterPowerFraction > 1) {
    throw new RangeError("Transmitter power fraction must be within [0, 1].");
  }
  if (![scene.interferencePowerW, scene.acquiredAtSeconds, scene.beamAzimuthDeg, scene.beamElevationDeg].every(Number.isFinite) ||
    scene.interferencePowerW < 0 || scene.acquiredAtSeconds < 0) {
    throw new RangeError("Radar scene metadata is invalid.");
  }

  const rangeStartM = 0;
  const radialVelocityStartMps = -derived.unambiguousRadialVelocityMps;
  const powerBuffer = new Array<number>(equipment.rangeBinCount * equipment.dopplerBinCount);
  if (!Number.isFinite(equipment.receiver.systemTemperatureK) || equipment.receiver.systemTemperatureK <= 0 ||
    !Number.isFinite(equipment.receiver.noiseFigureDb) || equipment.receiver.noiseFigureDb < 0 ||
    !Number.isFinite(equipment.receiver.clutterPowerPerCellW) || equipment.receiver.clutterPowerPerCellW < 0) {
    throw new RangeError("Radar receiver configuration is invalid.");
  }
  const thermalNoiseW = BOLTZMANN_CONSTANT_J_PER_K *
    equipment.receiver.systemTemperatureK * equipment.waveform.receiverBandwidthHz *
    10 ** (equipment.receiver.noiseFigureDb / 10);
  const additionalClutterW = scene.additionalClutterPowerWPerCell ?? 0;
  const clutterW = equipment.receiver.clutterPowerPerCellW + additionalClutterW;
  if (![thermalNoiseW, clutterW, scene.interferencePowerW, additionalClutterW].every(Number.isFinite) ||
    thermalNoiseW < 0 || clutterW < 0 || additionalClutterW < 0) {
    throw new RangeError("Radar noise and clutter powers must be finite and non-negative.");
  }
  const meanNoisePerCellW = thermalNoiseW + clutterW + scene.interferencePowerW;
  const pulses = derived.processingGainLinear;
  for (let index = 0; index < powerBuffer.length; index += 1) {
    const uniform = Math.max(Number.MIN_VALUE, 1 - random.nextFloat());
    powerBuffer[index] = -Math.log(uniform) * meanNoisePerCellW;
  }

  for (const echo of scene.returns) {
    if (![echo.rangeM, echo.rangeRateMps, echo.azimuthDeg, echo.elevationDeg, echo.receivedPowerW].every(Number.isFinite) ||
      echo.rangeM < 0 || echo.receivedPowerW < 0) {
      throw new RangeError("Radar scene return is invalid.");
    }
    const rangeBin = Math.round((echo.rangeM - rangeStartM) / derived.rangeResolutionM);
    let foldedVelocity = echo.rangeRateMps;
    const ambiguityVelocity = 2 * derived.unambiguousRadialVelocityMps;
    if (ambiguityVelocity > 0) {
      foldedVelocity = ((foldedVelocity + derived.unambiguousRadialVelocityMps) % ambiguityVelocity +
        ambiguityVelocity) % ambiguityVelocity - derived.unambiguousRadialVelocityMps;
    }
    const dopplerBin = Math.round(
      (foldedVelocity - radialVelocityStartMps) / derived.radialVelocityResolutionMps
    );
    if (rangeBin < 0 || rangeBin >= equipment.rangeBinCount ||
      dopplerBin < 0 || dopplerBin >= equipment.dopplerBinCount) continue;
    // PhysicalRadarEcho already includes two-way transmit/receive antenna gain.
    const signalPowerW = echo.receivedPowerW * transmitterPowerFraction * pulses;
    const primaryIndex = rangeBin * equipment.dopplerBinCount + dopplerBin;
    powerBuffer[primaryIndex] = powerBuffer[primaryIndex]! + signalPowerW;
    const leakageFraction = equipment.waveform.family === "pulse-doppler" ? 0.08 : 0.02;
    for (const [rangeOffset, dopplerOffset, fraction] of [
      [-1, 0, leakageFraction],
      [1, 0, leakageFraction],
      [0, -1, leakageFraction * 0.5],
      [0, 1, leakageFraction * 0.5]
    ] as const) {
      const r = rangeBin + rangeOffset;
      const d = dopplerBin + dopplerOffset;
      if (r >= 0 && r < equipment.rangeBinCount && d >= 0 && d < equipment.dopplerBinCount) {
        const index = r * equipment.dopplerBinCount + d;
        powerBuffer[index] = powerBuffer[index]! + signalPowerW * fraction;
      }
    }
  }

  return {
    rangeBins: equipment.rangeBinCount,
    dopplerBins: equipment.dopplerBinCount,
    powerWatts: powerBuffer,
    rangeStartM,
    rangeResolutionM: derived.rangeResolutionM,
    radialVelocityStartMps,
    radialVelocityResolutionMps: derived.radialVelocityResolutionMps,
    beamAzimuthDeg: scene.beamAzimuthDeg,
    beamElevationDeg: scene.beamElevationDeg,
    acquiredAtSeconds: scene.acquiredAtSeconds,
    coherentProcessingIntervalSeconds: equipment.waveform.coherentProcessingIntervalSeconds,
    wavelengthM: derived.wavelengthM,
    horizontalBeamwidthDeg: equipment.antenna.horizontalHalfPowerBeamwidthDeg,
    verticalBeamwidthDeg: equipment.antenna.verticalHalfPowerBeamwidthDeg
  };
}

