# Optical, laser and passive-RF seeker component profiles

## Daylight TV / EO

Declare visible spectral response, optics/aperture, detector architecture, image sampling, FOV, field of regard, stabilization, image update, contrast/noise, background and obscuration limits, target/designation modes and track behavior. Do not reuse IR detector or thermal-signature parameters.

## Imaging infrared

Imaging IR uses an infrared focal-plane array and image processing. Declare spectral band(s), detector/cooling type, resolution/sampling, frame rate, optics, scene/background processing, track features and supported discrimination. IIR is not synonymous with multispectral; dual-band is a separate property.

## Semi-active laser (SAL)

Declare laser wavelength/band, compatible designator/spot/PRF-code requirements when known, coded/uncoded compatibility, seeker field of view, acquisition and track gate, optical receiver characteristics, spot-following method, masking/weather constraints and lost-designation behavior. The target must be illuminated by a compatible source; an arbitrary laser on the battlefield is not automatically a valid designation.

## Laser beam riding

Declare compatible beam/reference source, receiver position/angle response, beam code/reference method, field of regard, optical path/obscuration and beam-loss behavior. This receiver follows beam geometry; it is not a SAL target-spot seeker.

## Passive RF / anti-radiation

Declare receive band(s), antenna baseline/geometry, bearing measurement, frequency agility coverage where confirmed, pulse/CW feature extraction, emitter library/interface, scan/revisit, memory/last-known-source mode, navigation dependency and behavior if the emitter shuts down or moves. Do not feed private radar objects or campaign emitter truth to the seeker.

## Composition rule

All these profiles produce timestamped, uncertain observation reports. Physics/guidance decides how those reports are used to command the weapon. They do not grant a perfect coordinate or guaranteed hit.
