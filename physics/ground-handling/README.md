# Aircraft ground handling, landing gear, tires and braking

**Owner:** physics/ground-handling. This is the shared physical interface for aircraft ground motion. Aircraft packages provide exact gear layout, strut/tire/brake/steering configuration and limitations; game/systems owners provide hydraulic/electrical supply and anti-skid/control interfaces; physics/collision provides contact geometry; rigidbody integrates chassis motion. **Status:** architecture only; no ground-handling runtime exists.

## Purpose and boundary

Aircraft ground handling is not a visual gear animation or a friction scalar. It includes landing-gear deployment/retraction, oleo/strut compression, wheel/tire contact, rolling and sliding, steering, braking, anti-skid, runway surface interaction, landing impact and dynamic coupling back into the aircraft 6-DoF state.

This owner calculates physical contact/force and internal ground-gear state. It does not own the aircraft's global position integration, collision-world truth, hydraulic network, electrical supply, cockpit switch or damage/campaign history.

## Platform installation data

Every aircraft fit must define, with exact applicability and source:
- nose/main gear count, placement, track, wheelbase and attachment reference stations;
- gear leg geometry, pivot axes, extension/retraction kinematics and door sequence;
- strut type, stroke, gas/oil or equivalent force model, damping, preload, friction, stops and limit loads;
- wheel/rim/tire dimensions, mass/inertia, inflation/pressure if known, tire stiffness, vertical/lateral/longitudinal response and thermal limits;
- tire-to-runway friction model and supported surface classes;
- brake type, torque limits, thermal capacity/cooling, control valves and brake circuit routing;
- anti-skid sensors/logic, release/reapply timing and failure modes where fitted;
- nosewheel steering actuator, steering authority/speed schedule, tiller/rudder coupling, centering and shimmy constraints;
- weight-on-wheels/strut switches, squat switch logic, gear indications, warning logic and interlocks;
- emergency extension method and actual independent supply/sequence;
- gear doors, uplocks/downlocks, downlock indication and asymmetry/failure behavior;
- tailhook/catapult/barrier interfaces only for aircraft with supported carrier or special-field equipment.

Unknown parameters remain unknown; use clearly synthetic fixtures for tests only.

## Contact and integration chain

1. Collision produces contact candidates with world-space contact point/normal, separation, relative velocity, material and time-of-impact where supported.
2. Gear assembly transforms candidate contact into wheel/strut-local coordinates and determines contact validity, stroke and contact patch state.
3. Tire model computes normal, longitudinal and lateral forces from load, slip, slip angle, wheel speed, surface condition and tire state.
4. Strut model computes compression/rebound force from displacement/velocity and installation-specific nonlinear characteristics.
5. Brake and steering commands pass through actual actuator/resource state; requested torque/angle is not automatically achieved.
6. The ground-handling owner returns equal-and-opposite contact force/impulse, gear reaction and wheel/strut state through typed interfaces.
7. Rigidbody integrates the aircraft body; wheels integrate rotational speed; damage/thermal/system owners receive committed load/heat/fault events.
8. Weight-on-wheels and gear-state observations are published for aircraft systems, FLCS ground logic, cockpit and mission rules.

Do not edit world position to keep an aircraft grounded. No rendering callback or animation may determine touchdown, bounce or braking.

## Tire and wheel dynamics

At the chosen fidelity, include:
- wheel angular inertia and spin-up/spin-down;
- longitudinal slip ratio and lateral slip angle using consistent low-speed regularization;
- combined-slip force limits rather than unlimited independent longitudinal/lateral forces;
- normal-load dependence, tire deflection/contact patch approximation and load transfer;
- rolling resistance, lateral force/cornering response and transient tire relaxation where data supports it;
- runway friction variation by wetness, contamination, rubber, snow/ice or roughness only when world surface data supports it;
- hydroplaning or aquaplaning only as an explicitly scoped model with required water depth/speed/pressure inputs;
- blowout, flat tire, pressure loss and wheel bearing/structural damage with degraded force/heat behavior.

