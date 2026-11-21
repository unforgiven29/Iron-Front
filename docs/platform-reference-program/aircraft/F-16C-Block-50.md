# F-16C Block 50 — platform technical evidence package

**Role:** First full-fidelity fixed-wing aircraft implementation.
**Selected baseline:** F-16C Block 50 with GE F110-GE-129. Freeze operator, OFP, radar, RWR, stores and retrofit date before accepting exact equipment values.
**Status:** Research roadmap and source-linked requirements. This file is not a complete technical order or validated aerodynamic database.

## Source baseline and cautions

Start with the [existing F-16 source register](../../../game/modules/planes/F-16/docs/references/README.md). Add all newly accepted values there using the [source-record template](../../reference-library/source-record-template.md).

Additional public source routes:
- [F-16C/D Blocks 50 and 52+ Flight Manual, T.O. GR1F16CJ1 (15 October 2002; third-party mirror)](https://studylib.net/doc/26036763/block-50) — useful for surface descriptions, FLCS, high-lift devices, speedbrakes and abnormal operation. The mirror is not the issuing authority; establish a legitimate applicable copy and revision before adopting values.
- [F-16A/B flight manual T.O. 1F-16A-1, publicly mirrored PDF](https://www.aahs-online.org/resources/e-library/fm/USAF-F16A_B-Flight-Manual.pdf) — older A/B context only; not the Block 50 data source.
- [USAF F-16 fact sheet](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104505/f-16-fighting-falcon/) — broad family-level context only.
- [NASA TP-1538](https://ntrs.nasa.gov/citations/19800005879) — relaxed-static-stability/high-AoA research context from an F-16-derived fighter configuration; not a Block 50 coefficient set.
- [NASA F-16XL digital flight control flight-test report](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20040040334.pdf) — test methodology and F-16XL research only; not production Block 50 aerodynamic values.
- [Falcon BMS FM developer article index](https://www.falcon-bms.com/blog/category/flight-model) — simulation architecture and F-16 case study only, not independent engineering validation.

Do not silently import Block 40/42, Block 52, F-16A/B, F-16XL, export variants, different engines or modernized avionics into the selected Block 50 fit.

## 1. Airframe and independent flight model

Create the F-16-specific nonlinear aerodynamic model in `game/modules/planes/F-16/flight-model/`. It must have its own geometry, surface layout, mass properties, coefficient/derivative data, control response, trim/stability behavior, configuration effects and validation envelope.

Required evidence:
- Datum and FRD/body/stability/wind axis definitions, reference area/chord/span, planform and geometry stations.
- Wing and fuselage contributions, leading-edge extensions, tail, vertical fin, radome/inlet and external configuration.
- Local aerodynamic reference stations for panels; avoid one aircraft-wide AoA/dynamic-pressure value for every surface.
- Coefficients/derivatives across the supported axes (for example Mach, AoA, sideslip, rates, controls and configuration); explain which variables are omitted.
- Compressibility/transonic behavior, separated flow, high-AoA/post-stall response and dynamic effects only where defensible data/model support exists.
- Mass, CG and inertia for fuel/store combinations.
- Ground effect, gear, stores, pylons and asymmetric carriage.
- Flight-test trim/performance/control validation; held-out conditions separate from tuning.

## 2. Movable-surface inventory — F-16C Block 50

The F-16 uses a specific set of surfaces; do not add generic devices simply because another aircraft has them.

| Surface/device | F-16 role | Modeling requirement | Evidence state |
|---|---|---|---|
| Left/right all-moving horizontal stabilators | Primary pitch control; differential movement also contributes to roll | Separate left/right surfaces, pivot axes, command mixing, actual position, rate/load limits and local aerodynamic moments | Documented in F-16 manuals; exact selected fit/mapping to verify |
| Left/right flaperons / trailing-edge flaps (TEF) | Combined roll-control and trailing-edge high-lift function | Model aileron/flaperon command superimposed with FLCS TEF schedule; retain left/right independent achieved positions | Documented; schedule is baseline/software specific |
| Left/right leading-edge flaps (LEF) | Leading-edge camber/flow optimization scheduled by FLCS | Separate segmented surfaces and FLCS schedule; position, asymmetry detection/lock, hinge loads and actual feedback | Documented in Block 50/52+ manual family; resolve exact baseline |
| Rudder | Primary yaw control | Deflection, rate, yawing moment, sideslip coupling, actuator and damage | Documented; exact fit values to verify |
| Split fuselage-mounted speedbrakes | Drag control; not wing spoilers | Model each panel separately, hinge/load/drag effects, deployment rate, symmetry, interlocks, failure and effect on pitch/yaw | Documented in F-16 manual family |
| Wing spoilers | No separate wing spoiler surface is identified in the selected baseline source set | Do not create a generic F-16 spoiler or roll-spoiler surface. Record `not-fitted` once confirmed against the exact technical baseline | Provisional absence; confirm selected baseline |
| Slats (slot-forming leading-edge elements) | Do not assume fitted as conventional slats; F-16 source terminology is leading-edge flaps | Keep `slat` and `leading-edge flap` as different device types in shared schema | LEF terminology documented; do not relabel them as slats |
| Fixed LERX/forebody shaping | Fixed aerodynamic geometry, not a movable high-lift device | Include in geometry/flow model where data support it; no actuator or flap schedule | Geometry feature; exact coefficient interaction needs evidence |

The F-16C/D blocks 50/52+ flight manual describes LEFs scheduled by Mach, AoA and altitude, and TEFs/flaperons with operation dependent on gear-handle position, ALT FLAPS switch, airspeed and Mach. It also documents LEF asymmetry sensing/locking and the TEFs' dual role as ailerons and trailing-edge flaps. These are system behaviors to model causally, not static deflection values copied into the renderer.

## 3. FLCS and actuator evidence

Build an aircraft-specific FLCS adapter; do not put F-16 control-law branches into generic physics code.

Research and encode:
- Four-channel digital FLCS architecture for the selected baseline; command shaping, gain schedules, limiter behavior and exact software fit.
- Pilot stick/pedals, trim, air-data inputs, AOA/sideslip/attitude/rate feedback and FLCS failure detection.
- Pitch/roll/yaw control mixing, stabilator differential movement, flaperon command versus TEF scheduling, LEF schedule and speedbrake control.
- A/B hydraulic system actuation, integrated servo actuator interfaces, electrical computer/servo-valve loads and feedback.
- Position-command, target, actual surface position and indicated position as separate states.
- Primary/secondary modes, backup/standby gains and degradation only from exact baseline evidence.
- LEF asymmetry, actuator lock/brake, TEF lock, servo failure, hydraulic loss, electrical failure, feedback fault, jam/runaway and structural damage.

The actuator must not teleport a surface to a command angle. Actual motion depends on commanded rate, hydraulic pressure/flow, electrical control, hinge loads, friction, stops, damage and asymmetric mechanisms.

## 4. Aircraft systems integration

Use the existing `game/modules/planes/F-16/systems/` dossier and the common systems owners. Populate an installation graph for:
- F110-GE-129 engine and accessory interfaces;
- fuel tank/feed/transfer and changing mass distribution;
- A/B hydraulic circuits, reservoirs/pumps/accumulators, consumers and emergency paths;
- electrical generation, buses, batteries, FLCS power and load shedding;
- cooling/ECS/avionics cooling and thermal derating;
- landing gear, brakes, anti-skid, nosewheel steering and emergency extension;
- canopy, oxygen/anti-G and ejection/escape interfaces;
- fire/overheat detection and extinguishing where documented.

Exact values must have source page/table and block/configuration applicability. Do not use a generic F-16 or different-block value without flagging it.

## 5. Avionics, sensors and EW

Freeze exact APG-68 variant, OFP/software, ALR-56M baseline, countermeasure dispenser fit, IFF, INS/GPS, radios/datalink, targeting pod and display standard. The existing source register notes that APG-68(V)5, APG-68(V)9 and APG-83 are not interchangeable. Do not grant later upgrades because they appear in a family-level fact sheet or another simulator.

For each subsystem capture aperture/antenna position and pattern where public, receiver/equipment variant, operating modes and controls, electrical and cooling demand, BIT/warm-up, display/alert behavior, failure modes, software and evidence quality. The sensor engine remains shared where physics is genuinely common; the installed equipment and processing baseline remain F-16-specific.

## 6. Stores and weapons integration

Build a station-by-station compatibility map: pylon/launcher type, station position, structural and mass limits, store mass/CG/inertia, aerodynamic drag/interference, electrical/data interfaces, cooling/umbilical needs, release interlocks, separation impulse and asymmetry. Verify exact Block 50/OFP/operator applicability. A weapon appearing in a simulator loadout list is not enough to prove the real aircraft's fit.

## 7. Validation plan

Use the F-16 vertical-slice suite plus shared flight-model acceptance. Required scenarios:
- symmetric clean trim and stability at several sourced conditions;
- fuel/CG movement, asymmetric store loads and store release;
- LEF/TEF schedule through AoA/Mach/altitude/gear configuration;
- independent left/right surface deflections and asymmetry lock;
- stabilator pitch and differential roll mixing;
- speedbrake deployment/retraction, drag/moment and interlocks;
- actuator rate/force degradation from hydraulic/electrical faults;
- control-law mode transition and backup/degraded behavior;
- gear-down landing, ground effect, flare and braking;
- high-AoA entry/recovery only within supported evidence;
- deterministic replay and measured browser cost per panel/surface.

Never tune aero coefficients to disguise wrong FLCS logic, actuator lag or incorrect device scheduling.
