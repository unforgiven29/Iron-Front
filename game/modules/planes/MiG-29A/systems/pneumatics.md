# MiG-29 product 9.13 — pneumatic installation

**Shared owner:** game/systems/pneumatics. **Status:** source-based architecture outline; exact applicability of the GAF manual to product 9.13 must be confirmed.

## Source-described architecture

GAF T.O. 1F-MIG29-1, Change 4, describes two independent nitrogen systems: **main** and **emergency**. It states the systems are not charged during flight and that check valves prevent crossfeed. The manual gives pressure bottles charged to 15 MPa, plus an additional 6.3 MPa bottle near the drag-chute compartment. Its system diagram labels main and emergency bottle groups and distinct charging/indication hardware. Keep gas inventory finite; no automatic recharge in the air.

### Main pneumatic consumers

- Normal wheel-brake pressure.
- Canopy opening/closing and seals.
- Drag-chute deployment/jettison.
- Fuel shut-off valves.
- Radio/radar equipment pressurization/ventilation.
- Hydraulic reservoir pressurization through a regulator.
- Periscope system where applicable to the documented fit.

### Emergency pneumatic consumers

- Emergency landing-gear extension.
- Emergency braking of the main wheels.

These are independent reserve functions. Do not allow a main-system leak to drain the emergency bottle unless the source-supported topology includes a failed check valve/cross-connection. A common fill/servicing point does not mean the circuits share operating pressure.

## Hydraulic reservoir interface

Main-system nitrogen is regulated and routed to pressurize the hydraulic reservoirs. This prevents pump inlet cavitation and supports operation under flight acceleration. Pneumatic pressure is a gas-side boundary condition; hydraulic fluid remains inside the hydraulic circuit. Model gas consumption/leak/regulator behavior and resulting hydraulic inlet conditions as separate state.

## Landing gear emergency lowering

Normal landing gear is electrically commanded and hydraulically actuated by the main hydraulic system. Emergency extension uses compressed gas and a specific staged handle sequence described by the manual:
1. Pulling the EMERG GEAR handle aft directs compressed air to extend the nose gear.
2. After the nose gear is confirmed extended, rotating the handle 90 degrees clockwise and pulling full aft commands main-gear extension.
3. Pneumatically driven shut-off valves close hydraulic lines to prevent normal pressure recovery from inadvertently retracting the gear.
4. After emergency extension, normal gear retraction is not available as described by the source.

Implement the exact mechanical and valve sequence, gear lock state, feedback/indication, and reserve pressure. Emergency extension cannot be abstracted to gearDown = true. Verify that this sequence and bottle pressure apply to product 9.13 before authoritative use.

## Brake and anti-skid interactions

Normal wheel brakes are pneumatically operated in the cited manual. Anti-skid uses electrically powered sensing/control and pneumatic valves to release pressure at the affected brake. Emergency braking routes stored emergency pneumatic pressure to the main wheels only; the source describes reduced braking capability and no anti-skid/differential control in this mode. Thus braking requires a coupled state chain: gas reserve → pressure regulation/valve → wheel brake torque, with electrical anti-skid availability as a separate dependency.

Model normal, emergency and anti-skid-inhibited behavior separately. Do not let an electrical fault automatically remove pneumatic pressure, or a gas fault automatically remove electrical anti-skid sensing.

## Failure/maintenance/validation

Represent bottle leakage/depletion, regulator failure, check-valve failure, blocked charging valve, line rupture, pressure indication failure, consumer valve stuck and deployment mechanism damage. Model ground servicing/fill and preflight pressure checks; no in-flight recharge is permitted by the cited source.

Acceptance tests: main/emergency isolation; independent reserve depletion; normal and emergency brake operation; anti-skid electrical loss with pneumatic braking available; emergency main-wheel braking with degraded capability; staged nose-then-main emergency gear extension; hydraulic reservoir pressurization loss; drag-chute bottle behavior; pressure indication powered/failed; and save/replay of bottle inventory and valve state.