Do not assign one universal tire friction coefficient or force curve to every runway/aircraft combination.

## Strut and landing-impact dynamics

The gear leg must resolve relative motion and load:
- compression/rebound stroke, gas spring/oil damping or selected equivalent;
- nonlinear damping or orifice behavior if sourced/required;
- bottoming, extension stop, friction and side-load limits;
- compression/rebound asymmetry and energy dissipation;
- nose/main gear differences and multiple-wheel load sharing;
- touchdown rate, sink-rate response, bounce/rebound, gear walk or shimmy only where validated;
- structural load transfer into aircraft hardpoints and local airframe stress.

Landing impact feeds structural-response/overload owner. A hard touchdown should not instantly damage a generic gear-health percentage; effects depend on transmitted loads, limit/ultimate/inspection criteria and actual component routing.

## Braking, anti-skid and steering

Braking must be a closed-loop physical interaction:
- cockpit pedal/autobrake/parking-brake command;
- brake controller or valve behavior where fitted;
- actual hydraulic/electric pressure and brake torque;
- wheel angular deceleration and tire longitudinal slip;
- anti-skid sensor measurement, control latency and pressure modulation;
- brake temperature, fade/derating, cooling and fire risk if supported;
- left/right asymmetry, one-circuit failure, locked wheel and tire burst;
- differential braking and nosewheel/rudder steering interaction.

Anti-skid does not magically maximize friction. It observes wheel behavior and modulates brake force with delays, thresholds and equipment limits. Failed sensors, electrical loss or hydraulic pressure loss must produce the exact supported degraded mode.

Nosewheel steering has its own angle/rate/speed constraints, command source, mechanical centering and actuator failure. At higher speed, control may transition to rudder aerodynamic authority; do not use one unrestricted steering mapping at all ground speeds.

## Aircraft-specific coupling

The F-16 and MiG-29 use different gear geometry, wheel/tire/strut layouts, steering/brake systems and emergency extension paths. Both must plug into the same contracts but retain unique installed data and procedures. Gear doors, gear-induced drag, weight-on-wheels logic and emergency gear extension are aircraft-specific. Do not infer one aircraft's emergency extension from another.

Carrier aircraft may additionally require launch bar/catapult, holdback, nose gear launch stroke, arresting hook and deck-motion interfaces. Keep these as optional interfaces; never grant carrier capability to a platform without exact equipment evidence.

## Damage and environmental interaction

Represent individual wheel/tire/strut/door/actuator/brake/line/attachment damage. Effects may include asymmetric drag, gear collapse, steering loss, brake fade/lock, leak, pressure loss, structural overload and inability to retract. Water, runway contaminants, crosswind, slope and roughness influence contact only via world surface/weather state.

## Update rates, determinism and performance

Ground gear/tire contact may need a faster substep than airborne aerodynamic coefficients due to stiff contact and short impact events. Define a deterministic substep contract and a bounded solver iteration count. Use stable contact ordering and fixed tolerances. Do not let frame rate or random jitter alter contact resolution. Profile active contact points and wheel counts.

## Validation matrix

- static ground load and wheel-load distribution;
- strut compression/rebound and energy conservation;
- drop test over several sink-rate cases;
- tire longitudinal/lateral and combined-slip trends;
- braking distance/stop response on sourced or declared test surfaces;
- anti-skid modulation, sensor fault and resource loss;
- steering response at low/high taxi speeds and crosswind;
- touchdown, bounce, rollout, runway roughness and asymmetrical gear;
- wheel/tire/strut/brake/gear damage and emergency extension;
- ground-to-air and air-to-ground transition without discontinuous force;
- contact ordering, timestep/substep convergence, deterministic replay and cost.

## Research references

Use [Advanced flight physics references](../../docs/reference-library/advanced-flight-physics.md) for NASA tire/landing-gear research. Exact aircraft gear layout, tire pressure, shock-strut curve, braking/anti-skid and steering data must come from the exact platform's applicable documentation.
