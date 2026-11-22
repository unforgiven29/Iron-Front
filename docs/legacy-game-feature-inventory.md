# Legacy game capability inventory — Viper Sortie / HTML-Flight-Combat

**Source repository:** [unforgiven29/HTML-Flight-Combat](https://github.com/unforgiven29/HTML-Flight-Combat)  
**Source branch inspected:** `main`, updated 18 November 2026  
**Purpose:** Make the full scope of the old game visible to Claude Code before it changes Iron-Front. This is a code-informed inventory, not a claim that every legacy feature was complete, accurate or production-quality.  
**Target project:** Iron-Front.  
**Status:** Inventory and migration authority; runtime parity is not implied.

## 1. Non-negotiable migration rule

Iron-Front is a re-architecture and fidelity upgrade, **not a scope reduction**. Every capability in this inventory remains in the intended product scope unless a later explicit project decision records that it is intentionally deferred or removed. Claude must not silently omit a capability because it is not in the first vertical slice, because the old implementation was awkward, or because the new architecture does not yet have an owner.

The old game must be treated as an important source of feature requirements and gameplay behavior. It must **not** be treated as an authoritative engineering database. Transfer:

- The player-facing capability and interaction.
- The meaningful system behavior, state transitions, modes, failure cases and consequences.
- The ways domains interact (for example radar emissions → RWR; store release → aircraft mass/drag; road/bridge loss → supply; soldier wounds → movement/evacuation).
- The user-interface affordances and scenario workflows.
- The old game's regression scenarios, where their intended behavior remains valid.

Do not transfer blindly:

- The old global mutable state, global variables, 1.5 MB `game.js` monolith, script-load ordering or monkey-patch/wrapper dependency chains.
- Old balance multipliers, estimated performance values or incomplete data tables as if they were real platform specifications.
- Old sensor registry fields that are only stored/defaulted and never affect runtime behavior.
- Visual-only features that do not have the corresponding authoritative simulation state.
- Known bugs, shortcuts, hidden truth access, random outcomes driven by render timing or incompatible persistence formats.

The goal is **feature and behavior parity first, followed by a much higher and explicitly validated simulation fidelity**. A capability may be staged, but it must retain an inventory ID and an owner so it cannot disappear from the roadmap.

## 2. How to interpret this inventory

Each group uses the following distinctions:

- **Legacy code path:** actual source files or documentation in the old repository where the feature is implemented or described.
- **Legacy maturity:** `implemented-gameplay`, `partial`, `catalogue-only`, `visual-only`, `specification-only` or `unknown`. These are migration observations, not a formal external QA grade.
- **Old-data quality:** `published/traceable`, `mixed`, `estimated/gameplay-tuned` or `unknown`.
- **Iron-Front owner:** canonical target owner. The target owner may be a specification only; read `docs/claude/PROJECT_STATE.md` before assuming there is runtime code.
- **Parity requirement:** what Iron-Front must eventually be able to do, not necessarily what it should implement first.

The old repository itself gives important evidence-quality warnings:

1. `docs/CALIBRATION.md` says some performance and aeroelastic/transonic adjustments are engineering estimates, not flight-test values, and lists important uncalibrated flight envelopes.
2. `docs/radar_waveform_data.md` distinguishes public/general information from estimated PRF, pulse width, duty cycle, sidelobe and processing parameters.
3. `docs/sensor_coverage.md` reports 2,045 registry fields, of which 1,121 were live-written, 139 were known to change simulation behavior, 91 were two-way/read, 1,187 were wired in some way and 858 were stored-only. Being present in that registry does not prove a working subsystem.
4. `js/war/military/armor.js` explicitly labels protection and penetration as rounded gameplay approximations, not real vehicle protection data.
5. `js/war/core/worldwar.js`, `js/war/military/forces.js`, `js/war/society/economy.js` and `js/war/world/infra.js` explicitly use estimated or abstract national force, inventory and infrastructure values.
6. `docs/campaign/TRACEABILITY.md` covers 719 requirement blocks, but most progress states are partial and the percentages in `docs/campaign/DEPTH.md` are the legacy author's coverage judgements, not independent validation.

Claude must preserve those distinctions in the migrated data.

---

## 3. Flight simulation, aircraft catalogue and cockpit systems

### LEG-AIR-01 — Multi-era aircraft roster and platform variants

**Legacy paths:** `js/planes/registry.js`, `js/planes/f16.js`, `js/planes/mig29.js`, `js/hangar/coldwar-jets.js`, `js/hangar/modern-jets.js`, `js/hangar/more-jets.js`, `js/hangar/jet-models.js`, `js/hangar/stealth.js`.  
**Legacy maturity:** `implemented-gameplay` roster/data and model-building, with varying maturity per aircraft. The README advertises 240+ aircraft and helicopters; treat that as the old project's catalogue claim, not 240 independently validated high-fidelity aircraft.  
**Old-data quality:** `mixed`; individual files contain source annotations and many explicit estimates. Some modern/cold-war aircraft are cloned from a nearby base aircraft and inherit its cockpit/model until separately upgraded.  
**Iron-Front owner:** `game/modules/planes/`, `game/modules/rotorcraft/`, platform-reference program and asset pipeline.  
**Parity requirement:** Preserve selectable aircraft, country/era/role rosters, variant identity, performance data, aircraft-specific loadouts, station layouts, engine fit, radar/sensor fit, cockpit mapping, model and audio references. Each named aircraft/variant must become a separate exact package/configuration where equipment or behavior differs. Never flatten a family into one generic aircraft or inherit a different variant's data silently.

**Important legacy roster examples:** F-16A/ F-16C Block 50; F-15 family; F/A-18 family; F-14A/B/D; F-4 variants; MiG-29 / MiG-29S / MiG-29SMT; Su-27 family; MiG-21/23/25/27/31; A-4E; A-7D; AV-8B; Alpha Jet; Super Étendard; F-100A; F-104S/G; F-106A; F-111F; F-20; F-5A/E; F-8E; J 35F; AJS 37; AMX; Lightning F.6; Mirage III/F1/2000/2000-5/2000D/5; Jaguar; Tornado GR.4/F.3/ECR; Su-25/25T/25SM3; Su-24M; Su-22M4; MiG-15/17/19/21/23/27; Yak-38/141; J-6/7/8F/11/11B/15T/16/20/35; JH-7/JH-7A; F-22; F-35A; F-15EX; Rafale; Typhoon/EF-2000; Gripen; KF-21; J-10C; JF-17; Su-30/34/35/57; and more. This is a set of examples from the source catalogue, not a complete locked roster or a statement that all aircraft have separate accurate cockpits.

### LEG-AIR-02 — Aircraft-specific flight models and aerodynamics

**Legacy paths:** `js/core/game.js`, `js/flight/`, aircraft family files, `docs/CALIBRATION.md`.  
**Legacy maturity:** `implemented-gameplay` with aircraft-specific coefficient/configuration tables and calibration, but not consistent engineering fidelity across the roster.  
**Old-data quality:** `mixed`; several figures are approximate, copied, inferred or tuned. The calibration log explicitly says several effects are author estimates and that sustained/instantaneous turn rate, roll, climb, ceiling and acceleration were still uncalibrated for a number of aircraft.  
**Iron-Front owner:** `physics/rigidbody/`, `physics/aerodynamics/`, `physics/flight-model/`, `physics/environment/`, exact aircraft package.  
**Parity requirement:** retain aircraft-specific lift/drag/moment response, dynamic pressure and local airflow, Mach/compressibility/transonic response, stall/post-stall behavior, sideslip, stability/trim, control-surface effects, ground effect, store drag, structural/G limits and damage effects. Preserve special configurations and aircraft-dependent model structures. Build the model from geometry, mass/inertia, aerodynamic evidence and validated control laws; do not copy legacy `CL`, `CD`, `gLim`, `roll` or RCS fields as authoritative data.

### LEG-AIR-03 — Propulsion, engine transients and special flight modes

**Legacy paths:** `js/core/game.js`, `js/flight/`, `js/rotorcraft/heli.js`, `js/rotorcraft/helisys.js`.  
**Legacy maturity:** `implemented-gameplay` for simplified jet engine response, fuel/thrust behavior, compressor-stall events, structural effects and rotorcraft flight; fidelity differs by platform.  
**Old-data quality:** `mixed`; engine ratings may be sourced, but many response, stall, limits and damage constants are approximations.  
**Iron-Front owner:** `physics/propulsion/`, `physics/flight-model/propulsion-integration/`, `physics/rotorcraft/`, exact platform engine installation.  
**Parity requirement:** startup/shutdown, idle/military/afterburner or power modes, spool lag, fuel flow, altitude/temperature effects, engine damage, flameout/relight where fitted, compressor stall/surge where supported, asymmetric twin-engine thrust, installed inlet/nozzle effects, rotor RPM/governor/power and V/STOL or vectored-thrust modes. Engine family and installation must remain distinct. Preserve special ramjet/rocket-powered vehicle behavior where applicable.

### LEG-AIR-04 — Flight controls, structure and aircraft failures

**Legacy paths:** `js/core/game.js`, `js/flight/`, aircraft-specific control hooks, `js/rotorcraft/helisys.js`.  
**Legacy maturity:** `implemented-gameplay` but many effects are aggregate or simplified.  
**Old-data quality:** `mixed/estimated`.  
**Iron-Front owner:** `physics/flight-model/`, `physics/flight-model/structural-response/`, `physics/ground-handling/`, platform control/actuator installation, `game/systems/damage/`.  
**Parity requirement:** control-surface command/actual state, rates and authority, trim/stability augmentation, asymmetric controls, battle damage, over-G/structural response, compressor failures, hydraulic/electrical-dependent actuation, engine/system failure, rotor/transmission/tail-rotor failures, gear and braking failures. An effect must be connected to the component and resource that cause it; avoid generic probability flags.

### LEG-AIR-05 — Dedicated 3D cockpits, HUD, MFD, scopes and clickable control

**Legacy paths:** `js/cockpits/`, `js/planes/f16.js`, `js/planes/mig29.js`, `js/aircraft/`, `js/core/game.js`, `js/war/ui/cockpit.js`.  
**Legacy maturity:** `implemented-gameplay` for several aircraft cockpit scenes, HUD/MFD pages, radar scopes and input interactions; a subset still inherits a generic family cockpit or simplified display behavior.  
**Old-data quality:** `mixed`; reference photos/manuals exist for selected cockpit rebuilds, but other cockpits are approximated.  
**Iron-Front owner:** exact aircraft `cockpit/` modules, `game/graphics-engine/`, `docs/assets-and-pipeline/`, aircraft subsystem owners.  
**Parity requirement:** preserve aircraft-specific cockpit layouts, instrument locations, clickable switches, OSBs, ICP/DED, throttle/stick/pedals, radar cursor and mode controls, HUD symbology, warnings, MFD pages, weapon pages, cockpit lighting, camera views and input mapping. Controls issue commands to real subsystem state; indicators reflect snapshots. Never implement cockpit interaction as direct mutation of physics internals.

### LEG-AIR-06 — Realistic startup, maintenance, pilot and flightline experience

**Legacy paths:** `js/war/military/forces.js`, `js/war/ui/cockpit.js`, `js/campaign/world.js`, `js/war/military/service.js`, `js/war/military/csar.js`, `js/core/game.js`.  
**Legacy maturity:** `implemented-gameplay` in campaign/crew ledgers and player procedures, but system startup is not equally deep across aircraft.  
**Old-data quality:** `mixed`; maintenance and crew timelines are mostly gameplay-level rules.  
**Iron-Front owner:** `game/modules/planes/<platform>/systems/`, `game/systems/crew/`, campaign personnel/logistics, persistence.  
**Parity requirement:** ready aircraft, tail identities, crew assignment, pilot condition and qualification, startup checklists, ground power, engine start, taxi, takeoff, landing, rearming/refuel/reconfigure, maintenance and damage repair, crew rest, player pilot injury/loss/return and flight records.

---

## 4. Sensors, avionics and electronic warfare

### LEG-SEN-01 — Radar architectures and operating modes

**Legacy paths:** `js/sensors/sensorreg.js` (generated from `docs/sensor_suite_v3.txt`), `js/sensors/sensorsim.js`, `js/sensors/sensorsig.js`, `js/sensors/sensorphys1.js`, `js/aircraft/`, `docs/radar_waveform_data.md`.  
**Legacy maturity:** `implemented-gameplay` for several radar architectures and radar processing paths; some registered parameters are not wired or consumed.  
**Old-data quality:** `mixed`. Radar operating modes may be based on manuals/simulators; many waveform and processing values are estimated.  
**Iron-Front owner:** `sensors/Radar/`, `physics/radar/`, exact aircraft radar installation and cockpit pages.  
**Parity requirement:** preserve distinct mechanically scanned/pulse, pulse-Doppler, PESA and AESA architecture; actual aperture/element pattern, scan geometry, PRF/waveform selection, pulse duration, duty/thermal limits, range/velocity ambiguity, Doppler filtering, range sidelobes, clutter cancellation, CFAR/detection, track-file behavior, STT/TWS/RWS/ACM modes, radar altimeter or terrain mapping where fitted, radar cursor controls and scope presentation. Emissions must be visible to RF environment/RWR/ESM and affected by terrain, weather, aspect and equipment state. Do not use one generic radar max-range number.

### LEG-SEN-02 — Signal processing, antenna physics and radar environment

**Legacy paths:** `js/sensors/sensorsim.js`, `js/sensors/sensorsig.js`, `js/sensors/sensorphys1.js`, `js/sensors/sensorfuse.js`, `docs/radar_waveform_data.md`.  
**Legacy maturity:** `implemented-gameplay` with advanced signal-processing prototypes and radar scene interaction.  
**Old-data quality:** `mixed/estimated` for several aperture, clutter, PRF, noise, sidelobe and calibration values.  
**Iron-Front owner:** `physics/radar/`, `sensors/Radar/`, `physics/environment/`, `game/world/`.  
**Parity requirement:** preserve I/Q sampling/CPI, FFT processing, pulse compression where selected, windowing, PRF stagger/unfolding, blind-speed/ambiguous-range behavior, clutter patches, ground/sea/weather clutter, target RCS fluctuations and aspect, antenna main beam/sidelobes/nulls/backlobe, scan loss, terrain horizon/masking, multipath/refraction, propagation attenuation and radar display noise. Keep algorithm stages independently testable. A visible radar return must be caused by the receive/detection chain, not by directly drawing hidden aircraft positions.

### LEG-SEN-03 — IRST, EO/TV, laser range/designation and thermal imagery

**Legacy paths:** `js/sensors/sensorir.js`, `js/sensors/sensorsuite.js`, `js/aircraft/shkval.js`, `js/aircraft/`, weapon pod/sight code.  
**Legacy maturity:** `implemented-gameplay` for selected IRST track modes and electro-optical/TV/laser sights; some sensors are simplified or use gameplay range estimates.  
**Old-data quality:** `mixed`; detector response, spectral bands, ranges and some sensor properties are estimated.  
**Iron-Front owner:** `sensors/IRST/`, `sensors/EO-FLIR/`, `physics/optics/`, `physics/thermal/`, exact platform installation.  
**Parity requirement:** preserve passive IR detection, search/scan versus track, TWS/track files, detector field of view, thermal contrast, atmospheric transmission, cloud/fog/rain/smoke obscuration, sun/background effects, image/video display, target designation, laser ranging/designation, Shkval/Kaira/targeting pod behaviors and alignment/stabilization failures. A visual lock box must be driven by detector and processing output.

### LEG-SEN-04 — RWR, ESM, MAWS and emitter/threat libraries

**Legacy paths:** `js/rwr/rwrlogic.js`, `js/rwr/rwrreg.js` (generated from `docs/rwr_registry.txt`), `js/sensors/sensorsuite.js`, aircraft-specific RWR code (including SPO-15 and western warners).  
**Legacy maturity:** `implemented-gameplay` for warning/registry behavior and selected RWR display/audio systems.  
**Old-data quality:** `mixed`; emitter characteristics, detection thresholds and some threat-library data are approximated.  
**Iron-Front owner:** `sensors/RWR/`, `sensors/ESM/`, `sensors/MAWS/`, exact platform fit/cockpit pages.  
**Parity requirement:** preserve aircraft-specific receiver antenna coverage, frequency/PRI/PDW observations, deinterleaving, emitter classification, association, threat priorities, launch/lock/spike warnings, threat audio, symbol placement, failure and damage. MAWS/UV/IR plume warning must be separate sensor architectures. Each RWR sees received emissions through propagation, not the radar's private track list.

### LEG-SEN-05 — Jamming, deception, counter-countermeasures and DIRCM

**Legacy paths:** `js/sensors/jamming.js`, `js/sensors/sensorsuite.js`, `js/weapons/aim9x2.js`, `js/sensors/sensorir.js`, `js/sensors/sensorfuse.js`.  
**Legacy maturity:** `implemented-gameplay` for noise/escort/standoff jamming, aspect/band/line-of-sight effects, missile countermeasure interactions and selected DIRCM/MAWS.  
**Old-data quality:** `mixed/estimated`; jammer band limits, radiated power, sidelobe and break-lock probabilities often use balance estimates.  
**Iron-Front owner:** `sensors/ECM`, `sensors/RWR`, `sensors/ESM`, `sensors/weapon-seeker/countermeasure-discrimination/`, `physics/radar/`, `physics/optics/`.  
**Parity requirement:** preserve noise and deception jamming, escort/standoff geometry, burn-through, antenna sidelobes, spot/barrage, band coverage, emission control/EMCON, home-on-jam where the weapon supports it, chaff/flare release timing and dispersion, towed/active decoys where fitted, seeker discrimination, MAWS alerts, DIRCM turret tracking/energy/dwell and failure. No scalar countermeasure susceptibility may replace dynamic observations and track association.

### LEG-SEN-06 — Sensor fusion, IFF, NCTR, datalink and AWACS/GCI

**Legacy paths:** `js/sensors/sensorfuse.js`, `js/sensors/sensorsuite.js`, `js/sensors/sensorreg.js`, `js/core/iff.js`, `js/war/military/airops.js`, `js/war/military/ops.js`.  
**Legacy maturity:** `implemented-gameplay` in track fusion, IFF/NCTR, AWACS and GCI flows, but fidelity varies and some information is abstract.  
**Old-data quality:** `mixed/estimated`.  
**Iron-Front owner:** sensors/fusion, `sensors/IFF/`, `sensors/NCTR/`, communications/datalink systems, `game/modules/ai/`.  
**Parity requirement:** preserve radar/IRST cross-cueing, contact identity classes, friend/foe/unknown, NCTR/visual identification, shared track reports, AWACS updates and GCI direction. Include latency, stale data, uncertainty, packet loss, jamming and emissions-control effects. AI and cockpit must consume reports available to them rather than hidden world state.

---

## 5. Weapons, stores and ballistics

### LEG-WPN-01 — Air-to-air missiles and guidance diversity

**Legacy paths:** `js/weapons/weapons-data.js`, `js/weapons/aim9x2.js`, missile class in `js/core/game.js`, `js/hangar/modern-jets.js`, `js/hangar/coldwar-jets.js`.  
**Legacy maturity:** `implemented-gameplay` for a broad missile catalogue, launch/flight/seeker/impact logic and a data panel. Fidelity is highly uneven.  
**Old-data quality:** `mixed`; the old weapon data file itself says some values are nominal engineering defaults.  
**Iron-Front owner:** `game/modules/weapons/missiles/air-to-air/`, weapon component profiles, `physics/ballistics/`, `physics/propulsion/`, `physics/guidance/`, `sensors/weapon-seeker/`.  
**Parity requirement:** preserve the breadth of short/medium/long-range IR, SARH, ARH, command-guided, beam-riding and passive-RF weapons; model rail/eject launch, release delay, safe separation, motor ignition/burn stages, mass depletion, aerodynamic/control response, navigation, seeker search/acquisition/track, guidance law, data-link, illumination, fuze, warhead, miss/dud and damage. Examples in legacy data include AIM-9 family, AIM-7, AIM-54, AIM-120, R-3/R-13/R-60/R-73/R-27/R-77/R-24/R-40/R-37 and many later missile variants. Each variant must keep its exact sensor and motor architecture.

### LEG-WPN-02 — Air-to-ground, anti-radiation, anti-ship and stand-off weapons

**Legacy paths:** `js/weapons/agspec.js`, `js/weapons/antiship.js`, `js/weapons/weapons-data.js`, aircraft store tables, `js/rotorcraft/heli.js`.  
**Legacy maturity:** `implemented-gameplay` for multiple guided missile families, launch/flight/impact, and anti-ship target selection, but product profiles use nominal defaults for missing values.  
**Old-data quality:** `mixed`.  
**Iron-Front owner:** `game/modules/weapons/missiles/air-to-ground/`, `anti-radiation/`, `anti-ship/`, `bombs/`, `physics/guidance/`, `physics/ballistics/`, sensors/weapon-seeker.  
**Parity requirement:** preserve TV/CCD/IIR/laser/passive-RF/ARH/INS/GNSS/terrain-referenced and command-link variants; anti-radiation emitter homing; glide/boosted glide; cruise/ramjet/turbojet/solid rocket; sea-skimming and terminal anti-ship homing; target designation, launch envelopes and cockpit indications. Examples in the code include AGM-65 variants, Kh-25/29/31/35/59 variants, AGM-88, SCALP, Taurus, Exocet, Sea Eagle, ASM-2, P-800/BrahMos and others. Do not give a family-level profile to each variant without checking the seeker/motor/warhead differences.

### LEG-WPN-03 — Guns, ammunition and projectile ballistics

**Legacy paths:** `js/weapons/weapons-data.js`, `js/core/game.js`, aircraft files and `js/war/military/armor.js`.  
**Legacy maturity:** `implemented-gameplay` for gun cadence, projectile shooting and weapon integration; some gun/ammo parameters are abstract.  
**Old-data quality:** `mixed`.  
**Iron-Front owner:** `game/modules/weapons/guns/`, `physics/ballistics/`, `physics/armour/`, `game/systems/damage/`.  
**Parity requirement:** preserve gun family, calibre, barrel count, projectile/muzzle data, feed/belt, ammunition count, cadence, spin-up, recoil/moments, dispersion, heat/wear/jam and platform mount geometry. Guns include internal aircraft cannon, helicopter cannon, tank guns, IFV autocannon, machine guns, infantry rifles and sidearms. Do not reuse weapon damage points as physical projectile/armour data.

### LEG-WPN-04 — Bombs, rockets, pods and external stores

**Legacy paths:** `js/weapons/weapons-data.js`, `js/weapons/agspec.js`, aircraft loadout/STORE/STN tables, `js/hangar/`.  
**Legacy maturity:** `implemented-gameplay` catalogue and release/impact behavior.  
**Old-data quality:** `mixed`, with some loadout permissions chosen for gameplay rather than documented exact station clearance.  
**Iron-Front owner:** `game/modules/weapons/bombs/`, `rockets/`, `game/modules/planes/<platform>/weapons/`, launcher/store components.  
**Parity requirement:** preserve free-fall bombs, guided bombs, cluster/submunition families, rockets, pods, ECM/targeting/IRST/HTS pods, fuel tanks and store jettison. Station compatibility, rack/launcher, mass/CG/inertia/drag, electrical/data/cooling interfaces, safe separation and release authorization belong to aircraft installation, not weapon name logic.

### LEG-WPN-05 — Countermeasures and missile camera/weapon displays

**Legacy paths:** `js/core/game.js`, `js/weapons/`, `js/sensors/sensorir.js`, `js/sensors/jamming.js`, `js/aircraft/`.  
**Legacy maturity:** `implemented-gameplay` for chaff/flare stores, seeker cameras, missile view/camera handoff and selected decoy responses.  
**Old-data quality:** `mixed/estimated`.  
**Iron-Front owner:** `game/modules/weapons/countermeasures/`, weapon seeker, aircraft stores/cockpit, graphics presentation.  
**Parity requirement:** preserve countermeasure program/manual dispense, finite inventories, dispenser timing, missile camera modes, seeker view, lock/track cues, decoy physical movement/signature, and dynamic seeker response. Presentation cannot directly influence seeker truth.

---

## 6. Rotorcraft and helicopter operations

### LEG-ROT-01 — Helicopter flight model and systems

**Legacy paths:** `js/rotorcraft/heli.js`, `js/rotorcraft/helisys.js`, `js/rotorcraft/`, `js/cockpits/`.  
**Legacy maturity:** `implemented-gameplay` for the Ka-50 rotorcraft prototype and AH-64A systems/rotorcraft-specific integrations; roster includes additional helicopter types but not all have equally deep flight models.  
**Old-data quality:** `mixed/estimated`; the Ka-50 file states it uses gameplay estimates based on a DCS manual and simplified rotor/engine data.  
**Iron-Front owner:** `physics/rotorcraft/`, `game/modules/rotorcraft/`, exact airframe/engine/drive train/rotor-system package.  
**Parity requirement:** preserve rotor thrust and induced inflow, blade-element behavior, blade stall, autorotation/rotor RPM, governor/engine coupling, ground effect, vortex-ring/windmill states, retreating-blade limitations, control/cyclic/collective/pedals, coaxial vs tail-rotor distinction, transmission/oil, engine/fire, TADS/Shkval, damage and single-engine behavior. Include Apache and Ka-50 weapon/sight operations, including Vikhr where fitted.

---

## 7. Ground combat, armor, artillery, air defence and infantry

### LEG-GND-01 — Vehicle catalogue and combat platforms

**Legacy paths:** `js/war/military/armor.js`, `js/war/military/gfight.js`, `js/war/military/forces.js`, `js/war/ground/`, `js/war/military/orbat.js`.  
**Legacy maturity:** `implemented-gameplay` for named vehicle catalogues, ground formations and live combat; physical fidelity is uneven.  
**Old-data quality:** `estimated/gameplay-tuned` for many protection, penetration, range, hit probability and force strength values.  
**Iron-Front owner:** `game/modules/ground-units/`, `physics/ground-mobility/`, `physics/armour/`, `physics/ballistics/`, `game/systems/damage/`.  
**Parity requirement:** preserve MBT, IFV, APC, SPG, MLRS, scout/recon, engineering, logistics and support vehicle families. Named examples include Abrams, Leopard 2, Challenger, Leclerc, K2, Merkava, T-72B3, T-80BVM, T-90M, T-14, BMPT, BMP-2/3, Bradley, CV90, Puma, Warrior, BTR, Stryker, Boxer, Rosomak and more. Each platform must have geometry, mobility, crew, turret/weapons, sensors, armor zones, internal components, ammunition arrangement, engine/transmission, fuel and damage effects.

### LEG-GND-02 — Layered armor, penetration, spall, ERA, APS and component kills

**Legacy paths:** `js/war/military/armor.js`, `js/war/military/gfight.js`, `js/war/ground/`.  
**Legacy maturity:** `implemented-gameplay` hit-by-hit resolution and 3D hit overview, with class-level protection approximations.  
**Old-data quality:** explicitly `estimated/gameplay-tuned` for most RHAe numbers and damage outcome probabilities.  
**Iron-Front owner:** `physics/armour/`, `physics/ballistics/`, `physics/collision/`, `game/systems/damage/`, vehicle component maps.  
**Parity requirement:** preserve hit location/aspect, plate slope/thickness, kinetic vs chemical energy, spaced/composite armour, ERA (single-use and tandem interaction), spall liners, crew positions, ammunition carousel/bustle/blow-off panel differences, fire, mobility kill, firepower kill, catastrophic damage and active protection systems (Trophy, Arena-M, Afganit, KAPS). Actual protection data must be platform/variant/ammunition-specific; do not carry the old rounded RHA class values as real specifications.

### LEG-GND-03 — Artillery, indirect fire and counter-battery context

**Legacy paths:** `js/war/military/gfight.js`, `js/war/military/forces.js`, `js/war/military/ops.js`, `js/war/ground/`.  
**Legacy maturity:** `implemented-gameplay` abstract company-level indirect-fire behavior, stores, range and battle effects.  
**Old-data quality:** `estimated/gameplay-tuned`.  
**Iron-Front owner:** `game/modules/ground-units/artillery/`, `physics/ballistics/`, `game/modules/ai/`, logistics.  
**Parity requirement:** preserve artillery units, ammunition/stocks, fire missions, observers/spotters, time of flight, dispersion, impact pattern, suppressive/structural effects, movement/redeployment and counter-battery information. Observed target position must be uncertain and stale; indirect fire cannot use hidden target truth.

### LEG-GND-04 — Ground-based air defence and SAM networks

**Legacy paths:** `js/war/military/forces.js`, `js/war/military/ops.js`, `js/war/military/strategic.js`, `js/core/game.js`, `js/sensors/`, `js/rwr/`.  
**Legacy maturity:** `partial/implemented-gameplay` strategic defence strength, air-defence sites and selected missile interceptions; separate component realism varies.  
**Old-data quality:** `mixed/estimated`.  
**Iron-Front owner:** `game/modules/ground-units/air-defence/`, `sensors/Radar/`, `sensors/RWR/`, weapons/SAM, `game/modules/ai/`.  
**Parity requirement:** preserve EWR/GCI, radar and EO tracking, command posts, launchers, finite missiles, radar emissions, tracking/illumination, engagement control, reload, mobility, radar shutdown, suppression/SEAD, decoys, IADS connectivity, fire-control and failure states. Radar, command node and launcher are distinct state owners that communicate through reports and orders.

### LEG-GND-05 — Playable first-person infantry and weapon kits

**Legacy paths:** `js/war/ground/infantry.js`, `js/war/ground/`, `js/war/ui/`.  
**Legacy maturity:** `implemented-gameplay` first-person combat, weapon models, role/loadout selection, movement, sights, reload, squads and insertion.  
**Old-data quality:** weapon firing/recoil/damage numbers are explicitly abstract; named guns are a catalogue rather than measured ballistics.  
**Iron-Front owner:** `game/modules/infantry/combat/`, `equipment/`, `behaviour/`, `game/graphics-engine/`, shared ballistics and optics.  
**Parity requirement:** preserve assault, sniper, marksman, AT, air-defence, MG, medic, engineer, CQB, breacher roles; country-specific kit selection; rifles, SMGs, shotguns, LMG, DMR, sniper, sidearms, grenade launchers, RPGs, ATGM and MANPADS; optics/reticles/iron sights/red-dot/holo/magnification, suppressor/compensator/flash hider, grip/bipod, grenade launcher, lasers/lights, reload/ammunition inventory, recoil/dispersion and handling. Use real weapon/ammunition data when available, not old `dmg`/spread values.

### LEG-GND-06 — Wounds, medics, casualty evacuation and player fate

**Legacy paths:** `js/war/ground/infantry.js`, `js/war/military/csar.js`, `js/war/society/cemetery.js`, `js/war/military/service.js`.  
**Legacy maturity:** `implemented-gameplay` body-region wounds, bleeding, treatment, medics, crawling/limping, medevac and persistent casualty/personnel consequences.  
**Old-data quality:** gameplay abstraction; don't claim medical accuracy.  
**Iron-Front owner:** `game/modules/infantry/medical-support/`, `game/modules/campaign/personnel/`, `game/systems/crew/`, logistics.  
**Parity requirement:** preserve per-region injuries, bleeding state, treatment items and action, medic AI, casualty stabilisation, evacuation request, medevac by ground/rotorcraft, downed pilot/CSAR, rescue/evading/missing/captured/POW/exchange, player pilot restrictions and permanent personnel history. Keep medical simulation non-clinical and within evidence scope.

### LEG-GND-07 — Squad AI, formations, trenches, buildings and battle objectives

**Legacy paths:** `js/war/ground/infantry.js`, `js/war/military/gfight.js`, `js/war/military/ops.js`, `js/war/world/cities.js`.  
**Legacy maturity:** `implemented-gameplay` for squad/battle behaviors, trench assaults, reinforcements, command posts, engineers, attacks/withdrawal and interactive objectives.  
**Old-data quality:** mostly gameplay-level.  
**Iron-Front owner:** `game/modules/infantry/behaviour/`, `game/modules/ai/`, `game/world/structures/`, campaign front/command services.  
**Parity requirement:** preserve squad membership/persistence/morale/trust, bounding and suppression, flanking/repositioning, wounded recovery, commands/offensive/hold/fallback, reinforcement, engineer fortification, trench lines, sandbags, bunkers/dugouts/command posts, capture/defend objectives and front movement. Enterable structures need floor/room navigation, doors/windows, line of sight, structural support, partial collapse, rubble and occupant hazards.

---

## 8. Uncrewed aircraft, drones, civilian aircraft and aviation

### LEG-UAS-01 — FPV, one-way attack drones, armed UAS and reconnaissance

**Legacy paths:** `js/war/ground/infantry.js`, `js/war/military/forces.js`, `js/core/game.js`, `js/weapons/`.  
**Legacy maturity:** `implemented-gameplay` for FPV control/attack, Shahed/Geran-type one-way attack drones, armed loitering UAS and air-defence engagement.  
**Old-data quality:** mixed; many UAS are game-level behavior classes.  
**Iron-Front owner:** `game/modules/uncrewed-systems/`, sensors, communications, weapons, logistics.  
**Parity requirement:** preserve operator handoff, view feed, control/video link loss and jamming, navigation/autonomy, endurance, payload, seeker or terminal function, lost-link policy, one-way attack routes, reconnaissance and air-defence warning/engagement. Distinguish FPV operator-controlled systems from autonomous loitering and one-way attack systems.

### LEG-UAS-02 — Civil airliners and airspace

**Legacy paths:** `js/world/traffic.js`, `js/war/world/infra.js`, `js/war/society/media.js`, `js/war/military/targets.js`.  
**Legacy maturity:** `implemented-gameplay` civilian route traffic, safe-route behavior, non-target treatment, airspace closure and consequences from civilian-aircraft attacks.  
**Old-data quality:** airline/traffic model is simplified.  
**Iron-Front owner:** `game/modules/civil-aviation/`, `game/world/`, campaign/society/justice.  
**Parity requirement:** preserve civil traffic routes, airliners, airline/airport operating state, closed/restricted airspace, rerouting, emergency/humanitarian flight, IFF/identification and civilian-harm accountability. Civil entities cannot become ordinary hostile targets merely because they share the aircraft base class.

---

## 9. Naval warfare, carriers, submarines and maritime logistics

### LEG-NAV-01 — Surface combatants, submarines, sea control and anti-ship warfare

**Legacy paths:** `js/war/military/naval.js`, `js/war/military/sea2.js`, `js/weapons/antiship.js`, `js/war/military/strategic.js`.  
**Legacy maturity:** `implemented-gameplay` for strategic fleets/sea-control/blockade, selected sortie-level ships/submarines and anti-ship missile encounters; not a complete ship systems simulator.  
**Old-data quality:** aggregate fleet counts and many loss/sea-control rules are approximate.  
**Iron-Front owner:** `game/modules/naval-units/`, maritime operations, weapon/torpedo/anti-ship packages, logistics, sensors.  
**Parity requirement:** preserve surface ship, frigate/destroyer, carrier, amphibious ship, diesel and nuclear submarine, patrol/contact, sea control, blockade, convoy escort, ASW/ship detection, ship damage/repair/fire control, torpedoes, guns, SAMs and anti-ship missiles. Separate strategic sea-control abstraction from local physical ship combat and make their connection explicit.

### LEG-NAV-02 — Carrier operations and naval aviation

**Legacy paths:** `js/campaign/`, `js/core/game.js`, `js/war/military/naval.js`, `js/war/military/sea2.js`.  
**Legacy maturity:** `implemented-gameplay` carrier flightline, launch and arrested recovery for selected carrier-capable aircraft; deck cycle and carrier/air wing in later systems.  
**Old-data quality:** simplified.  
**Iron-Front owner:** `game/modules/naval-units/carrier-operations/`, exact aircraft carrier-capable gear/stores package, `physics/ground-handling/`.  
**Parity requirement:** preserve carrier location/course/speed, deck state, launch/recovery cycle, catapult, arresting gear, aircraft handling, deck crew/operations, aircraft assignment, finite deck capacity, damage and weather/sea-state constraints.

### LEG-NAV-03 — Merchant shipping, convoys and port/blockade effects

**Legacy paths:** `js/war/military/naval.js`, `js/war/military/sea2.js`, `js/war/world/infra.js`, `js/war/society/economy.js`.  
**Legacy maturity:** `implemented-gameplay` strategic trade, port capacity, convoys, blockade, ship loss and economic effects at an abstract level.  
**Old-data quality:** estimated aggregate.  
**Iron-Front owner:** logistics, world/infrastructure, naval units, campaign/economy.  
**Parity requirement:** preserve route/port throughput, cargo commodity inventory, escort, interdiction, submarine/air attack, arrivals/delays/loss, imports, exports, blockade and resulting shortages. Inventory must reconcile across depot, convoy, port and consumer.

---

## 10. Campaign, global world war, AI, logistics and society

### LEG-CMP-01 — Fictional theatre campaign and air campaign

**Legacy paths:** `js/core/game.js`, `js/campaign/campmp.js`, `js/campaign/strategic.js`, `js/campaign/campplus.js`, `js/campaign/world.js`, `js/campaign/warrecord.js`.  
**Legacy maturity:** `implemented-gameplay` with front/airfield ownership, missions, debrief, AI sorties, reserve/stock/supply and persistent ledger pieces.  
**Old-data quality:** many force/production/attrition/maintenance rates are gameplay values.  
**Iron-Front owner:** `game/modules/campaign/`, missions, logistics, AI, world/front infrastructure, core persistence.  
**Parity requirement:** preserve persistent campaign state, bases/airfields/frontlines/sector ownership, mission generation/tasking, CAP/intercept/escort/strike/SEAD/CAS, strategic bombing, time skip, AI sorties, reserves/stock, debrief/grade, war history, save/import/export, pilot career, co-op and progression. Ensure each feature has authoritative state and causes.

### LEG-CMP-02 — Global world war and national forces

**Legacy paths:** `js/war/core/worldwar.js`, `js/war/military/orbat.js`, `js/war/military/forces.js`, `js/war/military/strategy.js`.  
**Legacy maturity:** `implemented-gameplay` strategic country/front/equipment/formation model.  
**Old-data quality:** explicitly estimated national air and ground strengths, OOB and many national catalogues. Real formation names may be used but their in-game location/strength/fate is fictional; national equipment catalogues are generic technology tiers unless explicit equipment names are provided.  
**Iron-Front owner:** `game/modules/campaign/world-war/`, `game/modules/ground-units/`, `game/modules/ai/`, logistics and platform catalogues.  
**Parity requirement:** preserve independent country actors, coalition alignment, neutral/partner/alliance changes, fronts on land borders, sector-level advance/retreat, air theatres, order of battle, squadrons, brigades, battalions, readiness, commanders, equipment and unit losses, reserve/production, capture and ceasefire. Mark fictional order of battle and estimates accurately; do not present scenario allocation as real force strength.

### LEG-CMP-03 — National economy, procurement, resources, trade and production

**Legacy paths:** `js/war/society/economy.js`, `js/war/military/forces.js`, `js/war/military/ops.js`, `js/war/military/supply.js`, `js/war/world/infra.js`.  
**Legacy maturity:** `implemented-gameplay` national economic/industry indices, arms stocks, procurement/trade, supply and infrastructure services.  
**Old-data quality:** expressly aggregate estimates, not precise national accounts or real defense inventories.  
**Iron-Front owner:** `game/modules/logistics/`, campaign institutions/economy, world infrastructure.  
**Parity requirement:** preserve finite fuel/ammunition/spares/vehicle/aircraft stocks, production, procurement, trade, export controls, prices/markets, supply priority, route capacity, stockpile distribution, convoy interdiction, repair/replacement and shortage effects. Typed commodity ledgers must reconcile. Keep estimated economic inputs separate from actual simulated transactions.

### LEG-CMP-04 — Logistics routes, roads, bridges, maintenance and supply

**Legacy paths:** `js/war/military/supply.js`, `js/war/military/ops.js`, `js/war/world/infra.js`, `js/campaign/world.js`, `js/world/wnet.js`.  
**Legacy maturity:** `implemented-gameplay` capital-to-front supply, roads/rivers/bridges, convoys, stock delivery, interdiction, unit readiness, aircraft maintenance and airfield repair.  
**Old-data quality:** delivery/capacity/repair rates are game abstractions.  
**Iron-Front owner:** `game/modules/logistics/`, `game/world/infrastructure/`, `game/modules/campaign/`, platform maintenance systems.  
**Parity requirement:** preserve road/rail/port routes, bridge cut/repair, route capacity, priority allocation, finite travel time, fuel/ammunition/spares, depot and field inventory, resupply, field capture, damage repair, airframe maintenance, ground-unit readiness and interdiction. Destruction/delay must affect consumers that use that route.

### LEG-CMP-05 — Strategic air war, bombers, missiles and nuclear escalation

**Legacy paths:** `js/campaign/strategic.js`, `js/war/military/strategic.js`, `js/war/core/worldwar.js`, `js/war/military/visible.js`.  
**Legacy maturity:** `implemented-gameplay` strategic bomber raids, visible missile salvos/interceptors, long-range conventional strike, strategic inventories, and optional abstract nuclear-ending switch.  
**Old-data quality:** strategic force counts rounded estimates; strategic weapon flight/effects are abstract.  
**Iron-Front owner:** `game/modules/campaign/strategic-operations/`, weapons/long-range, `game/modules/naval-units/`, air defence.  
**Parity requirement:** preserve B-52H and Tu-95MS strategic raids, bomber/escort planning, conventional cruise/ballistic/hypersonic strike at appropriate declared abstraction, warning/interception, strategic stock, submarines and nuclear escalation governance. Preserve anti-war catastrophe ending. Keep nuclear effects abstract and non-operational; do not add targeting/yield/weapon-construction detail.

### LEG-CMP-06 — Intelligence, SIGINT, deception, media and information warfare

**Legacy paths:** `js/war/society/intel.js`, `js/war/society/infowar.js`, `js/war/society/media.js`, `js/war/core/aicore.js`.  
**Legacy maturity:** `implemented-gameplay` reports, uncertain attribution, radio interception, communications compromise, deceptive decoys/feints/camouflage, propaganda claims and corrections.  
**Old-data quality:** some detection/likelihood values are abstract.  
**Iron-Front owner:** `game/modules/campaign/intelligence/`, `game/systems/communications/`, AI, campaign/society.  
**Parity requirement:** preserve sensor and human intelligence reports, access to only what each side can observe, confidence and attribution, jamming/intercepted radio, radio security changes, deception and decoys, camouflage/feints, false alarms, information claims and corrections, media outlets/journalists, public trust and decision consequences. A claim must not overwrite authoritative event truth.

### LEG-CMP-07 — Institutional AI, commanders, politics and diplomacy

**Legacy paths:** `js/war/core/aicore.js`, `js/war/military/strategy.js`, `js/war/society/leaders.js`, `js/war/society/diplomacy.js`, `js/war/society/natpol.js`.  
**Legacy maturity:** `implemented-gameplay` institutional decisions, commander records, front intent, alliance alignment, ceasefire and war-ending logic.  
**Old-data quality:** behavioral probabilities are game-level; leaders and incidents may be generated fiction.  
**Iron-Front owner:** `game/modules/ai/`, `game/modules/campaign/institutions/`, world-war, personnel.  
**Parity requirement:** preserve government/general staff/air force/navy/logistics/intelligence/foreign/finance/civil defence institutions; mandate, priorities, resource decisions, risk appetite, horizon, planning, delegated authority, disagreements, confidence, after-action review, adaptation, commander dialogue and strategic decisions. Keep institutional AI bounded by legal authority and available information.

### LEG-CMP-08 — Population, civilians, cities, services, media and justice

**Legacy paths:** `js/war/society/people.js`, `life.js`, `society.js`, `civic.js`, `justice.js`, `media.js`, `js/war/world/cities.js`, `infra.js`, `hazards.js`.  
**Legacy maturity:** `implemented-gameplay` population/civilian/city/service records, displacement, municipal decisions, civilian harm, public response, media, court cases and cultural heritage.  
**Old-data quality:** many aggregate demographics and impacts are estimates; fictional people/leaders/outlets are clearly generated.  
**Iron-Front owner:** `game/modules/campaign/society/`, personnel, world/infrastructure, justice/accountability.  
**Parity requirement:** preserve population/household/individual records where instantiated, displacement/refugees, housing and damage, power/water/hospitals/schools, relief/aid/shelters, city government/mayors, civil society, media/journalism, public trust, justice/investigations/war crimes, corruption/black markets, diplomacy and cultural heritage. Clearly mark estimates and generated identities. Civilian systems must not be a cosmetic UI layer.

### LEG-CMP-09 — Weather, climate, terrain, ecology, hazards and emergency response

**Legacy paths:** `js/war/world/seasons.js`, `js/war/world/hazards.js`, `js/war/world/enviro.js`, `js/core/game.js`, `js/world/geo.js`.  
**Legacy maturity:** `implemented-gameplay` campaign/war seasons, weather, local time, climate palette, natural emergencies and effects on service/operations.  
**Old-data quality:** weather/country-level hazards mostly abstract, terrain source quality varies and offline terrain is coarse/procedural.  
**Iron-Front owner:** `physics/environment/`, `game/world/`, campaign/society/humanitarian response.  
**Parity requirement:** preserve local solar time, theatre weather, season, rain/snow/fog/visibility, snow/ground state, storms/hazards, fires/floods/other disasters, emergency response and recovery. Distinguish real source terrain from fallback/procedural terrain and state the fidelity/coverage of each tile.

### LEG-CMP-10 — Post-war, accountability, memorial, cemetery and anti-war epilogue

**Legacy paths:** `js/war/society/cemetery.js`, `js/war/society/postwar.js`, `js/war/society/justice.js`, `js/war/society/chronicle.js`, `js/war/ui/endscreen.js`, `js/campaign/warrecord.js`.  
**Legacy maturity:** `implemented-gameplay` casualty archive, named records where the simulation knows them, missing/captured fates, investigations, postwar continuity and end-of-war report/epilogue.  
**Old-data quality:** event-derived facts should be preserved; estimated distant losses must remain labelled.  
**Iron-Front owner:** campaign personnel, campaign/society, justice, history and persistence.  
**Parity requirement:** preserve named military/civilian loss records only where supported by actual events, missing-person status before resolution, capture/exchange, accountability, memorial/cemetery, damaged/disabled/withdrawn survivors, veterans, reconstruction, postwar clock, end credits and anti-war consequences. Preserve user's stated goal: medals/awards must not turn war into uncomplicated glory; consequences and memorials should remain central.

### LEG-CMP-11 — Local co-op and multiplayer campaigns

**Legacy paths:** `js/campaign/campmp.js`, `js/war/ui/localroom.js`, `js/war/` multiplayer host/publish code, PeerJS vendor.  
**Legacy maturity:** `implemented-gameplay` for local/BroadcastChannel and peer multiplayer across real pages, shared sorties/battles and host-authoritative campaign state, with known synchronization constraints.  
**Old-data quality:** protocol/security not sufficient as a production authoritative service.  
**Iron-Front owner:** `game/core/networking/`, persistence, campaign authority.  
**Parity requirement:** preserve single-player/offline operation, host-authoritative campaign, peer/local co-op modes, shared flight/battle visibility, multiplayer infantry/battle and save/rejoin/resync. Persistent authoritative campaigns require a backend; static GitHub Pages alone cannot be the authoritative server.

---

## 11. World, assets, audio and user experience

### LEG-WORLD-01 — Real Earth, terrain streaming, airports, towns, cities and world map

**Legacy paths:** `js/world/geo.js`, `js/world/worldflight.js`, `js/world/worldmap.js`, `assets/world/`, `assets/world/SOURCES.md`.  
**Legacy maturity:** `implemented-gameplay` global coordinates, floating origin, real terrain tiles, airports/runways, Natural Earth/GeoNames places, map and fallback terrain.  
**Old-data quality:** mixed: geospatial source/licence/accuracy are documented; some military flags are inferred, towns are centre points, populations estimated, global fallback elevation coarse.  
**Iron-Front owner:** `game/world/`, spatial core, geodata pipeline, renderer.  
**Parity requirement:** preserve real Earth geographic frame, WGS84/local projection conversion, origin rebasing, terrain tile fetch/cache/LOD, global map and airport selection, runway ends/length/heading/surface/elevation, towns/cities/urban footprints and offline fallback. Data source, licence and accuracy must accompany each geospatial layer.

### LEG-WORLD-02 — Roads, rivers, bridges, forests, tree collision and buildings

**Legacy paths:** `js/world/wnet.js`, `js/world/wtrees.js`, `js/world/worldflight.js`, `js/war/world/infra.js`, `js/war/ground/infantry.js`.  
**Legacy maturity:** `implemented-gameplay` road/rivers/bridges networks, procedural trees with collision, generated towns and enterable buildings/fortifications in battles.  
**Old-data quality:** roads/rivers generalized; building footprints/heights and interiors often generated rather than surveyed; tree distribution generated.  
**Iron-Front owner:** `game/world/infrastructure/`, `game/world/vegetation/`, `game/world/structures/`, collision/spatial, infantry.  
**Parity requirement:** preserve vehicle/foot traffic route graph, river crossing/bridge ownership/damage, trees/vegetation/collision, urban buildings/interiors/doors/windows/stairs, fortifications, destruction/collapse, rubble and line of sight. Collision and sensor occlusion must use world geometry truth, not render-only meshes.

### LEG-WORLD-03 — Custom models, animation, materials and sound

**Legacy paths:** `assets/assets.config.js`, `assets/models/`, `assets/audio/`, `js/core/assets.js`, family make-model functions.  
**Legacy maturity:** `implemented-gameplay` asset manifest and loading, GLTF models, procedural aircraft model generation and configurable audio replacement.  
**Old-data quality:** asset quality/licence varies; several aircraft use procedural/generated model or inherited cockpit/model.  
**Iron-Front owner:** `docs/assets-and-pipeline/`, `game/graphics-engine/`, exact platform asset manifests, audio/presentation.  
**Parity requirement:** preserve custom GLB/GLTF aircraft/vehicle/weapon/building models, material/texture variants, animation points (gear, canopy, control surfaces, doors, rotors, pylons, weapon separation), engine/afterburner/gun/missile/RWR/radio/explosion/weather/UI sounds, custom asset override support, attribution/licence/hash/scale/axes/pivot/LOD and runtime asset fallback.

### LEG-WORLD-04 — Input devices, bindings, mobile support, UI and audio controls

**Legacy paths:** `js/core/binds.js`, `js/core/hangar.js`, `js/core/perfhud.js`, `js/core/startup.js`, `js/war/ui/`, radar set-control code.  
**Legacy maturity:** `implemented-gameplay` key/mouse/HOTAS/gamepad bindings and selected mobile radar interactions.  
**Old-data quality:** interface behavior is code-grounded but needs browser/device revalidation.  
**Iron-Front owner:** `game/graphics-engine/`, input, cockpit, accessibility/UI.  
**Parity requirement:** preserve configurable keyboard/stick/throttle/pedal/gamepad inputs, dead zones/inversion/sensitivity, HOTAS mapping, mobile touch for the standalone radar/sensor lab, pause/menu/debrief/hangar, control profiles, performance HUD, accessibility and sound settings.

---

## 12. Test assets, developer tools and explicit legacy quality gates

### LEG-DEV-01 — Regression tests, calibration and self-audit tooling

**Legacy paths:** `tests/run.js`, `scripts/release-check.js`, `scripts/spec-trace.js`, `scripts/depth-audit.js`, `scripts/deps.js`, `scripts/sensor-coverage.js`, `scripts/gen-rwr-registry.js`, `docs/CALIBRATION.md`, `docs/campaign/TRACEABILITY.md`, `docs/campaign/DEPTH.md`.  
**Legacy maturity:** `implemented-gameplay` test harness and generated registries/reports.  
**Old-data quality:** test coverage is valuable, but a green regression harness only proves the tested behaviors and not engineering fidelity. Depth/traceability is self-reported and must not be treated as independent validation.  
**Iron-Front owner:** `game/tests/`, `docs/testing-and-validation/`, schema validation, CI, data-provenance tools and developer diagnostics.  
**Parity requirement:** retain headless-browser regression tests, feature-source traceability, sensor registry audits, RWR/sensor code generation where appropriate, calibration logs and performance benchmarks. Iron-Front should improve these with typed fixtures, causal tests, data provenance, replay determinism, held-out validation cases and CI.

## 13. Required Claude workflow for legacy migration

Before removing, replacing or claiming parity for any old capability, Claude must:

1. Search this inventory by `LEG-*` ID and inspect the cited old source files.
2. Inspect the old implementation itself, not only the README/changelog.
3. Identify whether the old behavior is actually active, partially wired, catalogue-only or visual-only. Check the source path, call sites, update loop, generated files and tests.
4. Record the target canonical owner, producer/consumer contracts, authoritative state, update domain, failure/recovery behavior and data needs.
5. Identify which behavior can be migrated as gameplay requirements and which numeric values are legacy tuning/estimates.
6. Keep the capability listed as `not-started`, `specification`, `partial`, `runtime-parity` or `validated-fidelity`. Never mark a feature complete because a folder, schema, menu entry or static mesh exists.
7. Add tests and an end-to-end playable vertical slice before declaring runtime parity.
8. Only declare `validated-fidelity` when a named exact platform/equipment configuration has traceable evidence, a stated validity envelope, independent or appropriate source comparisons, error tolerance and repeatable tests.

**Scope lock:** the first implementation vertical slice may be F-16 flight, but it does not delete or redefine the later requirements. All `LEG-*` capabilities remain visible and are migrated in dependency order.

## 14. Suggested order for the first audits

1. **Flight / aircraft audit:** `js/core/game.js`, `js/planes/`, `js/hangar/`, `js/flight/`, `js/cockpits/`, `docs/CALIBRATION.md`. Separate data for each aircraft from shared simulation code and record which aircraft have independent models/cockpits.
2. **Sensors / weapons audit:** `js/sensors/`, `js/rwr/`, `js/weapons/`, `js/aircraft/`, `docs/sensor_coverage.md`, `docs/radar_waveform_data.md`. Map active data fields and call sites; classify every figure by source.
3. **Rotorcraft / ground / infantry audit:** `js/rotorcraft/`, `js/war/ground/`, `js/war/military/armor.js`, `gfight.js`, `infantry.js`. Split real mechanics from gameplay abstractions and define platform-specific data packages.
4. **Campaign / world / society audit:** `js/campaign/`, `js/war/`, `js/world/`, `assets/world/SOURCES.md`, campaign implementation/ownership/traceability. Identify what is already stateful/causal, what is aggregated and what is estimated.
5. **Assets / UX / multiplayer audit:** `assets/`, `js/core/assets.js`, input bindings, cockpit code, peer/local networking and tests.

The old game is a source of requirements and migration evidence. Iron-Front must be cleaner, testable and more technically accountable, but it must not lose the breadth of the experience that was already built.
