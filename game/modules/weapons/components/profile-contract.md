# Weapon profile composition contract

**Purpose:** show how one weapon variant references small, independently validated component profiles. **Status:** proposed data contract and design guide only; this is not an implemented schema or runtime.

## Why profiles are separate

A weapon variant is a composition root. It selects exact hardware/data profiles and defines which capabilities are fitted. The profiles describe data; shared owners implement behavior. This keeps missile variants small, readable and independently testable, and avoids one huge weapon JSON object with every parameter mixed together.

## Suggested composition shape

The following YAML-like example is illustrative and intentionally has no performance values:

~~~yaml
weapon:
  id: example-guided-missile-variant
  version: 1.0.0
  applicability:
    product: exact-product-designation
    variant: exact-variant
    software: exact-software-baseline
  components:
    vehicle: profiles/vehicle/example-airframe
    aerodynamics: profiles/aero/example-aero-data
    motor: profiles/motors/example-motor
    controlSystem: profiles/controls/example-autopilot
    navigation: profiles/navigation/example-navigation-fit
    guidance: profiles/guidance/example-guidance-composition
    seeker: profiles/seekers/example-seeker-fit
    powerThermal: profiles/power/example-power-fit
    fuze: profiles/fuzes/example-fuze
    warhead: profiles/warheads/example-warhead
    launcherCompatibility: profiles/launchers/example-station-interface
    countermeasureObservation:
      processorCapability: sensors/weapon-seeker/countermeasure-discrimination
      seekerProfileRef: profiles/seekers/example-seeker-fit
  capabilities:
    requires:
      - propulsion.rocket
      - guidance.inertial
      - seeker.radar
    optional:
      - datalink.target-update
  provenance:
    sourceSet: sources/example-source-set
    reviewState: unverified
~~~

The names above are examples, not a real weapon configuration. Product profiles must contain actual evidence-backed values and exact applicability.

## Required profile properties

Each referenced component profile has:
- Stable type and ID, semantic version and schema version.
- Exact product/variant/software applicability.
- Typed units and coordinate/reference conventions.
- Required and optional capabilities.
- Inputs/outputs and dependency contracts.
- Operating and validity envelope.
- Failure/degraded behavior where applicable.
- Source title/revision/page or test reference.
- Provenance class: source-reported, derived, estimated, synthetic-test or gameplay-tuned.
- Confidence/review state and uncertainty.

Do not duplicate the same authoritative value in multiple profile files. If multiple systems need a value, reference its owner or publish a derived immutable snapshot with source lineage.

## Guidance composition dimensions

Do not represent guidance as a single enum. Separate:
1. Information/illumination source (command link, beam reference, external radar illuminator, onboard active radar, passive RF, IR/EO/laser observation).
2. Navigation and midcourse source (INS, external updates, command, GNSS/other nav, prebriefed waypoint, or none).
3. Terminal seeker architecture (active/semi-active radar, IR scan, IIR, EO/TV, semi-active laser, passive RF or none).
4. Seeker measurement technique (for example conventional scan angle tracking or monopulse).
5. Guidance law and command frame.
6. Autopilot/control method and actual actuator authority.
7. Lost-link/lost-track, coast, reacquisition and termination policy.

Only compatible combinations validate. For example, SARH must resolve a compatible illuminator; a beam-rider must resolve a beam reference; ARH must have an onboard active radar path; IR terminal homing must have the corresponding IR detector profile.

## Countermeasure response is not a missile constant

Do not add fields such as one universal chaff-susceptibility, flare-susceptibility or decoy-immunity scalar as the runtime behavior. The weapon references its seeker profile and a shared countermeasure-discrimination processor. Decoys supply physical/signature state; RF/thermal/optical systems create observations; the seeker processing associates candidates at each update using current observations and history.

A qualitative susceptibility label may be retained only as a cited descriptive annotation for documentation/UI, never as the simulation outcome. Runtime outputs should include candidate association, reject/transfer/maintain/coast/lost/reacquire reasons and uncertainty.

## Validation before a profile can load

- All required references resolve to matching profile types and supported versions.
- Exact applicability is compatible across vehicle, motor, guidance, seeker, fuze/warhead and launcher.
- Required illumination, command, datalink, power, cooling and control interfaces exist.
- Units, axes, frames and supported value domains validate.
- No duplicate ownership of a physical algorithm or authoritative runtime state.
- Missing required/classified values stay unknown/provisional and disable unsupported fidelity rather than receiving invented defaults.
- A versioned profile-composition test can save/replay and emits actionable diagnostics.
