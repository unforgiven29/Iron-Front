# Engine installation and flight-model coupling

**Owner:** physics/flight-model/propulsion-integration for aircraft installation transforms and the FM force interface. physics/propulsion owns engine-family thermodynamics and spool/thrust behavior; game/systems/fuel owns fuel inventory/feed; aircraft packages define exact engine fit. **Status:** architecture only.

The A-4E-C has a separate Engine2 component and fuel system, with the flight model consuming engine output. Iron-Front should keep that separation and make the installed engine transform explicit.

## Installation definition

Each engine installation records engine capability/family and exact variant; engine reference point/station; thrust-axis orientation; inlet face and installed inlet recovery/distortion data reference; nozzle/exhaust direction and geometry reference; dry/installed mass and mass-property contribution; fuel feed path; accessory drive output/load connections; cooling/thermal/fire zones; damage mapping; and provenance.

Twin-engine aircraft define two distinct installation records. Do not multiply one engine's thrust by two without independent spool, fuel feed, damage, inlet, temperature, accessory and asymmetry state.

## Force coupling

The engine model returns thrust vector and any supported non-axial installation effect with reference point/frame, tick, actual operating state and validity. The installation adapter transforms this into the aircraft body/world frame and supplies application-point moment through the shared force contract.

Do not let the flight-model assembly infer engine thrust from throttle position. Throttle is a command; the engine model returns actual thrust after spool inertia, ambient conditions, fuel delivery, limits, damage and installation effects.

## Coupled effects

Depending on evidence and fidelity, couple inlet distortion/recovery, bleed/accessory extraction, nozzle/afterburner state, thrust asymmetry, exhaust heating, propwash/jet interaction with surfaces, and engine-out effects. Detailed engine internal fluid/thermodynamic equations remain outside this folder.

## Tests

Single and twin engine installation transforms; left/right engine independent spool/fuel/damage; thrust direction and moment arm; accessory load feedback; altitude/Mach changes; engine start/shutdown/relight; fuel starvation; inlet damage; asymmetric thrust and replay. Check that engine force appears exactly once in the rigid-body contribution set.
