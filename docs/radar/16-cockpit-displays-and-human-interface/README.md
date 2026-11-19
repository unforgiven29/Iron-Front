# 16 — Cockpit Displays and Human Interface

## Purpose
Describe how radar state, detections, tracks, modes, faults, and controls are presented to the operator.

## Categories
- **Radar scope:** plan-position displays, B-scopes, range-height displays, and equipment-specific formats.
- **Symbology:** detections, confirmed/tentative tracks, quality, uncertainty, stale data, and source markings.
- **Range/scale controls:** range selection, gain, clutter controls, cursor, zoom, and orientation.
- **Mode controls:** mode selection, search volume, designation, and supported tasking.
- **Track designation:** cursor selection, acquisition commands, handoff, and prioritization.
- **Antenna/scan indication:** scan sector, beam position, elevation bars, and scan limitations.
- **Warnings/cautions:** overheating, transmitter/receiver faults, degraded performance, and BIT results.
- **Audio/alerts:** tones, voice alerts, threat cues, and alert prioritization where appropriate.
- **Ergonomics/workload:** information density, readability, operator workload, and control placement.
- **Aircraft-specific layout:** display hardware, bezel controls, HOTAS controls, and cockpit integration.

## Interactions
The display presents what the radar actually knows, including uncertainty and stale information. It must not invent contacts or improve track quality.

## Boundary
Owns human-facing presentation and interaction. Radar behavior belongs to simulation subsystems.
