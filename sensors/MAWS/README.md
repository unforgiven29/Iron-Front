# Missile approach warning system (MAWS)

**Owner:** sensors/MAWS. **Status:** architecture only; no detector/tracker runtime.

Model the physical mechanism of the installed warning equipment: UV/IR optical detectors, imaging arrays, distributed apertures or another documented architecture. MAWS is not an RF RWR and is not a universal missile-truth feed.

Chain: observable threat signature → environment/background path → aperture/FOV coverage → detector/noise/saturation → temporal/spatial processing → candidate event → warning confidence → cockpit/countermeasure command interface. Include blind zones, finite coverage, false alarms and misses. It must not automatically reveal missile identity, exact launch point or perfect trajectory.

Countermeasure dispensing belongs to crew/avionics commands and validated launcher. Validate coverage, blind zones, obscurants, own-engine interference, warning latency, false alarms, sensor damage and resource loss.
