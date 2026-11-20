# 02 — Radar Types and Architectures

## Purpose
Describe fundamentally different radar families and the architectural differences that must be represented.

## Radar electronics and operating architectures
- **Mechanically scanned:** rotating or gimballed antenna, drive limits, inertia, stabilization, scan sectors, and repositioning time.
- **Pulse radar:** discrete pulses, echo delay ranging, pulse timing, and waveform/receiver limitations.
- **Pulse-Doppler:** coherent processing, radial-velocity estimation, clutter rejection, and Doppler ambiguities.
- **Continuous-wave and FMCW:** continuous transmission, beat-frequency ranging where applicable, and transmit/receive isolation requirements.
- **PESA:** electronically controlled phase shifting with a shared high-power RF source architecture.
- **AESA:** distributed transmit/receive modules, element-level control, beam scheduling, thermal/power limits, and module failures.
- **Hybrid and multichannel arrays:** multiple apertures, bands, channels, or techniques where documented.
- **Historical and specialized radars:** ranging, fire-control, surveillance, weather, and maritime sets.

## Antenna-aperture construction (independent classification)
Aperture construction is a separate axis from waveform and transmitter/beam-steering electronics. A radar record must identify both where known; do not infer AESA/PESA from a flat aperture or infer a mechanically scanned transmitter from the reflector shape.

- **Parabolic reflector dish:** a curved reflector illuminated by a feed, commonly a horn or feed assembly. Model reflector diameter and shape, focal/feed geometry, illumination taper, blockage, aperture efficiency, surface accuracy, polarization, and the resulting main-lobe/sidelobe pattern.
- **Flat slotted-waveguide planar array:** a planar conductive aperture with radiating slots fed by one or more waveguide networks. Model aperture dimensions, slot count/layout/orientation/spacing, feed topology, slot coupling and phase progression, bandwidth, polarization, losses and pattern. A conventional fixed-feed slot array is not automatically electronically steered and is not an AESA.
- **Other apertures:** horns, reflectarrays, phased planar arrays, conformal arrays and documented specialized apertures. Their physical construction must be explicit rather than inferred from a generic "array" label.

A parabolic reflector or slotted-waveguide array may be mounted on a mechanically scanning pedestal. A phased planar array may use PESA or AESA electronics. These labels describe different aspects of the equipment and must not be collapsed into one enum.

## Required distinctions
Represent scan mechanics, beam agility, simultaneous or interleaved tasks, transmit resources, receiver channels, failure modes, and operational restrictions according to the equipment. Do not assume every AESA can do every task simultaneously. Do not assume every planar aperture contains active T/R modules.

## Boundary
This folder classifies radar electronics and operating architectures. Physical aperture geometry and patterns are specified in folder 05; scan scheduling and pointing are covered in folder 06.
