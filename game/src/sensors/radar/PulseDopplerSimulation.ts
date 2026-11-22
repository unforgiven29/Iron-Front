import type { SeededRandom } from "../../core/random/SeededRandom.js";
import { SPEED_OF_LIGHT_MPS } from "../../physics/radar/RadarPhysics.js";
import type { RadarRangeDopplerFrame } from "./RadarProcessing.js";

export interface PulseDopplerWaveform {
  readonly centerFrequencyHz: number;
  readonly sampleRateHz: number;
  readonly pulseWidthSeconds: number;
  readonly chirpBandwidthHz: number;
  readonly pulseRepetitionIntervalSeconds: number;
  readonly coherentPulseCount: number;
  readonly rangeStartM: number;
  readonly rangeBinCount: number;
  readonly fastTimeSampleCount: number;
  readonly receiverNoisePowerPerComplexSampleW: number;
  readonly interferencePowerPerComplexSampleW: number;
  readonly horizontalBeamwidthDeg: number;
  readonly verticalBeamwidthDeg: number;
}

export interface PulseDopplerScatterer {
  /** Physical echo power at the receiver after propagation and antenna gain. */
  readonly receivedPowerW: number;
  readonly rangeM: number;
  /** Positive range rate is receding. */
  readonly rangeRateMps: number;
  readonly phaseRadians: number;
}

export interface PulseDopplerInterferer {
  readonly receivedPowerW: number;
  /** Frequency offset from the radar's complex-baseband centre frequency. */
  readonly frequencyOffsetHz: number;
  readonly phaseRadians: number;
}

export interface PulseDopplerScene {
  readonly scatterers: readonly PulseDopplerScatterer[];
  readonly interferers: readonly PulseDopplerInterferer[];
  readonly acquiredAtSeconds: number;
  readonly beamAzimuthDeg: number;
  readonly beamElevationDeg: number;
}

export interface PulseDopplerDiagnostics {
  readonly pulseSampleCount: number;
  readonly cpiSeconds: number;
  readonly rangeSampleSpacingM: number;
  readonly theoreticalBandwidthResolutionM: number;
  readonly unambiguousRangeM: number;
  readonly unambiguousRadialVelocityMps: number;
  readonly generatedIqSampleCount: number;
  readonly clippedFastTimeSamples: number;
}

export interface PulseDopplerResult {
  readonly frame: RadarRangeDopplerFrame;
  /** Interleaved real/imaginary baseband samples, pulse-major. */
  readonly receivedIq: Float64Array;
  readonly diagnostics: PulseDopplerDiagnostics;
}

interface ComplexValue {
  readonly real: number;
  readonly imaginary: number;
}

function validateWaveform(waveform: PulseDopplerWaveform): number {
  const positive = [
    waveform.centerFrequencyHz,
    waveform.sampleRateHz,
    waveform.pulseWidthSeconds,
    waveform.pulseRepetitionIntervalSeconds,
    waveform.rangeBinCount,
    waveform.fastTimeSampleCount,
    waveform.horizontalBeamwidthDeg,
    waveform.verticalBeamwidthDeg
  ];
  if (!positive.every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isInteger(waveform.rangeBinCount) || !Number.isInteger(waveform.fastTimeSampleCount) ||
    !Number.isInteger(waveform.coherentPulseCount) || waveform.coherentPulseCount < 4 ||
    (waveform.coherentPulseCount & (waveform.coherentPulseCount - 1)) !== 0) {
    throw new RangeError("Waveform sample counts and timing must be positive; CPI pulse count must be a power of two >= 4.");
  }
  if (!Number.isFinite(waveform.chirpBandwidthHz) || waveform.chirpBandwidthHz < 0 ||
    waveform.chirpBandwidthHz > waveform.sampleRateHz ||
    waveform.pulseRepetitionIntervalSeconds <= waveform.pulseWidthSeconds ||
    !Number.isFinite(waveform.rangeStartM) || waveform.rangeStartM < 0 ||
    !Number.isFinite(waveform.receiverNoisePowerPerComplexSampleW) ||
    waveform.receiverNoisePowerPerComplexSampleW < 0 ||
    !Number.isFinite(waveform.interferencePowerPerComplexSampleW) ||
    waveform.interferencePowerPerComplexSampleW < 0) {
    throw new RangeError("Pulse-Doppler waveform or receiver parameters are invalid.");
  }
  const pulseSamples = Math.floor(waveform.pulseWidthSeconds * waveform.sampleRateHz);
  if (pulseSamples < 4) throw new RangeError("At least four complex samples are required in each pulse.");
  const startSample = Math.round(2 * waveform.rangeStartM * waveform.sampleRateHz / SPEED_OF_LIGHT_MPS);
  if (startSample + waveform.rangeBinCount + pulseSamples > waveform.fastTimeSampleCount) {
    throw new RangeError("Fast-time buffer is too short for the requested range gate and matched filter.");
  }
  return pulseSamples;
}

