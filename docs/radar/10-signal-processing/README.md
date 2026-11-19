# 10 — Signal Processing

## Purpose
Describe how receiver data becomes range, Doppler, angle, and signal-quality observables before detection and tracking.

## Categories
- **Matched filtering:** pulse compression, correlation, range response, and range sidelobes.
- **Range processing:** time-delay estimation, range bins, resolution, and range ambiguity.
- **Doppler processing:** coherent intervals, FFT processing, radial velocity, and Doppler resolution.
- **Coherent integration:** phase-aligned accumulation, integration gain, and coherence loss.
- **Noncoherent integration:** energy accumulation and its distinct sensitivity/phase behavior.
- **Clutter processing:** clutter maps, moving-target indication, Doppler filtering, and adaptive suppression.
- **Ambiguity handling:** range-Doppler ambiguities, staggered PRFs, multiple-PRF techniques, and unresolved ambiguity.
- **Angle estimation:** monopulse, amplitude comparison, phase comparison, and digital array estimation where supported.
- **Interference suppression:** processing against noise-like and structured interference.
- **Calibration and compensation:** motion compensation, phase correction, channel alignment, and timing correction.
- **Processing constraints:** finite throughput, latency, memory, and processor limitations.

## Interactions
Processing must use the actual waveform, antenna, receiver, and platform-motion information. It cannot recover information never captured or erase every ambiguity.

## Boundary
Produces candidate measurements and signal-quality information. Detection/thresholding is folder 11.
