# Weapon infrared and electro-optical seeker processing

**Owner:** sensors/weapon-seeker/infrared-and-eo for weapon-specific state/association; physical thermal and optical observations remain with sensors/IRST, sensors/EO-FLIR, physics/thermal and physics/optics. **Status:** architecture only.

## Supported IR sensor families

A seeker profile chooses a documented scanning or imaging design: spin-scan reticle; conical-scan reticle; rosette/nutating scan; other non-imaging scanning detector; imaging infrared focal-plane array (staring, step-stare or scanning implementation as fitted); or multispectral/dual-band IR processing where supported.

These are distinct processing architectures. Do not make them labels that only change detection range.

## Orthogonal detector and capability properties

Define spectral band(s), optical throughput, aperture, detector class, cooled/uncooled status, noise/NETD or equivalent supported quality model, sampling/pixel characteristics, frame/update rate, saturation, warm-up/cooling, power, FOV/field of regard, gimbal/tracking rate, scan timing, background estimation and track algorithm separately.

Rear-aspect/all-aspect, LOAL, HMCS/slaving, IRCCM and target class are separate capability/mode fields. They are not substitutes for actual seeker scan/detector architecture.

## Measurements and track

For non-imaging seekers, report line-of-sight error and signal features with the limits of the scan/detector method. For IIR/EO, report image-derived candidate position/features, quality, uncertainty, contrast, saturation and track continuity. Neither pipeline receives a rendered visual mesh as a sensor result. Physical observations come through thermal/optical scene and propagation models.

## Validation

Test background/target contrast; target aspect and engine/thermal state; clouds/fog/precipitation/obscuration; sun and glint/background; detector cooling/readiness; scan or image-frame timing; saturation; multiple target candidates; flare scenes; seeker slew and track-rate limits; false detections, rejection and reacquisition. Keep IR and visible EO test paths separate.
