# Aircraft electrical generation, distribution and loads

**Owner:** game/systems/electrical. **Status:** architecture specification; a complete network solver is not implemented.

This is the reusable electrical-network owner. Aircraft packages define the exact installed sources, drives, buses, protection devices, wiring, connectors, consumers and emergency architecture. The shared system executes that installation; it must not assume every aircraft has the same generator count, AC/DC layout, bus names, ratings or redundancy.

## Ownership boundary

This system owns source output, bus/network state, protection, switching, load allocation as physically delivered, electrical faults and electrical indications exposed to consumers.

- game/core/resources arbitrates declared offers and demands. It does not decide voltage, current, waveform, bus connectivity or protection trips.
- physics/propulsion owns engine dynamics. An aircraft installation couples an accessory drive/generator to engine spool, gearbox, shaft speed, oil/temperature and mechanical failure.
- game/systems/hydraulics owns hydraulic pressure/flow. An electrically driven hydraulic pump consumes electrical power; an engine-driven pump does not become an electrical load.
- Equipment owns its internal operating state and performance response to delivered power.
- Cockpit/renderer reads published measurements and sends switch commands. It never sets a bus to powered.

## Model the installed topology, not a universal aircraft template

An installation may contain any evidence-supported combination of engine-driven AC generators, DC generators, starter-generators or permanent-magnet generators; constant-speed drives, gearboxes, clutches, accessory shafts and power take-offs; APU generators, ram-air turbines, emergency power units or other documented emergency sources; main, standby, essential, non-essential, emergency, battery, avionics, weapon, sensor and dedicated flight-control buses; AC single/three-phase and DC networks; transformers, rectifiers, inverters and converters; batteries, chargers, isolated battery buses and dedicated flight-control supplies; bus ties, diodes, contactors, relays, circuit breakers, current limiters, overcurrent sensing contactors, ground-power receptacles, connectors, wiring and protective isolation.

A source is not a bus. A bus is not a battery. A generator failure is not equivalent to a total electrical failure. Encode connectivity and switching conditions explicitly.

## Runtime state and electrical quantities

Track the quantities appropriate to the selected fidelity and equipment:

- Source: available mechanical input, shaft RPM/torque, drive engagement, excitation/field state, terminal voltage, frequency, phase, current, real/apparent/reactive power where supported, temperature, capacity and fault state.
- Bus: nominal and instantaneous voltage, frequency, phase/phase balance where relevant, current, power, connected sources, contactor state, topology, quality/validity and protection state.
- Branch/load: requested and delivered voltage/current/power, startup/inrush demand, continuous and transient demand, priority, allowed interruption, undervoltage/overcurrent limits, heat and fault state.
- Battery: chemistry/configuration, terminal voltage under load, current, charge/energy state, temperature, internal resistance, discharge limit, charge acceptance, aging/health and isolation state.
- Converter/transformer: input envelope, output waveform/voltage/frequency, efficiency/loss, thermal state, rating and failure modes.
- Wiring: resistance/impedance, connector condition, temperature, route/zone, insulation damage and intermittent/open/short faults.

Do not use a single powered boolean as the electrical model. A boolean may be a derived consumer convenience only after the owning solver has established that all of the consumer's declared minimum requirements are met.

## Electrical network behavior

1. **Generation.** Source output depends on its true drive source and operating envelope. Engine RPM, gearbox/constant-speed-drive state, APU state, EPU/RAT state, excitation, thermal limits and damage matter when applicable.
2. **Conversion.** Transformers, rectifiers and inverters have explicit input/output domains, ratings, efficiency, startup, protection and failure. A failed AC source may still leave DC or converter-backed essential power; do not infer the result without the installed diagram.
3. **Distribution.** Buses and branches form a directed/controllable network. Contactors and ties have command, permissive, delay, interlock, feedback and welded/stuck failure states. Current/voltage can only flow along a physically connected path.
4. **Load response.** Loads request a waveform/voltage/frequency envelope and time-dependent demand. A radar, display, pump, actuator, radio, heater, fuel pump, engine control, lighting circuit and flight-control computer have distinct profiles.
5. **Protection.** Overload, short circuit, overvoltage, undervoltage, overtemperature and frequency faults trigger the installed protection device after its actual threshold/delay/logic. A protective trip isolates the affected branch; it must not erase unrelated buses.
6. **Degraded operation.** A standby/emergency source feeds only the buses and loads its installed topology permits. Load shedding occurs in configured order. Loads may brown out, reset, degrade, operate intermittently or remain alive on isolated reserve power.
7. **Recovery.** Reset, generator reconnect, bus re-tie and battery recharge require the correct prerequisites. A fault that the real installation requires ground maintenance to clear must not silently reset in flight.

