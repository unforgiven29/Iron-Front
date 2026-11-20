# Content and platform modules

**Owner:** game/modules. **Status:** package boundaries and documentation exist; most domain runtime implementations remain future work.

Content modules select and configure shared capabilities. They are not a second home for physics/sensor engines. A loadable module has stable ID/version, kind, capabilities, dependencies, schema-validated configuration, lifecycle and provenance.

## Package families
- planes: exact aircraft variants, installations, cockpit mappings and platform data.
- weapons: exact weapon products and component composition.
- ground-units: tanks, IFV/APC, artillery and air-defense platform configuration.
- infantry: individuals, squads, behavior/equipment profiles.
- naval-units: ship variants and carrier operations.
- ai: doctrine, agent behavior and command/control.
- logistics: supply, transport, repair and resource distribution.
- campaign: factions, scenarios, missions, strategic state and campaign history.

## Common module layout guidance
Use only the subpackages that the actual product supports. Typical responsibilities include definition/data, installation/configuration, controls, damage mapping, assets and validation. Do not create empty module trees simply to imitate another platform. A folder may be data organization rather than an independently loadable module.

## Composition rules
Shared algorithm remains under its canonical owner. Module manifests reference capabilities/API versions, not directory paths or display names. Required missing dependencies fail before runtime; optional absence has explicit degraded behavior. No silent equipment substitution. Exact fit and software baseline matter.

## Adding a product
Identify exact variant/operator/software baseline; record source applicability; define geometry/mass/installation; select shared capabilities; add control/asset mappings; validate compatibility and failure paths; prove consumers work without shared name-based branches.
