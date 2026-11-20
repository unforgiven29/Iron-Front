# MiG-29 product 9.13 — second-platform systems architecture acceptance

**Purpose:** Prove the shared electrical, hydraulic and pneumatic system contracts can represent a materially different fighter installation without copying F-16 topology or adding aircraft-name branches to shared solvers.

**Selected identity:** single-seat MiG-29 product 9.13 (repository folder/display label MiG-29A).  
**Status:** acceptance design only. The GAF T.O. 1F-MIG29-1 is a source for a Luftwaffe-operated MiG-29 installation, but exact product 9.13 applicability must be confirmed before its detailed values become authoritative. These tests must distinguish “the implementation matches the selected sourced configuration” from “the implementation matches product 9.13.”

## Entry conditions

- Shared electrical, hydraulic, pneumatic, propulsion, cooling, fuel, actuator and cockpit-indication contracts are implemented and tested.
- The selected 9.13 hardware graph is a schema-valid platform configuration with explicit unknown/provisional values.
- Any GAF-derived fit that is not confirmed for product 9.13 is tagged as a source configuration/variant candidate, not silently selected as 9.13 truth.
- Fixed tick, deterministic seed, module versions and exact dataset revision are recorded.

## Acceptance scenarios

### MIGSYS-01 — Exact platform and source applicability
The aircraft package resolves to product 9.13, not 9.12, 9.13S, 9.13B, 9.13SE or an unspecified generic MiG-29. Every electrical, hydraulic and pneumatic datum records its source/revision, page, confidence and product applicability. An unconfirmed GAF value remains provisional.

### MIGSYS-02 — AC generation and constant-speed drive
The AC generator is represented as a source mechanically driven through the documented gearbox/constant-speed-drive interface for the selected configuration. Test engine RPM changes, load changes, drive oil pressure/temperature, overspeed, clutch disconnect and generator isolation. The generator must not keep providing rated constant-frequency AC after its drive disconnects.

### MIGSYS-03 — Separate DC generation and DC protection
The DC generator is a separate source with its own output/regulation/protection. Test DC bus load response, low output, overvoltage and short-circuit disconnect. If the selected data confirms a ground-crew reset requirement, the protective trip remains latched and cannot be cleared by an ordinary in-flight switch cycle.

### MIGSYS-04 — PTO converter and AC load shedding
The PTO DC/AC converter is not a full replacement AC generator. On AC generator or transformer failure, it supplies only its configured supported AC domains and only within its finite output envelope. The selected configuration's non-flight-essential load list is shed individually; unrelated consumers are not globally switched off. Converter overload and transformer failure must produce the documented distinct losses.

### MIGSYS-05 — Battery reserve and ground-power modes
Test the two configured silver-zinc batteries only if the selected product fit confirms them. Model finite charge/energy, voltage sag under load, temperature, current limits and charge behavior. Test battery-supported internal start and DC-generator loss; do not assume batteries replace main AC generation or the PTO. Ground external AC/DC supply is available only through its validated connection and interlock path.

### MIGSYS-06 — Main and boost hydraulic circuits
Represent main and boost as independent physical circuits when confirmed for product 9.13. Each has its own gearbox-driven variable-displacement pump, reservoir, pressure/flow state, return path, accumulator and protection. They must not share pressure or fluid except through an explicitly configured component/path.

### MIGSYS-07 — Dual-chamber flight-control actuators
Each primary flight-control actuator has its correct chamber-to-circuit connections. Test simultaneous actuator movement, load demand, differential force, rate saturation and partial loss. Failure of one circuit must degrade the configured actuator behavior rather than immediately setting all controls to zero or allowing the surviving chamber unlimited authority.

### MIGSYS-08 — Main-system priority/isolation under low pressure
Where the confirmed installation includes a pressure limiter/isolation valve, test its actual threshold, hysteresis/delay if specified, utility isolation and preserved flight-control consumer set. Utilities on the isolated branch lose supply while the surviving control path retains only its defined reduced authority.

