# Plan: cockpits, avionics and the next systems-fidelity pass

Status: **plan** (nothing below is implemented unless marked done). Owners follow
`docs/claude/README.md`: aircraft packages own their cockpit, avionics fit and system definitions;
shared code stays platform-neutral; rendering/UI never decide simulation outcomes.

Sources in hand:

- **F-16C/D Block 50/52+**: T.O. GR1F-16CJ-1 (HAF flight manual, 15 Oct 2002, Change 1),
  Section I systems (engine F110-GE-129 DEC/SEC, fuel, hydraulic, electrical, FLCS, cockpit
  controls, cautions/warnings, CNI/DED, IFF) and Section V limits. Figures 1-19, 1-20, 1-22 (fuel
  system and quantities, JP-8) supplied by the user.
- **MiG-29 (9.12-family, GAF)**: GAF T.O. 1F-MIG29-1 Section 1 (already used): AEKRAN, VIWAS,
  TLP lights, AOA/G meter (COC), engine indications, fuel indicator, electrical/hydraulic panels.

Every value taken from these is tagged with its source and applicability (HAF Block 50/52+ is the
correct baseline for our F-16C Block 50; GAF MiG-29G is 9.12-family, 9.13 applicability unverified).

---

## Part 1 — Systems fidelity (batch B, before cockpits)

These feed the cockpit indications, so they come first.

### F-16 (from T.O. GR1F-16CJ-1)

1. **Fuel system rebuild** (`F16FuelSystem.ts`): tanks F-1, F-2, forward and aft reservoirs, A-1,
   wings, centerline, external wings with fig. 1-22 JP-8 quantities (C model: wings 550 each, F-1/F-2/
   FWD RSVR 3250, AFT RSVR/A-1 2810, reservoirs 480 each, CL 1890, 370-gal wings 2420 each).
   Components per figs. 1-19/1-20: electrical boost pumps, fuel-pressure-driven transfer pumps,
   hydraulic-driven transfer pumps (pump-drive pressure from HYD SYS A), ejector pumps, fuel flow
   proportioner, transfer trim valve, crossfeed and suction-feed valves, refuel shutoff valves,
   external-tank transfer by bleed-air pressurisation, ENG FEED knob (NORM/AFT/FWD/OFF), FUEL MASTER,
   AIR REFUEL switch, tank inerting, fuel/oil heat exchanger with FUEL/OIL HOT caution, FWD/AFT FUEL
   LOW lights, FUEL QTY SEL indications.
2. **Hydraulics**: systems A and B with their actual consumer split (FLCS actuators both;
   utilities on B: gear, brakes, NWS, gun, AR door; speedbrakes on A), brake/JFS accumulators, EPU
   pump on A, HYD PRESS indicators and HYD/OIL PRESS warning logic.
3. **Electrical**: main generator on the ADG with CSD, standby generator, EPU generator, FLCS PMG
   and FLCS power supplies, main and FLCS batteries, the real bus list (AC/DC essential, non-essential,
   emergency, battery buses), ELEC panel cautions.
4. **F110-GE-129 control**: DEC (PRI) / SEC modes per the manual, IGV schedule, nozzle control,
   ignition and relight, gearboxes and engine alternator, FTIT indication, oil system and the
   HYD/OIL PRESS warning, ENGINE warning light logic, ENGINE FAULT/EEC/SEC/BUC cautions.
5. **F-16 engine module breakdown** (structure only; the GE deck stays the thrust source): inlet & fan,
   variable IGVs, nine-stage HPC, annular combustor + ignition, HPT, LPT, two spools (done), bypass
   duct & mixer (done: core/bypass split), afterburner (zones, flameholders; done: zones/blow-out),
   variable C-D nozzle (done), DEC/MEC/AFC logic, fuel/oil/lube/gearbox/accessories.

### MiG-29 (GAF T.O.)

