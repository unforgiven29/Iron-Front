# Water bodies, coastlines and bathymetry

Own water-region geometry and metadata: sea/lake/river type, coastline/boundary, depth/bathymetry source, vertical datum, surface state and current/wave data when supported. Do not infer depth from a visual polygon.

Naval mobility/grounding, amphibious units, collision, navigation, optical/RF background and renderer use separate contracts. Start with reliable static surface/depth/shore queries; add currents/waves only with measured input/update models. Visual waves are not force-producing waves.

Validate shoreline transition, river/lake boundary, bathymetry interpolation/datum, grounding and chunk seams.
