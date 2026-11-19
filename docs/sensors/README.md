# Sensor Systems Architecture

Iron-Front sensors must be independent equipment simulations that produce uncertain observations. Sensors do not receive perfect target lists from the campaign world. Each sensor has its own physical mechanism, limitations, update rate, equipment health, processing and track quality.

## Sensor families

- **Radar:** active RF transmission/reception, propagation, scattering, signal processing, detection and tracking. See [radar architecture](../radar/README.md).
- **IRST:** passive infrared detection and angular tracking. See [IRST architecture](../irst/README.md).
- **RWR/ESM:** passive RF interception, pulse/parameter measurement, emitter deinterleaving, probabilistic identification, bearing-only emitter tracking and threat warning. See [RWR architecture](../../sensors/RWR/README.md).
- **EO/FLIR:** optical/thermal imaging and image-based observation; distinct from an IRST search/track chain.
- **Datalink:** transports remote reports with source, timestamp, age and uncertainty; it is not a sensor and does not turn remote reports into onboard detections.
- **IFF:** cooperative identification interrogation/response where fitted; identification is not detection.
- **Navigation sensors:** INS/GNSS/air-data/radio-navigation provide ownship state estimates with their own errors and failures.

## Shared contracts

All sensor reports must include source sensor/equipment ID, timestamp, coordinate frame, measurement type, value, uncertainty/quality, validity and provenance. Track state must preserve contributing sources, age, covariance/uncertainty and lifecycle. Keep world truth, raw measurements, detections, classifications and tracks as separate data types.

Sensor fusion must handle time alignment, coordinate transformations, uncertainty, correlated reports, duplicate tracks, stale datalink data and conflicting observations. Never fuse by simply copying the most convenient target entity state.

## System interactions

Power, cooling, hydraulics, vibration, temperature, damage, alignment, software baseline and operator mode affect sensor availability and quality. Radar emissions may be observed by RWR/ESM; radar and IRST may cue one another; datalink can share tracks; weather/terrain can affect multiple sensor types differently. Each interaction must pass through explicit contracts and must not bypass the physical chain.

RWR and radar are different RF systems: radar normally processes returns from its own illumination, while RWR intercepts another emitter's direct signal. RWR must not consume radar detections, target RCS or hidden tracking state. Radar transmitters must publish actual time-bounded emissions through the shared RF environment; RWR receives only the energy its installed antennas and receiver can process. RWR bearing is not range, and emitter identity/hostility/lock/launch status must remain separate uncertain assessments.

## Implementation order

Audit existing systems, define common measurement/track contracts, implement one sensor end-to-end, validate uncertainty/failure behavior, then integrate fusion and additional sensor families. Reuse common infrastructure only where the physical mechanism is genuinely shared. Do not flatten all sensors into a generic `detect(target)` function.
