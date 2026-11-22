# Shared Radar Physics

**Status: specification and folder scaffold only for this task. No shared RF runtime code was added or retained from this task.**

## Purpose

`sensors/Radar/` represents radar equipment and its processing chain. `physics/radar/` represents reusable models of geometry, propagation, target scattering and environmental clutter. This prevents every radar/aircraft from implementing incompatible environment models.

## Folder responsibilities

| Folder | Responsibility |
|---|---|
| geometry/coordinate-frames | Transformations, coordinate conventions, direction vectors and unit-safe geometry |
| geometry/line-of-sight | Visibility, terrain obstruction and path endpoints |
| propagation/free-space | Geometric spreading and baseline free-space path loss |
| propagation/atmospheric-absorption | Frequency-dependent gaseous attenuation |
| propagation/precipitation | Rain attenuation and scattering approximations |
| propagation/refractivity | Refractivity, refraction and documented anomalous propagation |
| propagation/multipath | Reflected paths, phase delay, interference and fading |
| propagation/terrain-masking | Terrain profiles, elevation sampling, ridgelines and obstruction |
| propagation/structures-vegetation | Buildings, forests and obstacle/attenuation approximations |
| target-scattering/rcs | RCS interfaces, units, frequency and polarization dependence |
| target-scattering/aspect-models | Aspect/configuration-dependent target response |
| target-scattering/fluctuation | Statistical target fluctuation models and assumptions |
| target-scattering/material-response | Material/surface response where defensible data exists |
| target-scattering/cavities-inlets | Explicitly limited cavity/inlet scattering approximations |
| clutter/ground-sea-weather | Environmental clutter sources and reflectivity |
| clutter/clutter-maps | Spatially indexed clutter/environment data |
| clutter/doppler-clutter | Clutter Doppler distribution and motion effects |
| numerics/units | Unit conversions, constants and dimensional consistency |
| numerics/uncertainty | Error bounds and uncertainty representation |
| numerics/approximations | Named fast models, validity envelopes and limitations |

## Boundaries

Geometry determines where paths can exist and what they intersect. Propagation determines how energy changes along a path. Target scattering determines how an object responds. Clutter describes distributed environmental returns. Receiver noise/hardware stays in `sensors/Radar/receiver/`; detection and tracking stay in their sensor folders.

## Required modeling questions

For every RF path, define frequency, polarization, transmit/receive antenna response, range, atmospheric state, terrain/building/vegetation obstruction, multipath assumptions and path loss. For every target, define aspect convention, configuration, frequency/polarization applicability, RCS fluctuation model and evidence status. For every clutter model, define surface class, sea state/moisture, grazing angle, cell area, Doppler behavior and data provenance.

## Fidelity and performance

Use explicit model/fidelity selection, not silent equation changes based on frame rate. Fast gameplay approximations may serve many objects; detailed calculations may serve selected objects or lab cases. Both expose assumptions and validity limits. Do not claim full-wave EM accuracy without a validated numerical solver. Use spatial acceleration/cached queries, avoid per-frame terrain scans, and make queries reproducible for fixed scenarios and seeds.

This README defines intended ownership and future work. It is not a runtime implementation or validation report.
