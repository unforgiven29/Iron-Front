# AIM-9M Sidewinder — public technical profile

**Stable profile ID:** weapon.aim-9m.sidewinder  
**Family:** short-range air-to-air missile  
**Platform association:** F-16C Block 50 candidate fit; exact station/OFP/operator authorization remains a platform configuration decision.  
**Evidence status:** Public government/manufacturer-derived summary. Not a motor, seeker or aerodynamic database.  
**Variant boundary:** This page is AIM-9M, not AIM-9L, AIM-9P, AIM-9M-9, AIM-9X or AIM-9X Block II. Do not add imaging-IR or thrust-vectoring features from AIM-9X.

## Published facts

| Parameter | Public value / description | Evidence status | Source / applicability |
|---|---|---|---|
| Length | 2.87 m | primary-published | NAVAIR AIM-9M product page |
| Body diameter | 0.13 m | primary-published | NAVAIR |
| Launch mass | 85.5 kg | primary-published | NAVAIR |
| Overall span | 0.63 m | primary-published | NAVAIR; public fact sheets use rounded geometry |
| Propulsion | Hercules Mk 36 solid-propellant rocket motor | primary-published | NAVAIR |
| Speed | Supersonic; public NAVAIR value approximately Mach 2.5 | primary-published, family/product-page value | Do not use as a constant throughout flight |
| Public range statement | 10–18 miles in NAVAIR summary | primary-published but condition-incomplete | Do not convert into a deterministic range gate |
| Guidance | Solid-state infrared homing | primary-published | NAVAIR / USAF |
| Target detector | Active optical target detector is listed as a major component | primary-published | USAF Sidewinder fact sheet; exact detector implementation needs variant-specific detail |
| Warhead | Annular blast-fragmentation, high explosive | primary-published | NAVAIR / USAF |
| M-model improvement | Improved resistance to infrared countermeasures, enhanced background discrimination and reduced-smoke motor | primary-published | USAF fact sheet |
| Refrigeration | Air Force AIM-9M fact sheet describes optional TMU-72 argon coolant tank for cooling the refrigerated detector during captive carriage | primary-published for the stated Air Force fit | Exact captive-carry fit and servicing logic must be selected |

Sources:
- [NAVAIR — AIM-9M Sidewinder](https://www.navair.navy.mil/product/AIM-9M-Sidewinder)
- [USAF — AIM-9 Sidewinder fact sheet](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104557/aim-9-sidewinder/)
- [Air Combat Command — AIM-9M/AIM-9X fact sheet (2020)](https://www.acc.af.mil/Portals/92/Docs/Fact%20Sheets%20-%202020%20Update/AIM-9M_Formatted.pdf?ver=2020-06-23-093759-823)

## Seeker and information path

Model the AIM-9M as a passive infrared homing weapon. It does not receive a target's hidden world transform. The aircraft provides a timestamped cue/boresight or handoff estimate where its avionics and launcher interface support it. The missile's own seeker must perform its own search, candidate detection, acquisition and tracking.

Keep these states independent:
1. Captive/coolant and pre-launch equipment state.
2. Launch cue available, stale or unavailable.
3. Seeker uncaged/caged state only where the exact aircraft/weapon control fit supports it.
4. Search/scan state.
5. Detection candidate(s) with measured angle/quality/uncertainty.
6. Acquired track with track age and history.
7. Guidance valid, degraded, coasting or lost.
8. Fuze safe/arming/armed/triggered/failed states.

Do not model the seeker as a single "heat-seeking = true" flag or assign one universal flare-immunity value. The infrared scene, detector response, filtering, background discrimination, candidate association, target aspect/thermal state, flare spectrum/age, obscuration and track history must contribute to the observed result. Exact transfer functions and counter-countermeasure thresholds remain unknown unless a source is found.

## Vehicle and dynamics requirements

Use a missile vehicle model with:
- Exact mass and CG as public data becomes available; until then, mass distribution/inertia are unknown.
- Solid motor ignition transient, thrust-time profile, propellant depletion, burnout and plume/signature state. A thrust curve is not currently supplied by the public profile.
- Actual airframe aerodynamic forces and moments, drag, control-surface/actuator dynamics and control saturation. Do not invent fin rates, maximum lateral acceleration or full aerodynamic coefficient tables.
- Powered and coast flight phases; gravity and atmosphere/wind coupling.
- Vehicle limits and validity envelope represented as unknown where unsupported.

The published Mach/range statements are broad context, not a validated trajectory or engagement-envelope dataset.

## Electrical, launcher and release interfaces

The aircraft-specific package owns rail/launcher geometry, station compatibility, umbilical, coolant servicing/captive-carry support, launch command validation, release impulse and aircraft store-removal effects. The missile package owns internal missile state after the separation event.

A release request must be rejected when the missile is not loaded, the launcher/interface is incompatible, required pre-launch state is unavailable, or aircraft release interlocks fail. Do not let a cockpit button directly spawn a missile.

## Warhead and fuzing

The public sources establish annular blast-fragmentation warhead family and an optical target detector. They do not provide a complete fragment distribution, fuze timing/arming logic or calibrated damage field. Keep those data fields unknown or synthetic-test-only; connect the warhead effect to the shared damage/effects system rather than script a guaranteed aircraft kill.

## Required tests

- Correct AIM-9M variant composition; reject AIM-9X seeker/control features.
- Mass/dimension/unit checks and explicit unknown-field handling.
- Captive refrigeration/coolant available, unavailable and depleted/expired states when selected fit is modeled.
- Cue versus seeker search/acquisition distinction; stale cue and invalid cue.
- Aspect/background/obscuration/flare scene produces observations, not a fixed probability multiplier.
- Candidate ambiguity, track transfer, coast, loss and reacquisition.
- Motor ignition, burnout and mass change using synthetic fixture curves until sourced data exists.
- Fuze safe/arm/trigger and warhead/damage handoff with synthetic test fixtures.
- Deterministic replay and no hidden-target-truth access.