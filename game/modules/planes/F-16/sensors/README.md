# F-16C Block 50 sensor installation manifest

Own the exact set of installed sensors and their aircraft integration, not shared sensor algorithms. The selected baseline is an F-16C Block 50 configuration; every device requires exact hardware/software/operator applicability before its fit is treated as fact.

## Per-sensor installation data
Stable equipment ID/version; physical mount and orientation; boresight/alignment; aperture/antenna placement; field of regard; cable/data/control interfaces; power/cooling; startup/BIT; display/audio mapping; damage/maintenance path; limitations and provenance. Use explicit absence for equipment not fitted.

## Candidate fit areas
Radar; AN/ALR-56M RWR baseline (exact fit/revision verify); IFF; INS/GPS/EGI and air data; radio/datalink; EO/FLIR or targeting pod only if the selected configuration supports it; MAWS/IRST only if evidenced for that exact fit. Do not grant optional systems because a shared engine exists in the repository.

## Interfaces
Aircraft avionics maps cockpit mode/selection commands to the installed sensor. Sensor returns timestamped uncertain measurements/tracks. Resource systems supply actual power/cooling. Damage affects installed antennas/sensors through routing. No platform module contains a private sensor engine.

## Tests
Fit validation, absent equipment behavior, mount/boresight transforms, power/cooling, startup, controls/displays, damage and exact baseline compatibility.
