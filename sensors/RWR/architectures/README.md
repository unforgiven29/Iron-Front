# RWR Architecture Boundaries

This folder contains equipment-specific RWR architecture definitions and adapters. It does not own shared RF propagation, generic tracking math or cockpit rendering.

Represent capabilities as explicit configuration: receiver topology, frequency coverage, instantaneous bandwidth, scan/channel strategy, antenna apertures, direction-finding method, measurement outputs, processing capacity, supported signal families, health dependencies and software/library baseline.

Do not infer architecture from aircraft name alone. Different blocks, export fits and software baselines may carry different equipment. Each configuration must link to source provenance and an uncertainty record.

Possible implementation families include swept narrowband receivers, parallel/channelized receivers, wideband/instantaneous receivers and hybrid systems. These are architectural categories, not claims that a particular aircraft has a given fit. Their detection timing, simultaneous-signal handling and measurement limits must differ because of the modeled hardware.
