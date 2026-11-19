# 09 — Receiver and RF Front End

## Purpose
Describe how weak returned signals are collected, protected, amplified, filtered, converted, and delivered to processing.

## Categories
- **Receive path:** receive gain, polarization match, feed losses, and channel selection.
- **Transmit leakage and recovery:** isolation, blanking, receiver protection, recovery time, and close-range limitations.
- **Low-noise amplification:** noise figure, gain, bandwidth, compression, and temperature effects.
- **RF filtering:** preselection, bandpass filtering, image rejection, and out-of-band interference.
- **Frequency conversion:** mixers, local oscillators, intermediate-frequency stages, and conversion losses.
- **Automatic gain control:** dynamic-range management, gain timing, and effects on weak/strong returns.
- **Receiver noise:** thermal noise, noise bandwidth, phase noise, and internally generated interference.
- **Dynamic range and saturation:** clipping, compression, recovery, and strong-signal effects.
- **Digitization:** sampling rate, quantization, resolution, clock quality, and throughput.
- **Channel architecture:** single/multiple receive channels, monopulse channels, and digital array receive paths where supported.

## Interactions
Receiver limits must influence detection and processing. The receiver should preserve signal strength, timing, and phase to the extent required by its architecture.

## Boundary
Ends at conditioned analog/digital receiver data. Detection and tracking are downstream decisions.
