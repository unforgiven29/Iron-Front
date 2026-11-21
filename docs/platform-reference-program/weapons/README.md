# Initial weapon technical evidence library

**Purpose:** Give Claude a concrete, source-linked starter library for the weapons associated with the first two aircraft. These are data/evidence packages, not claims that weapon runtime is implemented.

**Status:** Initial public-source profiles. Exact installation clearance, software baselines, detailed aerodynamic tables, control-system maps, seeker transfer functions, fuze thresholds and classified performance remain incomplete unless explicitly stated.

## Start with these profiles

| Product | First platform association | What the package establishes | Important limitation |
|---|---|---|---|
| [AIM-9M Sidewinder](AIM-9M.md) | F-16C Block 50 | Public dimensions, mass, IR architecture, motor family and warhead class | No public seeker transfer function, motor curve or validated performance envelope |
| [AIM-120C-5 AMRAAM](AIM-120C-5.md) | F-16C Block 50 | Variant dimensions/mass and active-radar/inertial/datalink architecture | Speed/range and detailed C-5 seeker/motor maps are not public in the cited sources |
| [AGM-88 HARM family](AGM-88-HARM.md) | F-16C Block 50 | Passive-RF anti-radiation architecture and family dimensions/motor class | Keep B/C/E/F/G variants separate; do not treat family factsheet as complete AGM-88C data |
| [AGM-65D Maverick](AGM-65D.md) | F-16C Block 50 | IIR seeker, solid motor, mass/dimensions and warhead family | Guidance image-processing and exact variant limits are not public here |
| [R-27R Alamo-A](R-27R.md) | MiG-29 product 9.13 candidate | SARH variant, seeker identity and external published physical/operating claims | Product 9.13 installation clearance still needs exact manual evidence |
| [R-27T Alamo-B](R-27T.md) | MiG-29 product 9.13 candidate | IR variant and seeker family separation from R-27R | Do not assume it was in every 9.13 unit/fit |
| [R-73A Archer](R-73A.md) | MiG-29 product 9.13 | Domestic R-73A identity, IR seeker and airframe-control architecture | Do not substitute export R-73E or later R-73M/R-74 |
| [M61A1 Vulcan](M61A1.md) | F-16C Block 50 | Six-barrel 20 mm gun family and official public rate of fire | 500/511-round installation counts conflict across public sources; use baseline explicitly |
| [GSh-30-1](GSh-30-1.md) | MiG-29 product 9.13 | 30 mm internal cannon family and 150-round aircraft installation evidence | Rate of fire and ammunition mix require primary manual/source confirmation |

## How Claude must use the profiles

1. Read the profile before creating weapon configuration or code. Do not rely on a weapon name alone.
2. Preserve each product/variant identity. AIM-120B is not AIM-120C-5; R-27R is not R-27T; R-73A is not R-73E or R-73M; AGM-88C is not AARGM/AGM-88E.
3. Only adopt values labeled **primary-published** as exact published values, and still check exact variant/equipment applicability. A government fact sheet can be authoritative for a family-level fact but not necessarily a particular production lot.
4. **Secondary-reported** and **simulator-reference** are useful research clues, not ground-truth model parameters. Do not combine values from different sources into one artificial exact profile.
5. Unknown values must remain explicitly unknown. Do not replace classified or unavailable range, speed, seeker, motor or aerodynamic data with convenient public internet estimates.
6. Where a simulation needs a value that cannot be sourced, use a clearly declared **synthetic-test-only** fixture or a separately versioned **gameplay-tuned** profile. Never label it real-world accurate.
7. Weapon profiles describe products. Aircraft packages separately define whether a station, rack, launcher, wiring, software and operator baseline can carry/use that product.

## Minimum technical depth per weapon

Claude must model or explicitly defer the following, as applicable:

- Physical geometry, reference datum, mass, CG, inertia and changing mass.
- Motor stages, ignition, thrust-time data, propellant consumption and burnout state.
- Aerodynamic/control-surface geometry, coefficient data and validity envelope.
- Navigation source, guidance information source, guidance law and update/latency behavior.
- Seeker hardware, acquisition/search/track states, observations, uncertainty, FOV/gimbal/rate limits and countermeasure interactions.
- Power, cooling, built-in test, umbilical/data-link and captive-carriage requirements.
- Safe/arm interlocks, fuze family, warhead family and damage/effect handoff.
- Carrier launcher, release impulse, separation, compatible stores and failure/recovery paths.
- Exact source, variant applicability, provenance, units, uncertainty, known omissions and validation scenarios.

Do not implement every subsystem at once. First create schema-valid product profiles from this evidence, then implement one complete air-to-air missile slice and one simpler weapon slice under the roadmap. A profile file does not mean the runtime exists.

## Source quality and limits

Preferred evidence order: exact applicable technical order/operator manual/manufacturer data; government program or service fact sheet; instrumented public test report; independent engineering/academic analysis; secondary reference; another simulator's guide. Every fact must retain its actual source class.

Useful source routes include the U.S. Air Force / NAVAIR fact sheets, U.S. Army ODIN Worldwide Equipment Guide entries, government acquisition reports and the NLR technical report on aircraft gun/munition identification. Falcon BMS and DCS material can explain simulator-level workflows, but it is not independent proof of real-world performance.