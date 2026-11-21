# F-16C Block 50 — control-surface and actuator mapping

**Owner:** F-16 platform configuration and control-system adapter. Shared control/actuator contracts live in physics/flight-model/control-surfaces and actuator-coupling. The F-16 electrical/hydraulic solvers own actual resource supply. **Status:** installation map required; no functional FLCS/actuator implementation implied.

## Configuration to document

Record pilot/stick/pedal/trim input channels; FLCS mode/law and command shaping; surface mixing and limiters; each commanded surface and sign; stabilator/aileron/rudder/leading-edge device/speedbrake mapping; actuator grouping and hydraulic circuit ports; electrical power to computers/servo valves; position/pressure feedback sensors; mechanical stops; failure/reversion modes; cockpit indications and caution/warning logic.

The F-16 uses a fly-by-wire flight-control system. Do not treat pilot pitch/roll/yaw input as a direct surface angle. The selected Block 50's exact control-law schedules, gains, limits and software revision need source-specific records.

## Causal execution

Pilot input → confirmed flight-control law → surface target → actual actuator with hydraulic/electrical/mechanical constraints → actual position/feedback → aerodynamic element deflection. The FM reads actual achieved surface state. It must not substitute target for achieved position during an actuator fault.

Use game/modules/planes/F-16/systems/ for installed hydraulic A/B and electrical/FLCS power details. Actuator loss must reflect connected system topology and the exact documented residual control authority. Do not create a generic backup actuator or hydraulic crossfeed.

## Failure cases

Document and test FLCS computer/branch power loss; sensor disagreement; command channel fault; servo-valve electrical loss; hydraulic pressure/flow loss; actuator leakage/jam; linkage/surface damage; asymmetric actuator response; position feedback failure; and reversion/degraded law. Exact aircraft behavior and reversion mode must come from platform evidence.

## Acceptance

Verify axis signs, neutral/trim behavior, control mixing, commanded-versus-achieved deflection, rate/force limit, resource loss, asymmetric response, reversion logic and deterministic replay. Never tune aerodynamic coefficients to disguise incorrect FLCS or actuator behavior.
