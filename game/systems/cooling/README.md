# Cooling and equipment thermal-management networks

**Owner:** game/systems/cooling. **Status:** architecture only; no cooling network runtime.

Own installed coolant/airflow distribution: pumps, fans, heat exchangers, radiators, loops, ducts, valves and equipment cooling capacity. physics/thermal owns generic heat-transfer math; equipment owns heat generation/limits; this system owns the network capacity delivered.

Track coolant mass/flow, pressure, inlet/outlet temperature, pump/fan state, heat exchanger capacity, ambient conditions, valve, fouling/leak and load. Cooling depends on actual flow and thermal gradient, not a cooled boolean.

Consumers include engine oil/coolant, RF transmitters/T-R modules, avionics, power electronics, batteries and cabin. Faults: pump/fan loss, coolant leak, blockage, heat exchanger damage, valve stuck, power loss. Only connected loops should be affected.

Validate steady-state heat rejection, transient rise, flow restriction, leak, pump failure, ambient extremes, equipment derating and cooldown/recovery.
