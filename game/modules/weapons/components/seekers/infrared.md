# Infrared seeker component profiles

**Purpose:** define installed seeker sensor and detector architecture. Runtime detection/association belongs in sensors/weapon-seeker/infrared-and-eo and sensors/weapon-seeker/countermeasure-discrimination.

## Architecture axis: how the scene is sampled

Choose a source-supported architecture: spin-scan reticle; conical-scan reticle; rosette/nutating scan; other non-imaging scanning detector; imaging IR focal-plane array (staring, step-stare or scanning as fitted); or multispectral/dual-band IR processing where supported.

Do not encode all these as one generic IR sensor whose only different parameter is range.

## Independent detector axes

Define separately spectral band(s), detector class, cooled/uncooled status, optical aperture/transmission, detector size/sampling/pixel response, NETD/noise or equivalent supported response model, dynamic range/saturation, update/frame rate, scan pattern/timing, image processing, background rejection, thermal state, cooling/warm-up time, power draw, FOV, field of regard, gimbal travel/rate and calibration.

## Capability axes

Rear-aspect/all-aspect; target signature conditions; HMCS/other off-boresight cueing; LOAL; lock-on-before-launch; IRCCM features; and supported target classes are independent capability/mode declarations. They do not replace detector and scan architecture.

IRCCM profile must identify the sourced feature family, not a scalar immunity rating. Unknown implementation details remain unknown. Runtime scene discrimination is evaluated against actual flare/target observations.

## Data validation

Keep product/variant and software version exact. Record units, band, source document/revision/page, operating conditions, confidence, data provenance and supported envelope. Do not merge a similarly named missile's seeker upgrade or infer a dual-band detector from an IRCCM marketing claim.
