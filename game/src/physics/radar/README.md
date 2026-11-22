# Shared RF physics source area

**Status: folder marker and design notes only. No RF implementation code was added for this task.**

Future shared radar physics belongs here, separate from radar equipment/receiver algorithms.

Planned module responsibilities:

- Geometry and coordinate-frame helpers for RF paths and angular conventions.
- Free-space spreading, antenna gain interfaces and path transmission.
- Atmospheric gaseous/rain/cloud/fog attenuation, refraction and anomalous propagation.
- Terrain, buildings and vegetation visibility/obstruction interfaces.
- Aspect-, configuration-, frequency- and polarization-dependent RCS/target scattering.
- Swerling/statistical fluctuation models with explicit distribution assumptions.
- Surface, weather and moving-platform clutter generation requirements.
- Multipath and diffraction approximations with named validity limits.
- Dimensional consistency, uncertainty and performance-tier policies.

The canonical requirements owner is [physics/radar](../../../../physics/radar/README.md). Radar equipment and processing belong to [sensors/radar](../../sensors/radar/README.md).

Do not add a generic universal target RCS or silently create realistic-looking values. Profiles require provenance, variant applicability, units and uncertainty. The directory marker does not imply any of the planned equations or solvers exist.