function gaussian(random: SeededRandom): number {
  const first = Math.max(Number.MIN_VALUE, 1 - random.nextFloat());
  const second = random.nextFloat();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function complexMultiply(
  aReal: number,
  aImaginary: number,
  bReal: number,
  bImaginary: number
): ComplexValue {
  return {
    real: aReal * bReal - aImaginary * bImaginary,
    imaginary: aReal * bImaginary + aImaginary * bReal
  };
}

/** In-place radix-2 complex FFT; forward transform uses the negative exponential. */
function fftRadix2(real: Float64Array, imaginary: Float64Array): void {
  const length = real.length;
  if (length !== imaginary.length || length < 2 || (length & (length - 1)) !== 0) {
    throw new RangeError("FFT requires equal power-of-two real and imaginary arrays.");
  }
  let j = 0;
  for (let i = 1; i < length; i += 1) {
    let bit = length >> 1;
    while ((j & bit) !== 0) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const realValue = real[i]!;
      real[i] = real[j]!;
      real[j] = realValue;
      const imaginaryValue = imaginary[i]!;
      imaginary[i] = imaginary[j]!;
      imaginary[j] = imaginaryValue;
    }
  }

  for (let blockSize = 2; blockSize <= length; blockSize *= 2) {
    const halfSize = blockSize / 2;
    const angleStep = -2 * Math.PI / blockSize;
    const stepReal = Math.cos(angleStep);
    const stepImaginary = Math.sin(angleStep);
    for (let blockStart = 0; blockStart < length; blockStart += blockSize) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      for (let offset = 0; offset < halfSize; offset += 1) {
        const evenIndex = blockStart + offset;
        const oddIndex = evenIndex + halfSize;
        const odd = complexMultiply(
          real[oddIndex]!,
          imaginary[oddIndex]!,
          twiddleReal,
          twiddleImaginary
        );
        const evenReal = real[evenIndex]!;
        const evenImaginary = imaginary[evenIndex]!;
        real[evenIndex] = evenReal + odd.real;
        imaginary[evenIndex] = evenImaginary + odd.imaginary;
        real[oddIndex] = evenReal - odd.real;
        imaginary[oddIndex] = evenImaginary - odd.imaginary;
        const nextTwiddleReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextTwiddleReal;
      }
    }
  }
}

/**
 * Generates pulse-by-pulse complex baseband returns, performs a matched-filter
 * range correlation and coherent Doppler FFT for every range sample. This is a
 * reduced-order single-channel LFM/rectangular-pulse model, not a full RF circuit,
 * ADC quantization, phase-noise or full-wave propagation solver.
 */
