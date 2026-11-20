# Launcher, station and store compatibility definitions

Own station/store compatibility data and release-interface configuration: station identity, attachment transform, mass/limit envelope, electrical/data interface, rack/ejector/rail, interlocks, release direction/impulse, safe separation conditions and supported stores.

Platform provides installation geometry and cockpit command mapping. Launcher validates exact compatibility, pylon/rack limits, configuration, interlocks and release conditions. Successful separation publishes event and hands initial state to weapon runtime. Carrier updates its own mass/CG/inertia/drag. Do not let weapon spawn itself on invalid station.

Validate compatible/incompatible stores, asymmetric loading, load limits, failed interlock, release impulse/direction, separation collision and pylon damage.
