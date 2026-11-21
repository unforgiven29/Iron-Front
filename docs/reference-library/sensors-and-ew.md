# Sensors, radar, electronic warfare and electro-optics

**Read with:** `sensors/README.md`, `docs/sensors/README.md`, `sensors/Radar/README.md`, `docs/radar/README.md`, the exact RWR/ESM/IRST/EO/IFF/MAWS/NCTR guides, `physics/radar/README.md`, `physics/optics/README.md` and `physics/thermal/README.md`.

## Sensor principles

A sensor produces measurements, not omniscient target objects. Keep these stages distinct:

1. Equipment fit, software, warm-up, alignment, power/cooling and health.
2. The physical interaction: RF emission/propagation/return, passive RF interception, thermal radiation, reflected light, optical imaging or a cooperative reply.
3. Aperture/antenna/optics and receiver/detector.
4. Signal or image processing.
5. Detection/measurement with uncertainty and false/missed reports.
6. Tracking, association and classification with age and confidence.
7. Display, datalink and fusion.

No sensor may read an entity's hidden transform to create a contact. A radar track, RWR emitter bearing, IRST angular report, EO image candidate and IFF response are different kinds of evidence.

## Radar references

### 1. MIT Lincoln Laboratory — Introduction to Radar Systems

- [Free web-based course](https://www.ll.mit.edu/outreach/web-based-course-radar-introduction-radar-systems)

The course includes lectures and viewgraphs covering radar equation, propagation, target RCS, detection in noise, pulse compression, antennas, clutter/chaff, MTI and pulse-Doppler processing, tracking/parameter estimation, transmitters and receivers.

**Use for:** building the conceptual and mathematical map of a radar signal chain. Read the lecture topic that corresponds to the task rather than treating the radar as one range formula.

### 2. MIT Lincoln Laboratory — Graduate Radar Systems Engineering

- [Free graduate-level radar course](https://www.ll.mit.edu/outreach/web-based-course-radar-graduate-level)

Includes video, audio and a large set of PDF slides for deeper radar engineering topics. MIT identifies Skolnik's *Introduction to Radar Systems*, 3rd edition, as the course text.

**Use for:** deeper subsystem study when implementing waveforms, antennas, detection, clutter, tracking or receiver/transmitter behavior.

**Limitations:** course material is educational reference, not a specific aircraft radar's classified or proprietary performance database.

### 3. MIT Lincoln Laboratory — Radar Equation and Detection Process lecture

- [Lecture viewgraphs PDF](https://www.ll.mit.edu/sites/default/files/outreach/doc/2018-07/lecture%202.pdf)

**Use for:** reinforcing the separation between radar parameters, target properties, range, propagation, SNR, target fluctuation, noise statistics, detection threshold, probability of detection and probability of false alarm.

**Limitations:** a teaching illustration; use the full course and primary engineering references for implementation assumptions.

### 4. RIT DIRSIG — radar modality handbook

- [DIRSIG reference documentation](https://dirsig.cis.rit.edu/docs/new/)
- [DIRSIG radar modality handbook](https://dirsig.cis.rit.edu/docs/new/radar.html)

**Use for:** thinking about scene/material interaction, complex phase-history outputs, polarization, platform motion and SAR collection geometry. It is a useful scene/sensor simulation reference.

**Critical limitation:** RIT marks the radar functionality experimental and documents significant omissions, including no modeled atmospheric attenuation, no RF noise, no direct phased-array model and limited waveform/bandwidth functionality. Do not treat DIRSIG as a complete pulse-Doppler/AESA fighter radar implementation.

## Electro-optical and infrared references

### 5. RIT DIRSIG — thermal modality handbook

- [Thermal Modality Handbook](https://dirsig.cis.rit.edu/docs/new/thermal.html)
- [DIRSIG reference documentation](https://dirsig.cis.rit.edu/docs/new/)

**Use for:** separating target self-emission, material temperature, spectral optical properties, weather, detector band and sensor response. It helps explain why a thermal image is not simply a colored visible camera.

**Limitations:** DIRSIG is a research imaging framework; use its own validation studies and license requirements. Do not assume every feature is available in the browser or in every release.

### 6. HITRAN — spectroscopic database

- [HITRAN FAQ](https://www.hitran.org/faq/)

**Use for:** atmospheric molecular spectral line and absorption data when a radiative-transfer model needs physically sourced input.

**Important distinction:** HITRAN explicitly describes itself as a database, not a complete atmospheric radiative-transfer simulation code. It is one input source, not a ready-made IRST range calculator. Preserve temperature/pressure/broadening and spectral applicability.

### 7. RIT Digital Imaging and Remote Sensing Laboratory

- [DIRSIG project overview](https://www.rit.edu/dirs/dirsig)

**Use for:** overall scene-based synthetic imaging concepts, spectral bands, radiometry, material properties, sensor configuration and validation.

## RWR and ESM references: use extra caution

Public, exact, variant-specific RWR/ESM hardware and software details are often incomplete. Do not fill this gap with invented pulse libraries or claims about real-world sensitivity and identification performance.

Use the repo's [RWR architecture](../../sensors/RWR/README.md), [RWR implementation brief](../../sensors/RWR/CLAUDE_IMPLEMENTATION_GUIDE.md), and [RWR validation guide](../../sensors/RWR/validation/README.md) as the authoritative design contracts. Use the MIT radar course to understand observable radar emission/processing concepts. For each aircraft, separately research public information on its installed antenna coverage, receiver generation, threat-library era, display, controls, software and known limitations.

Required distinctions:
- RWR/ESM intercepts emissions; it does not read the radar's private track files.
- Bearing-only measurement is not range.
- Pulse descriptor measurement is not guaranteed emitter identification.
- Emitter identity, hostility, tracking, lock and missile-launch assessment are separate hypotheses.
- A silent or powered-down emitter cannot be detected merely because its radar object exists.
- Datalink/fusion reports retain source, timestamp, age and uncertainty.

Synthetic emitter records are acceptable for laboratory fixtures, but they must be clearly labeled synthetic and cannot be used to claim real equipment performance.

## AESA and radar architecture research map

Use the MIT LL material to research the common RF and processing chain, then seek exact public evidence for each equipment set. Do not infer T/R module count, transmit power, cooling limits, frequency agility, simultaneous-beam capability, ECCM modes, LPI performance or software modes from the label "AESA". These are installation- and design-specific.

The repo's radar architecture deliberately treats these as independent axes:
- waveform and coherent processing;
- antenna/aperture construction;
- mechanical/electronic beam steering;
- transmit/receive channel architecture;
- scheduling and dwell/revisit behavior;
- receiver/processing architecture;
- operating modes and software baseline.

The same distinction applies to mechanical scan, pulse, pulse-Doppler, PESA, AESA and hybrid designs.

## Sensor integration reading path

For a radar feature: MIT LL course → exact radar architecture chapter → `physics/radar/` environment owner → `sensors/Radar/` equipment/processing owner → exact aircraft fit → radar validation plan.

For RWR/ESM: MIT LL emission/radar topics → RWR owner → shared RF-emission/propagation contracts → exact installed RWR package → emitter-observation/failure tests.

For IRST/FLIR: DIRSIG thermal handbook + HITRAN FAQ where relevant → `physics/optics/` and `physics/thermal/` → exact sensor family → environment, background, optics, detector and tracking tests.

For fusion: read the common measurement and track contract before combining sensors. Never turn remote, stale or correlated reports into multiple independent detections.
