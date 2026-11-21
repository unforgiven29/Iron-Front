# Aircraft control-surface command and aerodynamic mapping

**Owner:** aircraft package for flight-control laws/mixing and surface mapping; physics/flight-model/control-surfaces owns the shared mapping contract. **Status:** architecture only.

This subsystem converts command intent into a requested physical surface state. It does not decide the actual motion; actuator/resource owners and aircraft system installations determine what surface position is achieved. The aerodynamic elements consume actual measured/estimated surface positions.

## Command chain

Pilot axes, trim, autopilot/stability augmentation and mode inputs → aircraft-specific control-law/mixing adapter → surface target command → actuator request → actual actuator position/rate/force/availability → surface state snapshot → aerodynamic elements.

Do not bypass a step by writing aileron/elevator/rudder positions directly from input axes. The command, target, actual position and indicated position are distinct values.

## Mapping configuration

The aircraft package describes control IDs, physical surface IDs, sign/deflection limits, neutral/reference position, hinge and actuator mapping, gearing/mixing, differential or symmetric behavior, scheduled mode, trim coupling, control effectiveness dataset and sensor/feedback source.

Control labels are not universal geometry. A “pitch” input may drive all-moving stabilators, elevators, tailerons or multiple coupled surfaces depending on the aircraft. A “roll” input may move ailerons, spoilers or differential stabilators. Shared code must not branch on aircraft display name.

## Control-law boundary

Flight-control laws, stability augmentation, limiters, gain schedules and mode logic are aircraft-specific systems. The FM assembly consumes their typed surface requests and actual output. Do not implement F-16 FLCS law as a generic control algorithm for the MiG-29 or a tank turret.

Control computers and powered servo valves may require electrical supply; actuator force/motion may require hydraulic pressure/flow. A control computer being powered does not prove the surface moved. A hydraulic actuator having pressure does not prove it received a command.

## Failed and degraded cases

Support command disconnect, sensor disagreement, jammed/stuck surface, runaway/biased command, actuator rate/force loss, hydraulic circuit loss, electrical servo/valve loss, mechanical linkage damage, surface separation and feedback sensor failure where installed. Exact aircraft behavior and reversion mode must come from platform evidence.

## Tests

Test axis sign and range; trim and neutral; mixing matrices; symmetric/asymmetric commands; control-law mode transition; actuator saturation; rate-limited response; resource loss; jam/runaway; surface-feedback disagreement; deterministic replay; and cross-platform proof that identical shared interfaces can produce different control mappings.


## Surface and device taxonomy

The shared contract must represent more than `aileron`, `elevator` and `rudder`. Support:
- ailerons, elevators, all-moving stabilators, tailerons, rudders and elevons;
- flaperons, leading-edge flaps, slats and trailing-edge flap families;
- spoilers/spoilerons/lift-dump panels;
- fuselage/wing speedbrakes and airbrakes;
- trim/balance/servo tabs and other auxiliary devices only when fitted.

The platform config declares what exists. A missing device is not silently created by the shared engine. Use the [high-lift and drag-device guide](../high-lift-devices/README.md) for the physical distinctions, schedules and actuator/effect contract.

## Actuator and surface state detail

Where data supports it, model actuator command/target/actual/indicated position separately, with:
- maximum travel, rate, acceleration and load/pressure-dependent rate;
- hinge moments, mechanical leverage, friction, backlash/free play and stops;
- hydraulic pressure/flow, electrical control/servo supply, pneumatic or mechanical drive as fitted;
- actuator lag and finite movement time;
- left/right/segment independence, synchronization or asymmetry protection;
- failed feedback, jam, runaway, leakage, damage and reversion behavior.

Do not implement all aircraft as identical first-order servos. The actuator model and failure architecture are installation-specific. A simplified actuator tier must still enforce declared rate/load/resource limits and document omitted effects.