For AC networks, select a fidelity tier explicitly. A practical staged model may use RMS voltage/current, frequency, phase and impedance first, then introduce phase imbalance, power factor, harmonics and waveform detail only when they affect equipment behavior. DC networks must still account for voltage drop, resistance, load transients and protection. Do not claim a full electromagnetic circuit simulation when using a lumped network model.

## Load contract

Every consumer declares stable equipment/load ID and exact platform installation; required electrical domains (AC/DC, nominal voltage, permitted range, frequency/phase constraints and conversion dependency); demand curve (inrush/startup, warm-up, idle, normal, peak/transient and shutdown); priority and shedding class; minimum ride-through time; restart behavior; whether supply interruption is safe; power factor/efficiency or equivalent simplified load behavior; heat output; and cooling dependency where relevant.

A resource grant is not proof that required voltage was delivered. The electrical network reports actual delivery and power quality; each consumer decides its own resulting degraded/failed state.

## Batteries and reserve power

A battery is finite stored energy, not an infinite emergency generator. Model capacity, chemistry, voltage under load, current limits, temperature, aging, charge/discharge efficiency, self-discharge if relevant, isolation, charger behavior and load-dependent endurance. Dedicated flight-control batteries/branches remain separate when the aircraft uses them.

Emergency generation is a different source with a different activation chain, fuel/bleed/rotor/mechanical dependencies, rating, run time, startup delay, exhaust/thermal effects and load-shedding scheme. A shared EPU can couple electrical and hydraulic survival, but only the exact aircraft package may declare that connection. Do not invent a RAT, EPU, standby generator or redundant bus for a platform.

## Failure catalogue

Support failures as independent, damageable components where the topology contains them: drive/gearbox failure; loss of engine accessory RPM; generator trip/excitation failure; constant-speed-drive malfunction; battery depletion/overheat; charger failure; inverter/rectifier/transformer failure; open/short/intermittent wire; connector separation; bus fault; contactor/relay stuck open or closed; breaker/protection trip; ground-power misconnection; fluid ingress/fire/thermal damage; and incorrect switching.

Damage propagation follows wires, bus segments and components actually connected to the damaged zone. A short must not globally disable an aircraft unless the installation proves that the fault is common-mode.

## Update and integration order

Run source/mechanical coupling after engine/accessory state is available; solve generation and bus topology; evaluate branch voltage/current and protection; publish delivered power; then update equipment consumers. Use fixed simulation time, deterministic ordering and declared electrical substeps. Avoid solving every wire at render frequency. Use equivalent circuits or aggregated branches where individual conductors do not affect the intended fidelity.

Hydraulic pumps, cooling pumps/fans, radar transmitters, avionics, displays, lighting, ignition, fuel pumps, anti-skid, flight-control computers and actuator valves consume power only when connected and commanded. Their electrical demand must be able to change the bus state.

## Required validation

- Source startup, minimum drive RPM, load response, trip and restart.
- AC frequency/voltage regulation and DC voltage sag under transient loads.
- Converter/transformer output and failure-domain isolation.
- Battery discharge, reserve endurance, cold/hot derating and recharge.
- Contactors, bus ties, breaker delay/trip, reset and stuck states.
- Main-source failure, standby transfer, emergency activation and configured load shedding.
- Short/open faults with proof that only connected branches are affected.
- Power loss and restoration at each consumer; sensor resets/warm-up and actuator response.
- Simultaneous electrical and hydraulic failures; a shared emergency source is consumed/limited once, not duplicated.
- Deterministic replay, energy balance and performance under representative aircraft load counts.

## Data and evidence rules

Every source, rating, threshold, battery chemistry, bus assignment, load and protection delay has units, exact variant/block/operator applicability, document/page, date/revision, confidence and review status. Distinguish source values from derived values, estimated values and gameplay tuning. If a value is not verified, represent it as unknown/provisional and define a safe fidelity fallback. Never copy a value from one block, export fit or engine installation to another without evidence.

## First implementation slice

Implement typed source, bus, branch, load, battery, converter, contactor and protection definitions; validate topology and units; build a deterministic DC network first; then add AC RMS/frequency behavior, switching, source transfer and battery dynamics. The first aircraft installation must prove one normal source, one reserve source, multiple bus classes, actual load shedding, a connected fault, cockpit indications and save/replay. The installation guide selects the exact network; the shared solver contains no aircraft-name branches.
