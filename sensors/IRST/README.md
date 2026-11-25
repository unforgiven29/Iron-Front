# IRST Source Structure

**Status: first executable slice exists under `game/src/sensors/` and `game/src/physics/` (PROJECT_STATE item 16u). This folder remains the architecture guide; capabilities not listed there are not implemented.**

IRST is a passive infrared search-and-track sensor. It must detect targets from modeled thermal radiance/contrast, atmospheric transmission, background, optics, detector behavior, scan geometry and processing. It must not use a fixed detection radius, visible-mesh test or hidden world truth.

Read [IRST architecture](../../docs/irst/README.md), [Claude implementation guide](../../docs/irst/CLAUDE_IMPLEMENTATION_GUIDE.md) and [shared sensor architecture](../../docs/sensors/README.md).

## Folder responsibilities

| Folder | Responsibility |
|---|---|
| core | Equipment composition, lifecycle, configuration and contracts |
| optics | Aperture, filters, transmission, focus and point-spread behavior |
| detector | Spectral response, sampling, noise, saturation and thermal state |
| signature | Target radiance profiles and aircraft/engine thermal contributors |
| environment | Shared atmospheric transmission and background radiance adapters |
| line-of-sight | Sensor-target geometry, terrain/structure obstruction and look angles |
| scan-control | Field of regard, gimbal limits, scan patterns, dwell and revisit |
| stabilization | Boresight, aircraft motion compensation, jitter and alignment |
| processing | Background estimation, contrast processing and candidate extraction |
| detection | Thresholds, false alarms, missed detections and angular measurement reports |
| tracking | Track initiation, association, uncertainty, coasting and deletion |
| integration | Radar cueing, datalink, sensor fusion and aircraft-system interfaces |
| cockpit | Sensor controls, status, symbology and track presentation |
| health | Warm-up, cooling, calibration, faults, damage and maintenance |
| data | Equipment fits, spectral bands, variants, source provenance and uncertainty |
| diagnostics | Test scenes, telemetry, deterministic replay and performance |
| lab | Production-module scenarios and visualizations |

## Important distinction

IRST is not the same as FLIR/thermal imaging, daylight EO, RWR/ESM or laser ranging. Reuse shared geometry, time, uncertainty and sensor-report contracts, but do not merge their physical mechanisms into one generic camera or `detect(target)` call.

The renderer may show a thermal image or field-of-regard overlay, but only the sensor chain creates detections and tracks.
