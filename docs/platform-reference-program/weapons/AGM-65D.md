# AGM-65D Maverick — public technical profile

**Stable profile ID:** weapon.agm-65d.maverick  
**Family:** air-to-surface electro-optical / imaging-infrared missile  
**Platform association:** F-16C Block 50 candidate fit; exact station/launcher/OFP clearance remains a separate aircraft configuration.  
**Evidence status:** Official USAF family/variant description and dimensions/mass; detailed IIR electronics and aerodynamic data are not included here.  
**Variant boundary:** AGM-65B is EO/TV; AGM-65D is imaging IR; AGM-65E is semi-active laser and penetrator; AGM-65G is IIR with heavyweight penetrator. Never reuse the same seeker or warhead data for all variants.

## Published facts

| Parameter | Published value / description | Evidence status | Source / applicability |
|---|---|---|---|
| Variant | AGM-65D | primary-published | USAF Maverick fact sheet |
| Launch mass | 218.25 kg (485 lb) | primary-published | USAF |
| Diameter | 0.3048 m (12 in) | primary-published | USAF family/variant data |
| Wingspan | 0.7112 m (28 in) | primary-published | USAF |
| Propulsion | Thiokol TX-481 solid-rocket motor; common propulsion section across family as described by USAF | primary-published, family-level | USAF |
| Guidance | Imaging infrared (IIR) | primary-published | USAF AGM-65D variant description |
| Warhead | 125 lb / 56.7 kg cone-shaped shaped-charge family, as described for B/D/H | primary-published | USAF; exact fill and effect parameters not published here |
| Fuze | Nose contact fuze for shaped-charge version | primary-published, family-level | USAF |
| Public range/speed | Classified in the USAF fact sheet | unknown | Do not use secondary range numbers as a hard simulation limit |

Sources:
- [USAF — AGM-65 Maverick](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104577/agm-65-maverick/)
- [U.S. Navy — AGM-65 Maverick Fact File](https://www.navy.mil/Resources/Fact-Files/Display-FactFiles/Article/2168374/agm-65-maverick-guided-missile/)
- [Air & Space Forces — AGM-65 family overview](https://www.airandspaceforces.com/weapons/agm-65/)

## Seeker behavior

AGM-65D uses an imaging-infrared seeker. It must not be simulated as the AGM-65B television seeker or the AGM-65E laser receiver.

The scene-to-track chain must include:
- target/background thermal contrast and target aspect;
- thermal state, material/emissivity model and environmental conditions to the declared tier;
- sensor optics, detector response and image sampling;
- image stabilization and boresight state;
- candidate detection, correlation/contrast gates and track initiation;
- tracking memory, target movement and gimbal/field-of-view limits where sourced;
- obscuration, weather, smoke, damaged optics and target/background similarity;
- track quality and uncertainty.

A visual lock box is a presentation result from the seeker observation pipeline. It must not directly point the missile at hidden target coordinates.

## Vehicle and launch

A missile release requires valid station configuration, electrical/umbilical initialization where required, SMS selection and launcher interlocks. The platform controls separation geometry and updates its own mass, CG, inertia and drag when the missile leaves.

The weapon runtime then models motor ignition/transient, propellant depletion, aerodynamic drag/lift, control surface actuation, gravity, atmosphere and vehicle response at an explicitly declared fidelity tier. Exact thrust-time and aero/control tables are not established by this profile. Do not use a single constant-speed or straight-line homing shortcut.

## Warhead and damage

The public source describes a 125 lb shaped-charge family and contact function. That is enough to identify the broad effect family, not to invent liner geometry, penetration depth or exact behind-armour spall. The fuze state machine, impact angle, target material and shared armour/damage model determine the result within a declared evidence envelope.

## Required tests

- Reject B-model TV seeker and E/G heavy penetrator warhead fields when loading the D variant.
- Imaging-IR scene changes with contrast, aspect, background, weather and obscuration.
- Track can fail, drift, reacquire or select an ambiguous candidate; no hidden truth.
- Target motion after lock and off-axis loss.
- Motor ignition/burnout with synthetic test curve; declared trajectory fidelity tier.
- Contact fuze, impact geometry, shaped-charge effect handoff and partial/failed damage.
- Aircraft station compatibility, release impulse, aircraft mass/drag change and deterministic replay.