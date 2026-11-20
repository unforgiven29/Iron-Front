# MiG-29 product 9.13 — installed aircraft systems map

**Internal baseline:** single-seat product 9.13; the folder label MiG-29A is for repository organization only. **Status:** research outline, with important applicability gaps; no functional aircraft system runtime exists.

The [GAF T.O. 1F-MIG29-1 flight manual](https://www.airwar.ru/other/manuals/%5Baviation%5D%20-%20%5Bmanuals%5D%20-%20MiG-29%20Flight%20Manual.pdf), dated 30 September 1994 with Change 4 dated 20 September 2001, is a detailed source for a Luftwaffe-operated MiG-29 installation. Its cover/title does not identify the selected product 9.13 clearly enough to treat every circuit detail as authoritative for the enlarged-spine aircraft. Use it as a source-described architecture reference and mark all transfer to product 9.13 provisional until supported by exact 9.13 documentation. This is an online mirror, not a repository-owned controlled publication.

## Focused guides

- [Electrical generation and distribution](electrical.md)
- [Hydraulic circuits and emergency pump](hydraulics.md)
- [Pneumatic stored-gas systems](pneumatics.md)
- [Auxiliary, environmental and cooling interfaces](auxiliary-environmental.md)

## Acceptance suite

See [MiG-29 product 9.13 systems architecture acceptance](../../../../tests/acceptance/MiG-29-platform-systems.md) for source-applicability, electrical, hydraulic, pneumatic, emergency, damage-isolation and replay scenarios.

## Distinctive system composition described in the GAF manual

The source describes a different arrangement from the F-16:
- One primary three-phase AC generator with a hydrodynamic constant-speed drive, one DC generator, a PTO DC/AC converter, two silver-zinc batteries and a distribution network.
- Main and hydraulic-boost circuits, with one gearbox-driven variable-displacement pump per circuit, dual-chamber primary flight-control actuators, an emergency pump in the boost circuit, and separate accumulators.
- Two independent nitrogen pneumatic systems (main and emergency) with finite bottles and check-valve isolation.
- Pneumatic pressure also pressurizes hydraulic reservoirs through a regulated connection.
- Hydraulic reservoirs are installed in fuel tank 3 and cooled by fuel heat exchange in the described configuration.
- Landing gear is electrically commanded and hydraulically actuated; emergency lowering uses a separate pneumatic path.

Treat these as exact features of the source-described configuration, not as automatic proof of product 9.13. In particular, verify whether product 9.13 retains the same generator/gearbox fit, hydraulic chamber allocation, reservoir location, control logic, pneumatic circuits and emergency pump.

## Required platform package data

Create exact installation records for source and drive, AC/DC distribution, converter and battery links; circuit graph and return paths; pump curves/drive; hydraulic actuator chambers and load connections; emergency pump trigger and source; reservoir pressurization and cooling; gas bottles/regulators/check valves; landing gear and brake control chain; cockpit controls and indication supply. Each data record needs its own product/variant applicability and source evidence.

Do not borrow F-16 values or F-16 EPU behavior. Do not use an F-16-style EPU as a stand-in for the MiG emergency hydraulic pump or PTO converter.
