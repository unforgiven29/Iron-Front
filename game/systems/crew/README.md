# Crew stations, workload and human actions

**Owner:** game/systems/crew. **Status:** architecture only; no crew runtime is implemented.

## Responsibility
Represent crew members and operating stations as stateful participants. Platform packages define real stations, roles, seat/escape equipment, access, controls and procedures. Crew system owns shared contracts for availability, workload, injury/incapacitation, station transfer and human action state.

## State
Member identity/role, station assignment, availability, workload/fatigue where supported, injury, incapacitation, survival, escape/restraint and handover status. Crew identity is separate from vehicle state and campaign casualty history.

## Human action path
A control input becomes a command issued by a station. AI skill/training/doctrine may influence speed/error/priority, but cannot bypass equipment validation. Procedures/checklists request actions and compare feedback; they do not force hidden equipment state.

## Consequences
Workload comes from simultaneous tasks, warnings, communication and threat. At declared fidelity, overload may delay/miss a task. Injury/incapacitation can remove station capabilities and create evacuation/CSAR/medical events. Treatment/evacuation are separate medical/logistics interfaces.

## Tests
Station authorization, command route, injury/incapacitation, handover, workload overload, escape sequence, rescue/evacuation and save/restore; UI cannot mutate crew or equipment state.