### MIGSYS-09 — Fuel-pressure-driven emergency hydraulic pump
If confirmed for product 9.13, model the emergency pump as a boost-circuit pump driven by fuel pressure with documented auto/manual activation conditions and engine-RPM prerequisites. Test pressure and flow independently: a high static pressure with insufficient flow must not produce normal actuator rate. Its emergency output is not electrical generation and must not be treated as an F-16 EPU.

### MIGSYS-10 — Main and emergency pneumatic separation
If the selected fit has independent main and emergency nitrogen systems, preserve separate finite bottles, regulators, pressure indicators, check-valve isolation and charging/servicing rules. Test main-system leak with emergency reserve isolated; a failed check valve can create crossfeed only when explicitly damaged.

### MIGSYS-11 — Pneumatic reservoir pressurization and hydraulic feed
Where installed, main pneumatic gas pressurizes the hydraulic reservoir headspace through its regulator. Deplete or isolate the pneumatic source and verify the hydraulic reservoir does not instantly lose all fluid, but its pump inlet/cavitation margin and sustained flow degrade through the configured coupling. Both gas and hydraulic-fluid inventory are conserved separately.

### MIGSYS-12 — Fuel heat exchange and hydraulic thermal response
Where confirmed, reservoirs in fuel tank 3 exchange heat with fuel. Test hydraulic heat generation, fuel/hydraulic temperature response, flow/thermal coupling and heat-exchanger failure. Do not set hydraulic temperature equal to fuel temperature or use fuel quantity as a direct hydraulic-pressure control.

### MIGSYS-13 — Electrical indication can fail independently
The source-described combined pressure indicator uses 115 VAC from the AC generator. Where confirmed for the selected fit, remove this supply while maintaining actual hydraulic pressure. The cockpit indication becomes invalid/unavailable; underlying hydraulics remain physically active and diagnostics do not mistake the failed gauge for measured zero pressure.

### MIGSYS-14 — Gear, brake and anti-skid path separation
Test normal landing-gear electrical command and hydraulic actuation separately from pneumatic emergency extension. Test normal pneumatic braking, emergency stored-gas braking and electrically powered anti-skid control/valves as separate dependencies. Emergency braking must be degraded and must not inherit normal anti-skid/differential control unless the selected aircraft source proves otherwise.

### MIGSYS-15 — APU and engine accessory source modes
If confirmed for the selected configuration, test APU ground power/operation, its start prerequisites, fuel supply, electrical/hydraulic outputs and engine-gearbox disconnect/interlock. Do not allow APU outputs beyond their documented mode/capacity or make them an in-flight backup by assumption.

### MIGSYS-16 — Damage, fault isolation and common-mode failures
Damage to a wire, connector, generator drive, fluid line, gas line, reservoir, pump, valve, converter or cooling path affects only connected hardware. Test realistic common-mode faults such as loss of a shared gearbox drive or shared cooling source. A common source must not be accidentally duplicated by two consumers.

### MIGSYS-17 — Save, replay and configuration comparison
Save all network inventory and component state: generator/drive state, source connection, bus and protection state, battery charge, converter, hydraulic fluid/pressure/accumulator state, pneumatic bottle gas, valve state, thermal state and fault latches. Replay from the same tick/seed/data version. Compare the MiG package against the F-16 using the same shared interfaces and prove that different hardware graphs produce different behavior without any aircraft-name conditional.

## Required evidence

Record scenario ID, exact platform/source configuration, document/page/revision, data-provenance class, seed, fixed tick, assertions, tolerances, result and known limitation. If the GAF manual cannot prove exact product 9.13 applicability, report the result as validation against the GAF-described configuration only; do not label it a validated 9.13 result.

A cockpit mockup, static system diagram, energized boolean or screenshot is not acceptance evidence for pressure/flow, source transfer, backup endurance or fault isolation.
