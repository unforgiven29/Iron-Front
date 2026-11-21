# Weapon seeker, guidance and countermeasure acceptance

**Purpose:** Define acceptance evidence for weapon composition, guidance-family separation, seeker state processing and dynamic decoy interactions. **Status:** requirements only; no complete weapon seeker/guidance/CM runtime exists.

## Entry conditions

- Weapon profile/component composition schemas and compatibility validation exist.
- physics/ballistics, physics/propulsion and physics/guidance expose typed contracts.
- sensors/weapon-seeker consumes physical observation reports, not world truth.
- Countermeasure products expose deployment state and changing signature/trajectory.
- Each scenario records exact weapon/seeker/software variant, target/decoy configuration, environment, initial state, seed, tick and data provenance.

## Composition and information-flow tests

### WPN-01 — Component composition
A missile profile resolves exact body, motor, aero/control, guidance, seeker, fuze/warhead, launcher, power/cooling and link profiles. Missing required illuminator, datalink, power or cooling prevents the unsupported mode from operating. No silent fallback to a different seeker or guidance system.

### WPN-02 — Guidance taxonomy separation
Information source, navigation/midcourse mode, terminal seeker, radar angle-measurement method, guidance law and actuator/control authority are independently represented. Tests reject invalid combinations and prove that one guidance family does not imply another.

### WPN-03 — No hidden target truth
Weapon guidance and seeker modules receive only onboard state, measured observations and permitted external updates with timestamps/uncertainty. A test target's hidden truth table is inaccessible to the weapon runtime. Initial cue is not a guaranteed lock or hit.

## Guidance family tests

### WPN-04 — Command guidance
Test director track age/uncertainty, command timing/latency, receiver state, command loss and defined coast/fail behavior. Target updates are not instantaneous perfect truth.

### WPN-05 — Radar beam riding
Test beam-reference pointing, beam divergence/position, receiver measurement, target/director motion, masking, scan/reference loss, guidance error and control saturation.

### WPN-06 — Laser beam riding versus semi-active laser
The beam-rider follows the received beam reference. The SAL seeker follows observed energy reflected from an illuminated spot. A fixture that swaps these outputs must fail. Obscuration/designator/receiver loss produces the architecture-specific behavior.

### WPN-07 — Conventional SARH and monopulse SARH
Both require external illumination and target return. Conventional scanning and monopulse measurement are distinct sensor configurations. Test angle error, scan timing/loop response, monopulse channel quality, false/multiple returns, illumination break and reacquisition. Monopulse must not be assigned a universal chaff-immunity flag.

### WPN-08 — ARH midcourse/search/terminal
Test launch cue uncertainty, inertial drift, delayed/missed datalink updates, handover/search volume, candidate detection/association, track initiation, terminal track and loss/reacquisition. Multiple candidates may yield no acquisition or a different candidate; seeker does not always acquire the launch-designated entity.

### WPN-09 — Infrared seeker families
Create separate test profiles for spin-scan reticle, conical scan, rosette scan, another non-imaging scan type if supported, imaging IR focal-plane seeker, and multispectral/dual-band seeker where supported. Test each profile's scan/frame timing, detector response, background/contrast, cooling/power, FOV/gimbal and track continuity. The same scene must not collapse into one generic IR range calculation.

### WPN-10 — Passive RF / EO / optical
Test emission-based passive RF observations, TV/EO image measurements, IIR scenes, semi-active laser designation and mode-specific limits through the appropriate physical owner. Power, obscuration, background and target designation errors remain visible.

## Dynamic countermeasure tests

### WPN-11 — No scalar susceptibility
Runtime schema rejects or ignores a single seeker chaff/flare susceptibility scalar as the decision mechanism. Qualitative sourced ratings may be annotations only. Actual decisions use dynamic observations, seeker architecture, track history and candidate association.

### WPN-12 — Chaff scene
Vary release time, cloud age, dispersion, wind, range, geometry, frequency/polarization where modeled and target/decoy range-rate. The RF scene and seeker measurement must change. Test maintain-target, decoy-association, rejection, coast and lost outcomes where the observation stream supports them.

### WPN-13 — Flare scene
Vary ejection timing/separation, flare radiance/burn age/spectrum/trajectory, target aspect/thermal state, seeker bandpass, background, clouds/obscuration, detector saturation and track history. An IR scanning seeker and an IIR seeker may produce distinct results from the same scene.

### WPN-14 — Active and towed decoys
Test activation/power, emissions or repeater state, antenna geometry, decoy motion, towed tether/payout, break/cut, failure and seeker candidate association. Decoys are not instant teleport offsets or guaranteed spoofer results.

### WPN-15 — Multiple decoys and multiple targets
Test simultaneous decoys, multiple real targets, unresolved/resolved candidates, false alarms, candidate swaps, association uncertainty and track memory. Preserve ambiguous/no-track outcomes.

### WPN-16 — Environmental and damage interactions
Test wind/dispersion, terrain/sea/ground clutter, atmospheric/optical attenuation, sensor aperture/detector damage, seeker power/cooling loss, gimbal damage and dispenser faults. Only connected components are affected.

## Lifecycle and vehicle physics

### WPN-17 — Safe release and separation
Verify station compatibility, mass/CG/inertia/drag changes, release impulse/direction, safe separation, interlocks and failed-release state.

### WPN-18 — Motor, trajectory and control limits
Verify motor start/transient/burnout/mass depletion, declared point-mass/3-DoF/6-DoF fidelity, aerodynamic envelope, guidance command saturation, actual actuator response and lost-guidance policy.

### WPN-19 — Fuze, warhead and damage result
Separate arm delay/conditions, proximity/contact/time function, dud/inert/self-destruct and warhead output from target damage after physical interaction. No detonation merely because target range reached zero.

### WPN-20 — Determinism and performance
Replay the same observation/input stream with fixed seed and configuration to reproduce seeker associations, guidance states and outcomes. Measure cost per seeker update and candidate count. No render-frame-dependent outcomes or silent fidelity reduction.

## Required evidence

Each report records test ID, exact variant/profile versions, source/provenance, target/decoy/environment setup, observation stream, seed, tick, expected assertions, tolerances, actual outcomes and known limits. Separate synthetic consistency, sourced-data comparison, simulator-log comparison and independent real-world validation. No one test or static rating validates an entire seeker envelope.