6. Hydraulic consumers per system as listed in the manual (main: LEF/flaps, gear, brakes, NWS,
   speedbrakes, intake ramps, kicker; boost: flight controls), speedbrake auto-retract on boost loss,
   pressure limiter at 13 MPa isolating non-flight-control users.
7. Fuel: tank 2 boost pumps (done), level-control valves, relief/dump valves, fuel heat from oil/
   radar cooling.

Deliverable for each: tests against the manual's stated behaviour, EFB pages updated.

---

## Part 2 — Cockpits and avionics

### Architecture (one owner per concern)

- **Shared avionics runtime** (`game/src/avionics/`, platform-neutral): a display page model (pages,
  soft keys, symbol primitives), a caution/warning bus (lights, master caution, aural cues, fault
  lists), a navigation solution owner (INS/GPS/air data — consumes sensors, never world truth), a
  radio/nav-aid model (TACAN, ILS, VOR/RSBN beacons from the airfield data) and a data-entry
  framework (keypads, scratchpads).
- **Per-aircraft avionics fit** in each package (`f16c-block50/avionics/`, `mig29/avionics/`): which
  displays exist, their pages and symbology, the cockpit switch inventory, and the logic that maps
  aircraft systems to indications.
- **Rendering** draws what the avionics publish; clicks on cockpit controls go through the existing
  switch registry (no direct state changes from the UI).

### F-16C Block 50/52+ (T.O. GR1F-16CJ-1)

Phase A — flight-essential:
1. HUD with real symbology modes (NAV / ILS / landing gear-down), AOA bracket, FPM, pitch ladder,
   airspeed/altitude scales, heading tape, g, Mach, max g, low-speed warning tone.
2. Caution light panel + MASTER CAUTION + Pilot Fault List Display; warning lights ENGINE,
   HYD/OIL PRESS, FLCS, TO/LDG CONFIG, DBU ON; lights driven by the systems above.
3. Engine instruments: RPM, FTIT, NOZ POS, OIL pressure, fuel flow; fuel quantity indicator with
   FUEL QTY SEL knob positions; HYD PRESS A/B gauges; EPU panel.
4. Standby instruments (ADI, airspeed, altimeter, VVI), AOA indexer.

Phase B — systems and navigation:
5. ICP + DED with CNI and the main DED pages; UFC data entry.
6. Two MFDs with OSB pages: HSD, FLCS, TEST, FUEL/ENG status, SMS (stores, later), FCR placeholder
   only when a radar model exists (no fake radar).
7. INS/EGI navigation solution and steerpoints; TACAN, ILS from airfield data; IFF panel states.

Phase C — combat avionics (each a separate stage with its own data dossier): FCR (APG-68), RWR,
countermeasures, data link, HMCS. Not started until sensor models exist per CLAUDE.md.

### MiG-29 (GAF T.O. 1F-MIG29-1)

Phase A:
1. HUD (SEI-31-class symbology from the manual), AOA/G meter (actual + max g, AoA limit marks),
   AEKRAN text warnings (already partly driven), VIWAS voice messages, TLP indicator lights, master
   caution.
2. Engine RPM (NH) / EGT gauges per engine, fuel quantity indicator with the tank-group lamps,
   hydraulic combined pressure indicator (CPI), electrical panel switches (BAT, AC/DC GEN, PTO, ANTI
   SURGE...), speedbrake/flaps/gear indications, intake/louver status lights.

Phase B: navigation (RSBN/ARK-class radio aids modelled on our airfields), INS, comms; later radar/
IRST only with sensor models.

### 3D cockpit work (both)

- Clickable switches mapped to the switch registry; panel geometry from the manual figures; gauge
  needles and lights driven from indications. The 3D modelling approach (Blender vs. code) is the
  user's choice (see earlier discussion); the avionics model does not depend on it.

### Order and size

Each numbered item is one PR with tests (indication logic tested against the manual's stated
conditions). Suggested order: Part 1 items 1–4 (F-16 systems from the HAF manual), then F-16 Phase A,
then MiG-29 Phase A, then Phase B for both.
