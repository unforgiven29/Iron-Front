# MiG-29 product 9.13 — platform technical evidence package

**Role:** Second full-fidelity fixed-wing aircraft and proof that Iron-Front supports a materially different aircraft model.
**Selected identity:** single-seat product 9.13 (the repository folder label MiG-29A is organizational).
**Status:** Research roadmap and source-linked requirements. The current public source set has important gaps; this file does not claim a complete 9.13 aerodynamic database or authoritative systems manual.

## Source baseline and cautions

Start with the [existing MiG-29 source register](../../../game/modules/planes/MiG-29A/docs/references/README.md). Add accepted facts there with the [source-record template](../../reference-library/source-record-template.md).

Additional public source routes:
- [GAF T.O. 1F-MIG29-1 flight manual (PDF mirror)](https://jasonblair.net/wp-content/uploads/2015/06/MIG29-Flight-Manual-Pt-2.pdf) — useful for control categories, flap/LEF operation, speedbrakes and flight-control descriptions. It is a German Air Force technical-order source; exact applicability to the selected plain product 9.13 must be established before adopting numeric values or circuit details.
- [GAF T.O. 1F-MIG29-1 copy / manual index](https://www.airwar.ru/other/manuals/%5Baviation%5D%20-%20%5Bmanuals%5D%20-%20MiG-29%20Flight%20Manual.pdf) — another access route to the same broad manual family; verify revision and applicability.
- [DCS MiG-29 English Flight Manual](https://www.digitalcombatsimulator.com/en/downloads/documentation/dcs-mig-29_flight_manual_en/) — simulation/manual context only. The repository source register notes the modeled MiG-29 9-13/S caveat. Do not use as a primary product 9.13 manual.
- [DCS MiG-29 CFD case-study discussion](https://www.digitalcombatsimulator.com/en/news/2021-05-28/) — simulator developer case study only; test setup and modeled geometry must be checked. Not an independent real-aircraft coefficient database.
- [U.S. Naval Postgraduate School institutional archive overview](https://calhoun.nps.edu/) — search for public MiG-29 system/technical studies; read each report's variant and source basis.

Keep product 9.12, 9.13, 9.13S, 9.13B, 9.13SE, export fits and later modernization packages separate. Do not use a generic “Fulcrum” source as evidence of this exact aircraft.

### GAF T.O. 1F-MIG29-1 values in use (implementation note)

The game package (`game/src/platforms/aircraft/mig29/MiG29Data.ts`) now takes weights, RD-33 static ratings, control-surface travel, the feel-control unit schedule, LEF logic and AoA-limiter thresholds from GAF T.O. 1F-MIG29-1 Section 1. These describe the Luftwaffe MiG-29G (9.12-family) configuration: each value is tagged with that source and "product 9.13 applicability not verified". They remain source-configuration values, not validated 9.13 truth.

## 1. Airframe and independent flight model

The MiG-29 gets a separate aircraft-specific model from the F-16. The shared layer supplies common rigid-body integration, numerical methods, frame transforms and reusable aerodynamic mathematics only. The MiG-29 owns its own aerodynamic geometry, LERX/root-flow model, lifting surface stations, coefficient data, mass properties, twin-engine installation, control response, stability/trim and validated envelope.

Required evidence:
- Exact product 9.13 datum and body-axis conventions, reference area/chord/span, wing/forebody/LERX geometry and engine nacelle positions.
- Left/right wing and tail geometry with panel segmentation, local stations and force application points.
- Aerodynamic coefficients/derivatives across the supported Mach/AoA/sideslip/rate/control/configuration domain; identify source, test article and limits.
- High-AoA and LERX vortex effects, flow separation/breakdown, wing/tail interference, yaw/roll coupling and tail blanking only at a fidelity supported by evidence.
- Twin RD-33 product/series identity, installation transforms, separate thrust/fuel/accessory/damage state and asymmetric thrust moments.
- Product-specific mass, CG, inertia and spine/fuselage fuel distribution; stores and fuel transfer change mass properties.
- Control laws/SAU, trim and actuator behavior; flight-control and aerodynamic model validation must be separate.
- Ground effect, landing configuration, gear/drag and takeoff/landing validation.

The repository currently lacks a verified exact product 9.13 aero coefficient database. Keep those fields unknown or synthetic-test-only. Do not manufacture a flight model by fitting values from the DCS MiG-29.

## 2. Movable-surface inventory — product 9.13

| Surface/device | MiG-29 role | Modeling requirement | Evidence state |
|---|---|---|---|
| Left/right all-moving horizontal stabilators / tailerons | Primary pitch control; differential contribution to roll where supported by control system | Separate pivot axes and left/right states, control mixing, actual actuator motion and asymmetric moments | General MiG-29 documentation; exact product 9.13 details need source confirmation |
| Left/right ailerons | Roll control | Exact span/hinge/neutral geometry, differential/symmetric command logic, local aero and actuator limits | Described in MiG-29 manuals; product-specific values to verify |
| Twin rudders | Yaw control | Independent surfaces and actuators, yaw/sideslip coupling and damage/asymmetry | General installation documented; exact product baseline to confirm |
| Left/right leading-edge flaps (LEF)/slats terminology | Leading-edge high-lift/flow-control devices; public manuals use LEF terminology and some simulator documentation calls them slats | Model exact geometry and slot behavior only if the device is a true slat; distinguish a leading-edge flap from a slot-forming slat in data schema | Device exists in public descriptions; exact product 9.13 naming/kinematics remain provisional |
| Trailing-edge flaps | High-lift devices for takeoff/landing; some simulator descriptions give single-slotted construction | Separate from ailerons; exact segments, angle, schedule, hinge, loads and indication | General manuals; exact product/variant values not fully established |
| Upper/lower fuselage speedbrakes / airbrakes | Drag devices around aft fuselage/drag-chute area | Model both panels individually; they may operate together without identical measured positions; include blow-back, travel/load, interlocks and asymmetric drag/moment | GAF manual describes electrically controlled, hydraulically operated upper/lower speedbrakes; verify exact fit |
| Wing spoilers | No wing spoiler device identified in current product 9.13 source set | Do not create one. Mark `not-fitted` only after exact platform source confirms absence | Not identified; verification outstanding |
| Fixed LERX / forebody extensions | Fixed vortex-generating aerodynamic geometry, not a movable slat or actuator | Model geometry and induced-flow effects separately; no actuator or flap schedule | Geometry established generally; detailed flow data not established |

### Nomenclature warning

Do not assume the words “slat” and “leading-edge flap” are interchangeable. A conventional slat creates a slot between the leading-edge element and the main wing; a leading-edge flap changes leading-edge camber/shape and does not necessarily create that slot. Some translated manuals and simulator material use different labels. Preserve the original wording and diagram, then classify the actual geometry/kinematics only when evidence permits.

### Control schedules to research

The GAF T.O. describes LEF behavior, flap pushbutton controls and upper/lower speedbrake operation. The public DCS manual describes automatic LEF deployment under stated AoA/Mach conditions and flap/LEF positions, but is simulator-specific. Treat every numeric threshold and schedule as provisional until the selected product 9.13 applicability is confirmed.

## 3. Control system, stability augmentation and actuators

Research the actual mechanical linkage and augmentation architecture rather than implementing a generic F-16-style fly-by-wire system.

Capture:
- Primary pilot controls, artificial feel, trim and mechanical linkage.
- Pitch/roll/yaw stability augmentation and automatic flight-control/SAU modes.
- Aileron-rudder interconnect and high-AoA behavior where confirmed.
- Automatic longitudinal stability changes associated with leading-edge device state.
- Taileron, aileron, rudder, flap, LEF and airbrake command paths.
- Hydraulic main/boost circuits, actuator arrangement/chambers, electrical command/servo dependencies and actual position feedback.
- Control authority and failure behavior for one circuit lost, one chamber degraded, actuator jam/leak, linkage damage, electrical supply/servo failure and augmentation loss.

The GAF T.O. source describes stability augmentation and electro-hydraulic actuation. Its precise applicability to product 9.13 must be checked. Do not transplant F-16 FLCS laws, limiter schedules, gain tables or failure behavior.

## 4. Propulsion and aircraft systems

Create two independent RD-33 engine installation records once exact engine series/applicability is verified. Keep the two engines separately simulated and separately coupled to:
- fuel feed and transfer;
- electrical generation/accessories;
- hydraulic pumps/accessories;
- cooling/thermal and bleed/air interfaces where fitted;
- inlet/nozzle geometry and thrust vector;
- damage/fire/leak state;
- mass, CG and inertia changes.

Research the selected product's electrical buses/generation, hydraulic main/boost architecture, pneumatic stored-gas and emergency systems, cooling/ECS, landing gear/brakes, pressurization/oxygen, fire protection, escape and cockpit indications. Current GAF material is a valuable reference, but exact product 9.13 transfer remains a gap to resolve.

## 5. Avionics, sensors and EW

Freeze the selected N019/RLPK-29 baseline, exact software/variant, IFF, optical/IRST equipment, RWR fit/library era, countermeasure dispenser, navigation, communications and display configuration. The existing source register notes that N019M/TWS2/R-77 claims must not be imported into plain product 9.13 without evidence. Treat Beryoza/SPO-15 designation and fit conflicts as disputed until resolved.

For every sensor, capture aperture, installation, field of regard, scan/processing mode, operating limits, power/cooling, alignment, warm-up, BIT, controls/indications, threat library/software and degradation. The common sensor engine must not erase the MiG-29-specific equipment behavior.

## 6. Stores and weapon integration

Build exact pylons/stations and store compatibility from the selected product/production/operator baseline. Record mass, CG/inertia, drag/interference, launch/umbilical/data interfaces, illumination/designation dependencies, release logic, separation impulse, asymmetry and cockpit indication. Do not add R-77 or other later-upgrade capabilities because they appear in a generic MiG-29 family list or a DCS modernization.

## 7. Validation plan

Build separate tests from the F-16 suite:
- clean symmetric trim and sourced low-to-moderate AoA force trends;
- per-panel local airflow and LERX/root-flow model only within its validated envelope;
- independent left/right taileron and aileron commands;
- flap/LEF command schedule, achieved position, indication and asymmetry;
- upper/lower speedbrake operation, unequal panel response, blow-back/interlock and drag/moment;
- independent twin-engine state, spool/thrust asymmetry and engine-out moments;
- control augmentation on/off and verified failure modes;
- hydraulic circuit/chamber loss and resulting actual surface authority;
- fuel transfer/CG movement and store configuration;
- takeoff/landing/ground effect only where the selected data supports the scenario;
- deterministic replay, data provenance validation and browser performance.

Do not copy F-16 test values or tune the MiG-29 until it resembles F-16 handling. The proof is that both aircraft behave differently for defensible, traceable reasons.


## 8. Advanced dynamic flight physics evidence

Before enabling advanced effects, fill the product 9.13 evidence records for:
- **Unsteady aerodynamics:** wing/tail section applicability, static/dynamic coefficient evidence, pitch-rate range, separation/hysteresis and post-stall limits.
- **Compressibility/transonic behavior:** local Mach/pressure/drag data, control-effectiveness changes, transonic buffet and validated Mach/AoA/configuration envelope.
- **LERX/forebody vortices:** exact leading-edge/forebody geometry, vortex path/breakdown and interaction with vertical tails, control surfaces and inlets. Generic twin-tailed-fighter NASA flow surveys are mechanism references only, not MiG-29 values.
- **Aeroelastic/structural response:** structural stations, stiffness/mass/damping, modal evidence, fatigue/load limits and component routing. Keep unknown data explicit; do not infer a flutter boundary from another fighter.
- **Installed twin RD-33 propulsion:** each intake/engine's own position, flow recovery/distortion, response, nozzle/exhaust and asymmetric effects. Do not average both inlets or engines.
- **Ground handling:** nose/main gear geometry, strut/tire/wheel properties, brakes/steering/anti-skid, emergency extension and landing-impact evidence.

Use [Advanced flight physics references](../../reference-library/advanced-flight-physics.md) for research and test methodology. The public sources currently registered do not establish a complete product 9.13 dataset for these advanced domains. Do not turn the absence of data into fabricated precision or a claim of full fidelity.


## 9. Publicly reported product 9.13 facts — evidence and limitations

This section gives Claude a concrete starting point while preserving source quality. The MiG-29 has particularly serious variant and translation issues. A generic MiG-29 fact sheet, export R-73E specification or MiG-29S/9.13S description must not silently become product 9.13 data.

### Airframe and fuel references

| Parameter | Publicly reported value / description | Evidence status | How to use it |
|---|---|---|---|
| Length | 17.3 m reported for MiG-29 family | secondary/government guide-level, exact product applicability unresolved | Scale/context check only; verify datum and product 9.13 geometry |
| Wingspan | 11.4 m reported for MiG-29 family | secondary/government guide-level | Do not use as exact model mesh or wing station data |
| Height | 4.8 m reported for MiG-29 family | secondary/government guide-level | Verify landing gear/attitude datum before use |
| Internal fuel | 4,300 L reported in a U.S. Army Worldwide Equipment Guide table for MiG-29 family | government reference, exact product/production applicability unresolved | Do not apply without confirming the 9.13 spine/tank configuration |
| Product 9.13 spine | Enlarged dorsal spine associated with additional avionics and internal fuel; one secondary source reports +75 L versus earlier 9.12 baseline | secondary-reported | Research lead only; primary product drawing/manual required |
| Optional centerline tank | 1,500 L external tank reported for product 9.13 family | secondary-reported | Candidate configuration only; exact station/clearance/source required |
| External load | Up to 3,200 kg reported for product 9.13 | secondary-reported | Not a flight-model limit or approved loadout until corroborated |

Sources:
- [U.S. Army Worldwide Equipment Guide portal](https://odin.t2com.mil/WEG) — use the exact MiG-29 entry/revision and preserve its product-level limitations.
- [MiG Alley — MiG-29 product/variant overview](https://toad-design.com/migalley/index.php/jet-aircraft/mig29/mig29-variants/) — secondary source; useful to locate product 9.13 distinctions, not an authoritative type certificate/manual.

### Powerplant and installed systems

The working baseline has two RD-33 engines. Exact engine series, production batch, corrected maps, dry/afterburning thrust, fuel-flow, spool transient, bleed/accessory extraction and installation losses are not established by the present product 9.13 source package. Do not fill these with generic RD-33 family numbers.

The working avionics/equipment research baseline remains:
- N019 / RLPK-29 family radar; exact hardware/software fit and processing modes require product 9.13 evidence.
- OEPS-29/KOLS optical/infrared family; exact detector and equipment revision require confirmation.
- Shchel-3UM helmet sight as a research candidate; exact installation/revision must be verified.
- Beryoza/SPO-15 family RWR; the exact equipment designation and production fit remain disputed.
- L-203BE Gardenyia-1 active jammer is associated with the 9.13 spine in secondary material; verify equipment, antenna layout, wiring and date before adopting as a firm installation.

Do not infer sensor detection ranges, scan rates, receiver bands, threat library contents or jamming performance from a broad family label.

### Product 9.13 weapon evidence

The starter product library is linked below. Exact station/launcher and production/operator compatibility remain separate from general weapon association.

| Product | Research status for product 9.13 | Evidence restriction |
|---|---|---|
| [R-27R Alamo-A](../weapons/R-27R.md) | Candidate medium-range SARH weapon | ODIN describes R-27R family/seeker; the DCS manual is simulator evidence for the standard 2-R-27R loadout, not primary 9.13 proof. |
| [R-27T Alamo-B](../weapons/R-27T.md) | Optional candidate IR variant | Do not assume every product 9.13 unit/fit carried it; exact store clearance needed. |
| [R-73A Archer](../weapons/R-73A.md) | Candidate short-range IR weapon | Preserve domestic R-73A; do not use R-73E export or R-73M/R-74 upgrades. DCS standard loadout is simulator-reference only. |
| [GSh-30-1](../weapons/GSh-30-1.md) | Internal 30 mm cannon | NLR identifies MiG-29 family with GSh-301 and 150 rounds; DCS manual gives 1,500 rounds/min but is simulator-reference only. |

The DCS English MiG-29 manual describes a standard simulator loadout of two R-27R plus four R-73, six external guided-weapon stations, and a 30 mm GSh-30-1 with 150 rounds. Store this as a named **simulator-reference scenario loadout**, not as proof that every real product 9.13 aircraft had that clearance. Do not add R-77 to plain product 9.13: the repository's baseline excludes later 9.13S and modernization capabilities unless exact evidence says otherwise.

Simulator reference:
- [DCS MiG-29 Flight Manual](https://www.digitalcombatsimulator.com/en/downloads/documentation/dcs-mig-29_flight_manual_en/). Useful for the DCS loadout and cockpit workflow being simulated; not independent technical proof of the exact product 9.13 aircraft.

### Data gaps Claude must leave open

- Product 9.13-specific three-view geometry, exact stations/hinges, LERX/wing/tail section shapes, datum and equipment mass stations.
- Product 9.13 mass/CG/inertia and fuel distribution, including spine and any optional external tanks.
- RD-33 exact series and engine installation maps for left and right engines independently.
- Full aerodynamic coefficient/derivative tables and measured flight-test envelope; DCS CFD or flight-model results are not independent validation.
- Exact control-system schematic, augmentation law, limiter/trim behavior and hydraulic actuator details.
- N019 radar hardware/software, antenna pattern and waveform/processing data; OEPS/KOLS detector data; exact RWR and jammer fit.
- R-27R/R-27T/R-73A motor, aero, actuator, seeker, fuze and warhead data at the exact product variant/production standard.
- Station-specific pylon/rail interface, release impulse, permissible asymmetric stores and aircraft software/indication behavior.
- Gear/strut/tire/brake/drag-chute details and connected hydraulic/pneumatic failure behavior.

Where primary public data are missing, the correct implementation is a bounded and clearly labeled approximation, not a fabricated "accurate" dataset.
