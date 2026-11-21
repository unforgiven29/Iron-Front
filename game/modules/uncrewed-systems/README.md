# Uncrewed aircraft and loitering systems

**Owner:** game/modules/uncrewed-systems. **Status:** architecture only; no drone runtime is implemented.

Own the installed configuration and mission lifecycle of uncrewed aerial systems (UAS), remotely piloted aircraft, FPV attack drones, one-way attack systems and loitering munitions. Do not collapse them into one generic drone type.

## Families and distinct capabilities
- Small ISR UAS: camera/thermal payload, navigation, endurance, launch/recovery and observation reporting.
- FPV / short-range remote attack: operator station, video link, control link, battery/endurance, antenna/orientation, latency, link loss and terminal behavior.
- One-way attack systems: navigation plan, target-area logic, terminal sensor if fitted, fuel/energy reserve, route and impact/failure lifecycle.
- Armed remotely piloted aircraft: sustained flight, sensor/targeting payload, weapon stations, remote crew, communications and recovery.
- Tactical loitering munitions: search/hold/abort behavior, seeker architecture, permitted target classes and terminal control.

A platform's payload, mission computer, autonomy, navigation and control link are separate properties. Do not assume all drones have a video feed, continuous remote control, a terminal seeker or the same susceptibility to interference.

## Control and link model
Operator command → authenticated/authorized link attempt → propagation/interference/antenna/equipment → delayed, corrupted, degraded or delivered command → vehicle response. Loss of link follows the selected vehicle's documented/configured lost-link policy (hold, return, continue route, safe descent, abort, or mission-specific terminal behavior). Jamming/navigation interference acts on the relevant physical/communication chain, not a single global drone penalty. AI/autonomy acts only on onboard sensors, stored mission and received commands.

## Campaign and tactical integration
UAS can provide reconnaissance reports with source, time, uncertainty and quality; relay communications; observe artillery corrections; or deliver a weapon. FPV teams require operators, launch stock, batteries, service and a control station. One-way systems consume inventory and may strike facilities or infrastructure. Air defence, small-arms fire, EW and weather affect them according to fitted sensors, signatures and physical links. A drone event is not automatically a confirmed kill or an omniscient target report.

## Validation
Link quality versus range/orientation/terrain; latency and loss; stale video; navigation degradation; lost-link behavior; autonomy with no remote updates; sensor report provenance; battery/fuel endurance; launch/recovery/rearm; target discrimination; damage and interception; campaign stock accounting; dense-swarm performance.
