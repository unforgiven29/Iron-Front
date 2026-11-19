# 13 — Radar Operating Modes

## Purpose
Describe operational tasks a particular radar can perform and how each mode configures hardware, waveform, scan, processing, and tracking resources.

## Categories
- **Standby/warm-up:** non-transmitting states, readiness, built-in test, and stabilization.
- **Search:** volume search, sector search, bar scans, high/low search, and equipment-specific patterns.
- **Range/velocity search:** modes emphasizing range or radial velocity and their trade-offs.
- **Single-target track:** concentrated updates and consequences for wider search coverage.
- **Track-while-scan:** multiple tracks while continuing scheduled search, subject to finite resources.
- **Raid assessment/multi-target tracking:** separation and management of multiple returns where supported.
- **Look-up/look-down:** clutter and geometry differences for airborne targets against ground or sky.
- **Ground mapping:** supported mapping modes, resolution trade-offs, and motion compensation.
- **Weather/maritime modes:** only when the installed radar supports them.
- **Beacon/cooperative modes:** interrogations or responses where applicable.
- **Emission control:** transmit restrictions, silent operation, and passive alternatives.
- **Mode transitions:** handover, acquisition, warm-up, waveform changes, and temporary performance loss.

## Aircraft specificity
Mode names and behavior must be tied to a specific radar and software variant. Do not assume all platforms share the same modes or terminology.

## Boundary
Modes configure and schedule existing capabilities. They must not bypass propagation, receiver, processing, detection, or tracking.