export function simulatePulseDopplerCpi(
  waveform: PulseDopplerWaveform,
  scene: PulseDopplerScene,
  random: SeededRandom
): PulseDopplerResult {
  const pulseSamples = validateWaveform(waveform);
  if (!Number.isFinite(scene.acquiredAtSeconds) || scene.acquiredAtSeconds < 0 ||
    !Number.isFinite(scene.beamAzimuthDeg) || !Number.isFinite(scene.beamElevationDeg) ||
    Math.abs(scene.beamElevationDeg) > 90) {
    throw new RangeError("Pulse-Doppler scene metadata is invalid.");
  }
  for (const scatterer of scene.scatterers) {
    if (![scatterer.receivedPowerW, scatterer.rangeM, scatterer.rangeRateMps, scatterer.phaseRadians].every(Number.isFinite) ||
      scatterer.receivedPowerW < 0 || scatterer.rangeM < 0) {
      throw new RangeError("Scatterer input is invalid.");
    }
  }
  for (const interferer of scene.interferers) {
    if (![interferer.receivedPowerW, interferer.frequencyOffsetHz, interferer.phaseRadians].every(Number.isFinite) ||
      interferer.receivedPowerW < 0 || Math.abs(interferer.frequencyOffsetHz) > waveform.sampleRateHz / 2) {
      throw new RangeError("Interferer input is invalid.");
    }
  }

  const pulseCount = waveform.coherentPulseCount;
  const fastTimeCount = waveform.fastTimeSampleCount;
  const totalComplexSamples = pulseCount * fastTimeCount;
  const receivedIq = new Float64Array(totalComplexSamples * 2);
  const noiseSigma = Math.sqrt(
    (waveform.receiverNoisePowerPerComplexSampleW + waveform.interferencePowerPerComplexSampleW) / 2
  );
  for (let index = 0; index < totalComplexSamples; index += 1) {
    receivedIq[2 * index] = noiseSigma * gaussian(random);
    receivedIq[2 * index + 1] = noiseSigma * gaussian(random);
  }

  const pri = waveform.pulseRepetitionIntervalSeconds;
  const wavelengthM = SPEED_OF_LIGHT_MPS / waveform.centerFrequencyHz;
  const chirpSlopeHzPerSecond = waveform.chirpBandwidthHz / waveform.pulseWidthSeconds;
  const templateReal = new Float64Array(pulseSamples);
  const templateImaginary = new Float64Array(pulseSamples);
  for (let sample = 0; sample < pulseSamples; sample += 1) {
    const centeredTime = (sample - (pulseSamples - 1) / 2) / waveform.sampleRateHz;
    const phase = waveform.chirpBandwidthHz > 0
      ? Math.PI * chirpSlopeHzPerSecond * centeredTime * centeredTime
      : 0;
    templateReal[sample] = Math.cos(phase);
    templateImaginary[sample] = Math.sin(phase);
  }

  const rangeStartSample = Math.round(
    2 * waveform.rangeStartM * waveform.sampleRateHz / SPEED_OF_LIGHT_MPS
  );
  for (let pulse = 0; pulse < pulseCount; pulse += 1) {
    const pulseTime = pulse * pri;
    const pulseBase = pulse * fastTimeCount * 2;
    for (const scatterer of scene.scatterers) {
      const echoStart = Math.round(
        2 * scatterer.rangeM * waveform.sampleRateHz / SPEED_OF_LIGHT_MPS
      );
      if (echoStart + pulseSamples > fastTimeCount) continue;
      const dopplerHz = -2 * scatterer.rangeRateMps / wavelengthM;
      const amplitude = Math.sqrt(scatterer.receivedPowerW);
      for (let sample = 0; sample < pulseSamples; sample += 1) {
        const centeredTime = (sample - (pulseSamples - 1) / 2) / waveform.sampleRateHz;
        const chirpPhase = waveform.chirpBandwidthHz > 0
          ? Math.PI * chirpSlopeHzPerSecond * centeredTime * centeredTime
          : 0;
        const phase = scatterer.phaseRadians + 2 * Math.PI * dopplerHz * (pulseTime + sample / waveform.sampleRateHz) + chirpPhase;
        const sampleIndex = pulseBase + (echoStart + sample) * 2;
        receivedIq[sampleIndex] += amplitude * Math.cos(phase);
        receivedIq[sampleIndex + 1] += amplitude * Math.sin(phase);
      }
    }
    for (const interferer of scene.interferers) {
      const amplitude = Math.sqrt(interferer.receivedPowerW);
      for (let sample = 0; sample < fastTimeCount; sample += 1) {
        const phase = interferer.phaseRadians +
          2 * Math.PI * interferer.frequencyOffsetHz * (pulseTime + sample / waveform.sampleRateHz);
        const sampleIndex = pulseBase + sample * 2;
        receivedIq[sampleIndex] += amplitude * Math.cos(phase);
        receivedIq[sampleIndex + 1] += amplitude * Math.sin(phase);
      }
    }
  }

  const matchedRangeReal = new Float64Array(pulseCount * waveform.rangeBinCount);
  const matchedRangeImaginary = new Float64Array(pulseCount * waveform.rangeBinCount);
  let clippedFastTimeSamples = 0;
  for (let pulse = 0; pulse < pulseCount; pulse += 1) {
    const pulseBase = pulse * fastTimeCount * 2;
    const matchedBase = pulse * waveform.rangeBinCount;
    for (let rangeBin = 0; rangeBin < waveform.rangeBinCount; rangeBin += 1) {
      const delaySample = rangeStartSample + rangeBin;
      if (delaySample + pulseSamples > fastTimeCount) {
        clippedFastTimeSamples += 1;
        continue;
      }
      let sumReal = 0;
      let sumImaginary = 0;
      for (let sample = 0; sample < pulseSamples; sample += 1) {
        const sampleIndex = pulseBase + (delaySample + sample) * 2;
        const sampleReal = receivedIq[sampleIndex]!;
        const sampleImaginary = receivedIq[sampleIndex + 1]!;
        const templateR = templateReal[sample]!;
        const templateI = -templateImaginary[sample]!;
        sumReal += sampleReal * templateR - sampleImaginary * templateI;
        sumImaginary += sampleReal * templateI + sampleImaginary * templateR;
      }
      matchedRangeReal[matchedBase + rangeBin] = sumReal / pulseSamples;
      matchedRangeImaginary[matchedBase + rangeBin] = sumImaginary / pulseSamples;
    }
  }

  const dopplerPower = new Array<number>(waveform.rangeBinCount * pulseCount).fill(0);
  for (let rangeBin = 0; rangeBin < waveform.rangeBinCount; rangeBin += 1) {
    const real = new Float64Array(pulseCount);
    const imaginary = new Float64Array(pulseCount);
    for (let pulse = 0; pulse < pulseCount; pulse += 1) {
      const index = pulse * waveform.rangeBinCount + rangeBin;
      real[pulse] = matchedRangeReal[index]!;
      imaginary[pulse] = matchedRangeImaginary[index]!;
    }
    fftRadix2(real, imaginary);
    for (let fftBin = 0; fftBin < pulseCount; fftBin += 1) {
      // Convert FFT frequency order into increasing positive-receding range-rate bins.
      const velocityBin = (pulseCount / 2 - fftBin + pulseCount) % pulseCount;
      const power = (real[fftBin]! ** 2 + imaginary[fftBin]! ** 2) / (pulseCount * pulseCount);
      dopplerPower[rangeBin * pulseCount + velocityBin] = power;
    }
  }

  const rangeSampleSpacingM = SPEED_OF_LIGHT_MPS / (2 * waveform.sampleRateHz);
  const cpiSeconds = pulseCount * pri;
  const rangeResolutionM = waveform.chirpBandwidthHz > 0
    ? SPEED_OF_LIGHT_MPS / (2 * waveform.chirpBandwidthHz)
    : rangeSampleSpacingM;
  const radialVelocityResolutionMps = wavelengthM / (2 * cpiSeconds);
  const unambiguousRadialVelocityMps = wavelengthM / (4 * pri);
  const unambiguousRangeM = SPEED_OF_LIGHT_MPS * pri / 2;
  const frame: RadarRangeDopplerFrame = {
    rangeBins: waveform.rangeBinCount,
    dopplerBins: pulseCount,
    powerWatts: dopplerPower,
    rangeStartM: waveform.rangeStartM,
    rangeResolutionM,
    rangeBinSpacingM: rangeSampleSpacingM,
    radialVelocityStartMps: -unambiguousRadialVelocityMps,
    radialVelocityResolutionMps,
    beamAzimuthDeg: scene.beamAzimuthDeg,
    beamElevationDeg: scene.beamElevationDeg,
    acquiredAtSeconds: scene.acquiredAtSeconds,
    coherentProcessingIntervalSeconds: cpiSeconds,
    wavelengthM,
    horizontalBeamwidthDeg: waveform.horizontalBeamwidthDeg,
    verticalBeamwidthDeg: waveform.verticalBeamwidthDeg
  };

  return {
    frame,
    receivedIq,
    diagnostics: {
      pulseSampleCount: pulseSamples,
      cpiSeconds,
      rangeSampleSpacingM,
      theoreticalBandwidthResolutionM: rangeResolutionM,
      unambiguousRangeM,
      unambiguousRadialVelocityMps,
      generatedIqSampleCount: totalComplexSamples,
      clippedFastTimeSamples
    }
  };
}

/** Exposed for direct FFT convention tests and signal-processing tools. */
export function transformComplexRadix2(
  realValues: readonly number[],
  imaginaryValues: readonly number[]
): { readonly real: readonly number[]; readonly imaginary: readonly number[] } {
  if (realValues.length !== imaginaryValues.length ||
    realValues.length < 2 || (realValues.length & (realValues.length - 1)) !== 0 ||
    !realValues.every(Number.isFinite) || !imaginaryValues.every(Number.isFinite)) {
    throw new RangeError("FFT inputs must be finite equal-length power-of-two arrays.");
  }
  const real = Float64Array.from(realValues);
  const imaginary = Float64Array.from(imaginaryValues);
  fftRadix2(real, imaginary);
  return { real: Array.from(real), imaginary: Array.from(imaginary) };
}
