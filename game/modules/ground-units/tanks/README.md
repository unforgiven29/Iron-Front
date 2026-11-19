# tanks

Tank module boundary: variant-specific hull/turret geometry, armour layout, mobility, powertrain, crew, sights, weapons and damage data.

## Module requirements
- Provide a versioned manifest and schema-validated configuration for each concrete variant.
- Keep content data separate from shared algorithms and mutable runtime state.
- Declare dependencies, capabilities, coordinate frames, units, lifecycle and failure outputs.
- Use shared physics/sensor/resource/damage services through explicit contracts.
- Avoid hardcoded vehicle names, faction branches and duplicated solvers.
- Record sources, confidence and uncertainty for technical values.
- Include integration and negative tests when runtime implementation begins.

**Status:** Folder and handoff documentation only.
