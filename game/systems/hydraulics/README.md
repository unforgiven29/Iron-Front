# Hydraulic circuits and actuator supply

**Owner:** game/systems/hydraulics. **Status:** architecture only; no circuit solver.

Platform configuration supplies pumps, reservoirs, accumulators, lines, valves, filters, actuators, circuit topology and rated limits. This system owns pressure/flow/fluid network state; core/resources arbitrates grants; actuators own position/rate response and controls.

Track pressure, flow, fluid quantity/temperature/contamination where supported, pump speed/capacity, accumulator state, line restriction/leaks and transient pressure. Pressure is not instantly restored after a demand spike. Consumers include flight controls, gear, brakes, steering, doors and turret drives.

Faults include pump loss, line rupture/leak, valve stuck, accumulator loss, overheating and contamination. Model isolation/crossfeed/backup circuits from exact installation; independent circuits remain independent. Validate simultaneous loads, actuator authority under partial pressure, pressure decay, pump loss, accumulator behavior, backup transfer and no cross-circuit bleed.
