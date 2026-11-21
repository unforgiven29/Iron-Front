# Content and platform modules

**Owner:** game/modules. **Status:** package boundaries and documentation exist; most domain runtime implementations remain future work.

Content modules select and configure shared capabilities. They are not a second home for physics/sensor engines. A loadable module has stable ID/version, kind, capabilities, dependencies, schema-validated configuration, lifecycle and provenance.

## Package families
- planes: exact fixed-wing aircraft variants, installations, cockpits and platform data.
- rotorcraft: helicopters and other rotorcraft installations, rotor geometry, drivetrain and operating procedures.
- uncrewed-systems: ISR UAS, FPV aircraft, one-way attack systems, loitering munitions and remotely piloted aircraft.
- civil-aviation: airliners, cargo/general aviation, route intent, civil identification and traffic procedures.
- weapons: exact weapon products and component composition.
- ground-units: tanks, IFV/APC, artillery and air-defence platform configuration.
- infantry: individuals, squads, combat/equipment profiles, medical support and casualty evacuation.
- naval-units: surface ships, submarines, carrier operations and maritime mission compositions.
- ai: tactical doctrine, agent behavior and command/control.
- logistics: supply, transport, repair and resource distribution.
- campaign: factions, scenarios, missions, world-war state, strategic institutions, intelligence, society, personnel and history.

## Common module layout guidance
Use only the subpackages that the actual product supports. Typical responsibilities include definition/data, installation/configuration, controls, damage mapping, assets and validation. Do not create empty module trees simply to imitate another platform. A folder may be data organization rather than an independently loadable module.

## Composition rules
Shared algorithm remains under its canonical owner. Module manifests reference capabilities/API versions, not directory paths or display names. Required missing dependencies fail before runtime; optional absence has explicit degraded behavior. No silent equipment substitution. Exact fit and software baseline matter.

## Adding a product
Identify exact variant/operator/software baseline; record source applicability; define geometry/mass/installation; select shared capabilities; add control/asset mappings; validate compatibility and failure paths; prove consumers work without shared name-based branches.
