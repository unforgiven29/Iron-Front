# Infrared Search and Track (IRST) Architecture

**Status: design specification and planned folders only. No IRST detection or imaging algorithm is implemented by this document.**

IRST is a passive electro-optical/infrared sensor. It receives naturally emitted or reflected infrared energy; it does not illuminate the target like radar. Its detections must emerge from target signature, atmosphere, background, optics, detector characteristics, scan strategy and processing—not from a game-world visibility check or fixed detection radius.

## 1. Define the sensor family precisely

Keep distinct equipment concepts:
- **IRST:** passive infrared search, detection, angular measurement and track estimation.
- **FLIR/thermal imager:** produces an image or stabilized field of view, often used for identification/observation.
- **EO daylight camera:** visible-band imaging.
- **Laser rangefinder/designator:** active laser equipment with its own emission, geometry and atmospheric effects.

An aircraft may combine these sensors, but do not treat them as one interchangeable generic camera. The exact aircraft fit, spectral bands, optics, stabilization, processing and software baseline determine capabilities.

## 2. Causal detection chain

`sensor mode/task → scan/gimbal scheduler → optical aperture/filter → line-of-sight and atmospheric transmission → target/background radiance → optics/point-spread and detector sampling → noise/thermal/electronic response → image/contrast processing → candidate detection → angular measurement → track filter → cockpit/datalink`

A visualization may show this chain but must not bypass it. The sensor is passive: no target return is created by an IRST transmission.

## 3. Target infrared signature

Build target signature from defensible, aspect- and state-dependent contributors:
- Exhaust plume and hot gas path where visible to the sensor.
- Nozzle/turbine hot surfaces and afterburner state.
- Engine power, throttle transient and thermal lag.
- Skin heating from speed, altitude and aerodynamic heating.
- Airframe materials, coatings, surface temperature and emissivity.
- Aspect angle, occlusion, engine shielding and viewing geometry.
- Stores, damaged/hot components and smoke where modeled.
- Engine installation and aircraft-specific thermal signature data.

Separate emitted thermal radiation from reflected environmental radiation. A target's signature changes over time; do not set one constant IR brightness per aircraft. Do not invent exact classified signature values. Use source-backed data or explicitly labelled synthetic gameplay profiles with uncertainty.

## 4. Background and environment

Detection depends on contrast against the scene. Model at appropriate fidelity:
- Spectral atmospheric transmission and path radiance.
- Water vapour, humidity, haze, aerosols, dust and smoke.
- Cloud, precipitation and visibility effects.
- Sky, sun, moon, stars, terrain, sea and cloud backgrounds.
- Solar glint/reflection and sun angle where relevant.
- Ground clutter, hot terrain, urban heat sources and thermal crossover.
- Terrain/structure line-of-sight and partial occlusion.
- Sensor altitude, target altitude, slant range and look angle.

A visible cloud or fog layer in graphics is not automatically a physical IR blocker. Both graphics and IRST must use the same environment configuration, but IR transmission is calculated by the sensor/physics model.

## 5. Optical and detector model

Represent the installed sensor, not a perfect point detector:
- Aperture diameter, optical transmission and obscuration.
- Spectral response/bandpass and filter characteristics.
- Field of regard, instantaneous field of view and pixel/angular sampling.
- Optical point-spread, blur, focus and stabilization error.
- Detector array size/readout behavior at a justified abstraction.
- Detector noise, dark current, read noise, non-uniformity and saturation.
- Thermal control/cooling state and warm-up where applicable.
- Sensitivity/NETD-style contrast limits with clear assumptions.
- Calibration, boresight alignment, contamination and degradation.

Do not claim a detector has engineering-grade pixel physics if it is implemented as a coarse contrast model. Declare the fidelity tier and validity envelope.

## 6. Scan, stabilization and measurement

Model sensor-specific mechanics and limits:
- Fixed or gimballed installation and its field of regard.
- Azimuth/elevation limits, slew rate, acceleration and settling.
- Scan patterns, dwell, revisit and search prioritization.
- Aircraft vibration, angular rate and line-of-sight stabilization.
- Boresight alignment, drift, jitter and stabilization failure.
- Narrow/wide fields of view and track/scan transitions.
- Detection latency and timestamping.

An IRST normally provides angular line-of-sight measurements, not direct precise range. Range estimation requires a separately documented method (for example, multi-sensor/ownship maneuver geometry or a system-specific ranging capability). Do not fabricate exact range from target world coordinates.

## 7. Detection and tracking

Detection must be based on modeled signal/contrast-to-noise, background variation, dwell, optics and detector state. Include:
- Detection probability and false-alarm behavior under stated assumptions.
- Thresholding/adaptive background estimation.
- Candidate extraction and angular centroid/measurement uncertainty.
- Track initiation, association, confirmation, coasting and deletion.
- Track quality, age, confidence and source provenance.
- Target aspect/thermal state changes and missed observations.
- Multiple targets, merging/splitting and clutter rejection.

A detection is not identification. Classification should be a separate evidence-based process with uncertainty. Do not give the IRST the entity's true type, name, range or faction.

## 8. Integration with other sensors

Fuse only measurement reports and tracks, never hidden world truth. Preserve whether a report came from IRST, radar, RWR, datalink or another sensor. Fusion must account for timestamps, coordinate frames, uncertainty, correlation and duplicate information. An IRST angular track may cue a radar search without magically providing radar-quality range. A radar track may cue IRST to a field of regard, but the IRST must still independently detect thermal contrast.

## 9. Cockpit and operator behavior

Aircraft-specific displays and controls may include search/track modes, field-of-regard indication, sensor status, track quality, angular cues, target priority and boresight controls where supported. Display symbology must reflect actual sensor output and failure state. Power, cooling, calibration, contamination, damage and software limitations must affect operation.

## 10. Ownership and contracts

- `sensors/IRST/`: equipment, optics/detector configuration, scan control, processing, detection, angular measurements, tracks, health and aircraft-facing interfaces.
- Shared environment/physics owner: atmosphere, visibility, terrain geometry and reusable radiative/thermal environment queries. Avoid creating a second atmosphere.
- Aircraft module: exact sensor installation, field of regard, controls, software baseline, cockpit and source data.
- Sensor fusion owner: timestamp/uncertainty-aware combination of reports.
- Graphics engine: renders imagery, field of regard, symbology and debug views only.

Use SI units, explicit spectral-band definitions, coordinate frames and simulation timestamps. Separate static configuration from mutable runtime state.

## 11. Validation

Test target/background contrast trends, aspect changes, engine power transients, afterburner on/off, altitude and slant-range effects, atmospheric attenuation, hot/cold backgrounds, cloud/haze assumptions, scan dwell/revisit, stabilization, noise, false alarms, missed detections, track coasting and sensor failures. Include deterministic scenarios and statistical tests for detection/false-alarm behavior.

A glowing target mesh, cone visualization or fixed range threshold is not an IRST simulation.
