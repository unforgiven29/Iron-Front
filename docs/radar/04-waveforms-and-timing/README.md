# 04 — Waveforms and Timing

## Purpose
Define the transmitted signal shape, frequency, phase behavior, pulse timing, and scheduling constraints.

## Categories
- **Carrier frequency and band:** tuning range, stability, and band-dependent propagation.
- **Pulse shape:** rectangular and shaped pulses, rise/fall behavior, bandwidth, and spectral characteristics.
- **Pulse duration and bandwidth:** range-resolution, energy, and hardware trade-offs.
- **PRF and PRI:** pulse repetition frequency/interval, staggered timing, and ambiguity consequences.
- **Pulse trains and bursts:** coherent processing intervals, dwell composition, and interleaving.
- **Frequency agility:** hop sequences, tuning delays, spectral occupancy, and interference resistance.
- **Pulse compression:** coded or chirped waveforms, matched-filter compatibility, compression ratio, and sidelobes.
- **Phase and coherence:** phase stability, coherent reference, oscillator drift, and phase noise.
- **Waveform scheduling:** selecting/interleaving waveforms under mode, power, thermal, and time constraints.
- **Compatibility:** limits imposed by transmitter, antenna, receiver, and processor.

## Interactions
Waveform choices affect resolution, unambiguous range/velocity, sensitivity, clutter, processing load, and interference susceptibility. These are coupled trade-offs.

## Boundary
Defines what is transmitted and when. Beam pointing is folder 06; matched filtering and Doppler extraction are folder 10.
