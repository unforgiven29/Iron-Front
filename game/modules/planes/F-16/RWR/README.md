# F-16C Block 50 RWR installation

**Selected working baseline:** AN/ALR-56M with exact operator/block/software fit to be verified. This directory owns aircraft-specific installation/configuration; shared dynamic RWR processing remains in sensors/RWR. Do not copy receiver/deinterleaving/classification algorithms here.

## Installation data
Antenna count/location/orientation and aperture response; receiver equipment identity/frequency coverage/bandwidth/sensitivity; direction-finding/sector behavior; library/software revision; display/audio/warning policy; power/cooling; controls/BIT; structural/radome/cable damage; cockpit panel/symbology/audio mapping and evidence.

## Behavior boundary
The RWR processes actual received RF emissions through propagation and its receiver. It does not query radar target tracks, private lock state or campaign entity data. Emission mode/threat cue is inferred from observed pulse/emission features with confidence. A detected emitter is not automatically hostile or tracking the F-16.

## Verification
Exact fit/version; antenna frame/bearing calibration; receiver threshold/band limits; simultaneous emitters/deinterleaving; warning priority/audio mapping; power/cooling loss; antenna/cable damage; stale/ambiguous threat library entries.
