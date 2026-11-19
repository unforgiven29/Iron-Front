# 02 — Radar Types and Architectures

## Purpose
Describe fundamentally different radar families and the architectural differences that must be represented.

## Categories
- **Mechanically scanned:** rotating or gimballed antenna, drive limits, inertia, stabilization, scan sectors, and repositioning time.
- **Pulse radar:** discrete pulses, echo delay ranging, pulse timing, and waveform/receiver limitations.
- **Pulse-Doppler:** coherent processing, radial-velocity estimation, clutter rejection, and Doppler ambiguities.
- **Continuous-wave and FMCW:** continuous transmission, beat-frequency ranging where applicable, and transmit/receive isolation requirements.
- **PESA:** electronically controlled phase shifting with a shared high-power RF source architecture.
- **AESA:** distributed transmit/receive modules, element-level control, beam scheduling, thermal/power limits, and module failures.
- **Hybrid and multichannel arrays:** multiple apertures, bands, channels, or techniques where documented.
- **Historical and specialized radars:** ranging, fire-control, surveillance, weather, and maritime sets.

## Required distinctions
Represent scan mechanics, beam agility, simultaneous or interleaved tasks, transmit resources, receiver channels, failure modes, and operational restrictions according to the equipment. Do not assume every AESA can do every task simultaneously.

## Boundary
This folder classifies architectures. Antenna patterns, waveforms, and processing algorithms are covered elsewhere.
