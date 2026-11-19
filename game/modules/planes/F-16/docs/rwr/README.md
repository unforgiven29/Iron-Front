# F-16C Block 50 — AN/ALR-56M RWR

Selected baseline: AN/ALR-56M. USAF Shaw AFB material lists ALR-56M among Block 50/52 improvements; Eagle Dynamics also names it in its DCS Block 50 baseline. This is an aircraft-specific profile over the single shared Iron-Front RWR engine.

Record confirmed receiver revision/software, antenna aperture count and transforms, frequency response, bandwidth/channelization, sensitivity, direction-finding method, bearing error, pulse measurement, processing limits, emitter-library revision, threat logic, display/audio/BIT, power/cooling, wiring, self-interference and damage paths.

The RWR consumes intercepted RF signals from the shared propagation layer. It must not read APG-68 target tracks, lock booleans or campaign entity state. Detection, identity, hostility, threat state and launch warning are separate outputs. Preserve uncertainty, missed detections, saturation, unknown emitters and track aging. A bearing is not range.

Public sources do not provide a complete ALR-56M technical specification for every Block 50 baseline. Do not invent exact frequency coverage, sensitivity, channel count, angular accuracy or library contents.

Sources: [Shaw AFB F-16C fact sheet](https://www.shaw.af.mil/About-Us/Fact-Sheets/Display/Article/663884/f-16c-fighting-falcon/); [DCS F-16C Block 50 baseline](https://www.digitalcombatsimulator.com/es/news/2019-02-15_Beta/); [shared RWR architecture](../../../../../sensors/RWR/README.md); [RWR validation standard](../../../../../docs/sensors/RWR_VALIDATION_AND_DATA_STANDARD.md).
