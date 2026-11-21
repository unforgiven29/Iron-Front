# AGM-88 HARM — public family profile and variant boundary

**Stable family ID:** weapon.agm-88.harm-family  
**First platform association:** F-16C Block 50 / F-16CJ SEAD-capable fit.  
**Evidence status:** Official USAF family-level description and public dimensions. This is not a complete AGM-88C engineering data package.  
**Variant boundary:** Keep AGM-88A/B/C, AGM-88E AARGM, AGM-88F and AGM-88G AARGM-ER separate. Do not assign later imaging/active-radar/GNSS capabilities or a larger AARGM-ER body to legacy HARM.

## Public family facts

| Parameter | Published value / description | Evidence status | Source / applicability |
|---|---|---|---|
| Role | Air-to-surface anti-radiation missile | primary-published | USAF HARM fact sheet |
| Length | 4.14 m | primary-published | USAF family fact sheet |
| Diameter | 0.254 m | primary-published | USAF |
| Wingspan | 1.016 m | primary-published | USAF |
| Launch mass | 360 kg | primary-published | USAF |
| Propulsion | Smokeless solid-propellant dual-thrust rocket motor | primary-published | USAF |
| Guidance description | Proportional guidance that homes on enemy radar emissions; fixed antenna and seeker head in nose | primary-published, family-level | USAF |
| Speed | Supersonic | primary-published, family-level | USAF |
| Public range statement | 48+ km | primary-published but condition-incomplete | USAF; do not use as a constant maximum range |
| Warhead | High explosive | primary-published, family-level | USAF |
| F-16 use | USAF fact sheet identifies F-16C as an aircraft using HARM | primary-published | USAF |

Sources:
- [USAF — AGM-88 HARM](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104574/agm-88-harm/)
- [U.S. Government Printing Office mirror of USAF HARM fact sheet](https://www.govinfo.gov/content/pkg/GOVPUB-D301-PURL-LPS104451/pdf/GOVPUB-D301-PURL-LPS104451.pdf)
- [U.S. Government Accountability Office — HARM system description](https://www.gao.gov/products/b-410036)
- [Air & Space Forces — HARM family technical overview](https://www.airandspaceforces.com/weapons/agm-88-harm/)

## Seeker and emitter interaction

A legacy HARM profile is a passive-RF anti-radiation weapon. The relevant causal chain is:
1. A radar emitter produces an RF emission with its own waveform, schedule, antenna pointing, power, operating state and failure state.
2. The RF environment propagates that emission through geometry, terrain masking and modeled propagation effects.
3. HARM's receiver/seeker samples the received RF evidence within its actual receiver/search limits.
4. The seeker develops an emitter observation/track with bearing/quality/uncertainty and any supported identity classification.
5. The weapon guidance/navigation subsystem uses that estimate, its own inertial state and any product-supported memory/updates.
6. The seeker may lose, reacquire or be unable to resolve an emitter; emission shutdown, frequency changes, movement, multiple emitters and false associations must affect the observation history.

The missile may not read the radar site entity's exact position, the ground unit's private sensor track or the campaign target database. An emitter's location is inferred from receiver observations and allowed updates.

The public USAF fact sheet says "proportional" guidance and a fixed nose antenna/seeker. Do not use that sentence as proof of a complete known receiver architecture, memory mode or emitter-identification algorithm. Exact band coverage, frequency agility, processing, memory modes, reattack logic and AGM-88C-specific differences require exact source evidence.

## Propulsion, vehicle and effect behavior

Represent the dual-thrust motor as a time-varying thrust/mass-flow state, not a constant velocity boost. The public source does not provide a thrust-time curve, propellant mass, nozzle dimensions or installed aerodynamic coefficients. Keep these unknown or synthetic-test-only.

Implement a declared vehicle tier with actual aerodynamic drag, mass depletion, control response, gravity and atmosphere coupling. Do not claim 6-DoF behavior if using a simpler point-mass trajectory.

The public fact sheet only identifies a high-explosive warhead. Exact fragmentation distribution, fuze thresholds and damage field are not established here. Connect modeled impact/effect to the shared damage system without scripting a radar site kill.

## F-16 installation is separate

The platform package decides:
- AGM-88C vs other HARM model selection;
- exact station, BRU/rack and LAU launcher compatibility;
- wiring, power, umbilical and Command Launch Computer compatibility;
- HTS / RWR / SMS / cockpit cue integration for the selected OFP;
- release envelope and separation;
- mission equipment configuration and date.

Block 50/52 is associated with SEAD and HARM, but this does not mean every Block 50, date, operator or OFP had an identical HTS/pod/weapons configuration. The platform dossier must model the selected fit explicitly.

## Required tests

- Emitter active, silent, intermittent, damaged, relocated and frequency-changing cases.
- Multiple emitters, overlapping/ambiguous observations, emitter movement and terrain masking.
- Passive receiver has no hidden-emitter-coordinate access.
- RF observation age, uncertainty, missed detections, false associations and track loss.
- Guidance after emission shutdown / permitted memory behavior only when supported by exact HARM variant evidence.
- Launch/release interlock, dual-thrust synthetic motor curve, mass depletion and deterministic replay.
- Fuze/warhead effect remains separate from seeker lock and impact state.

## Current implementation recommendation

Use the family facts only to define physical identity and broad architecture. Do not create an operationally detailed AGM-88C seeker database from the public family fact sheet. The first runtime slice should simulate a generic documented passive-RF observation contract with a synthetic test emitter; later load a real variant profile only when exact public product evidence supports it.