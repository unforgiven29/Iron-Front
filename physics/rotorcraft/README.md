# Rotorcraft aerodynamics and rotor dynamics

**Owner:** physics/rotorcraft. **Status:** design guide; no rotorcraft solver is implemented.

Own reusable rotor aerodynamic and mechanical models. The aircraft module supplies rotor geometry, blade/twist/airfoil data, control geometry, inertia, transmission layout and exact installation; the rigid-body solver integrates resulting forces and moments.

## Physical model boundary
Represent main/tail/auxiliary rotors as rotating lifting systems with blade-element or another declared fidelity method. The model may resolve induced/inflow velocity, azimuthal local relative flow, blade pitch, flapping/lag where supported, rotor speed/governor, inflow transients, rotor thrust/torque, hub moments, tail-rotor side force and power demand. Aggregate each rotor's contribution at its actual aircraft reference point.

Supported effects are explicit configuration capabilities, not universal toggles: translational lift, ground effect, vortex-ring-state conditions, retreating-blade stall, advancing-tip compressibility, translational/sideward flight effects, autorotation, rotor droop, torque/yaw coupling, rotor wake and rotor-to-rotor interaction. Each requires a validity envelope and validation case before it can affect the authoritative model.

## Causal coupling
- Engine torque and throttle/governor response feed gearbox and rotor state.
- Rotor rpm and blade pitch determine thrust/torque through the rotor solution; actuator and control-system limits constrain command response.
- Rotor power demand loads the engine/transmission; transmission, clutch, gearbox and shaft failures alter delivered power.
- Main rotor torque and tail-rotor/anti-torque authority couple into yaw and sideslip.
- Rotor damage, blade loss, icing/erosion and structural limits change mass balance, inertia, vibration and available lift only through supported damage mappings.
- Downwash affects nearby dust, vegetation, loose objects and water spray through world/physics effect interfaces, not render-only particles.

## Outputs and limits
Publish per-rotor thrust/force, hub moments, torque/power demand, rpm, inflow state, control effectiveness and validity/uncertainty. Do not return a canned lift multiplier or directly set aircraft velocity. Missing blade/aero/gearbox data remains unknown or uses a clearly labeled synthetic gameplay profile.

## Validation
Hover power and trim; torque/yaw balance; climb/descent and forward-flight transition; translational lift; ground-effect height sweep; sideslip and pedal authority; rotor rpm droop/recovery; autorotation entry/flare/landing where data supports it; retreating-blade stall boundary; damaged-blade imbalance; deterministic replay and frame-budget behavior.
