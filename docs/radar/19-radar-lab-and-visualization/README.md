# 19 — Radar Laboratory and Visualization

## Purpose
Define a development/analysis environment for inspecting radar behavior, changing controlled inputs, and visualizing internal state.

## Categories
- **Configuration workspace:** select a documented radar and inspect installed capabilities.
- **Scenario setup:** place platforms/targets and set aspect, altitude, speed, environment, and geometry.
- **Waveform inspection:** pulse timing/shape, PRF/PRI, bandwidth, and coherent intervals.
- **Antenna visualization:** 3D main lobe, sidelobes, backlobes, nulls, scan angle, and array degradation.
- **Beam/scan visualization:** beam pointing, scan volume, dwell, revisit timing, and task scheduling.
- **Propagation visualization:** line of sight, terrain masking, attenuation, and selected multipath paths.
- **Signal visualization:** transmitted/received signal, noise, clutter, and interference.
- **Range-Doppler analysis:** processing outputs and ambiguity behavior.
- **Detection analysis:** thresholds, CFAR windows, detections, misses, and false alarms.
- **Track analysis:** histories, estimates, uncertainty, coast periods, and association decisions.
- **Performance diagnostics:** processing time, update rates, memory, and fidelity level.
- **Scenario replay:** repeat fixed scenarios and compare configurations.

## Shared-engine requirement
The laboratory must instantiate and inspect the same radar modules and processing path used by the game. It may expose diagnostics and controlled inputs, but it must not contain a separate simplified radar with different rules.

## Boundary
Covers the laboratory and visualizations, not radar physics or gameplay rules.
