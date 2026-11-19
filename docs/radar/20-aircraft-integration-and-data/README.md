# 20 — Aircraft Integration and Radar Data

## Purpose
Describe how specific radar sets are installed on individual aircraft and how variants, interfaces, documentation, and data are represented.

## Categories
- **Equipment identity:** manufacturer, designation, generation, and documented variant.
- **Aircraft fit:** aircraft, production block, upgrade variant, and installation differences.
- **Antenna installation:** aperture size/shape, nose or radome constraints, orientation, and boresight alignment.
- **Electrical and cooling interfaces:** power buses, peak/average demand, cooling capacity, and startup dependencies.
- **Mechanical interfaces:** mounting, gimbal envelope, vibration, stabilization, and aircraft-motion inputs.
- **Avionics interfaces:** displays, controls, mission computer, datalink, IFF, navigation, and sensor-fusion connections.
- **Software/capability baseline:** supported modes, waveform options, track capacity, and software differences.
- **Cockpit controls:** aircraft-specific controls and displays connected to actual radar state.
- **Startup/shutdown:** power sequence, built-in test, warm-up, standby, transmit authorization, and shutdown.
- **Limits/restrictions:** operating envelope, environmental limits, maintenance restrictions, and caveats.
- **Reference documentation:** manuals, papers, photographs, diagrams, dates, page references, and source confidence.
- **Uncertainty register:** unknown, estimated, disputed, or variant-dependent information.

## Data quality
Do not silently transfer capabilities between variants. Do not invent classified values. Separate public specifications, credible estimates, and gameplay tuning parameters.

## Boundary
Describes platform installation and equipment-specific data. Shared radar behavior belongs in the subsystem folders.
