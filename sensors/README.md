# Sensor systems

**Authority:** sensors/ contains equipment and processing. Each sensor owns its receiver/measurement/detection/track logic. Shared environment models live under physics/. Platform modules select exact equipment fit, aperture, installation, resource requirements and cockpit mapping.

## Owners
Radar: active RF radar equipment and processing. RWR: passive radar-emission interception and threat warning. ESM: broader RF measurement, emitter association/geolocation. IRST: passive thermal search/track. EO-FLIR: optical/thermal imagery. IFF: interrogation/reply identity response. MAWS: missile-approach warning via its actual fitted detector. Fusion: correlation of local and remote reports. Weapon seekers: weapon-mounted sensing state, candidate association, track maintenance and dynamic decoy discrimination through the fitted RF/IR/EO/laser observation chain.

## Common chain
Equipment/config/readiness → scheduled observation → physical path/energy input → aperture/receiver/detector → processing → uncertain measurement → optional track association → report/snapshot. Mode commands decide what the equipment attempts; they do not skip physical chain.

## Common output
Reports carry source, acquisition/publication time, frame, range/bearing/angle where measurable, uncertainty, quality, validity, age and provenance. Do not convert world truth into a sensor report.

## Resources and damage
Sensor operation depends on actual power, cooling, warm-up, alignment, hardware readiness and installation limits. Antenna/aperture/receiver damage changes only the affected capability where possible. Weather/terrain are queried through physics/world interfaces.

## Important distinctions
RWR consumes emissions, not radar target tracks. IRST/EO use optical/thermal mechanisms, not visible-mesh hits. MAWS is not RF RWR. IFF no-reply does not equal hostile. Fusion preserves contradictory hypotheses and source age.

Weapon-mounted seeker processing is under sensors/weapon-seeker/; it reuses physical sensor/propagation owners and does not duplicate radar, IRST, optics or thermal physics. Read the exact seeker-family guide for the task. Read the exact sensor README and physics owner for each task; do not load every sensor guide by default.
