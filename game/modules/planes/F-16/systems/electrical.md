# F-16C Block 50 — electrical installation

**Shared owner:** [game/systems/electrical](../../../../systems/electrical/README.md). **Platform:** F-16C Block 50, GE F110-GE-129. **Status:** architecture and source-based system outline; exact selected-engine/operator bus diagram and ratings remain to be verified.

## Architectural elements

The Block 50/52+ flight manual T.O. GR1F16CJ1 describes a multi-domain electrical installation with main AC generation and a standby generator; emergency AC/DC buses and an EPU generator; AC-to-DC conversion and multiple essential/non-essential bus groups; battery buses and aircraft battery; dedicated flight-control electrical supply (FLCS PMG and four FLCS power branches/relays in the source diagrams); and external AC power provisions with voltage, frequency and phase monitoring.

Keep these as distinct physical source and bus objects. Do not collapse the main generator, standby generator, EPU generator, FLCS PMG and aircraft battery into one generic source. Exact generator capacities, bus ratings, contactor logic, engine accessory fit and FLCS branch implementation must be verified for the selected GE F110 Block 50. The manual has Block 50 and 52+ applicability and contains engine-specific material; do not copy a value from another engine fit.

## Normal operation and distribution

Model the selected aircraft's actual main/standby source paths and bus diagram. Bus groups include essential and non-essential AC/DC functions, emergency buses, battery buses and dedicated FLCS power. Each load must be attached to the correct bus/branch with its voltage/frequency requirement, startup demand, priority and response to a transfer or interruption.

The manual's normal-start sequence uses the aircraft battery before engine generation is available; main-power selection then connects the normal source and enables the standby path. External ground power may be accepted only when phasing, voltage and frequency are within the monitor unit's permitted envelope. A ground source must be isolated when disconnected and must not become a hidden in-flight source.

## Flight-control power is a special installation

The FLCS has dedicated power generation/branches and relay logic. The source describes four FLCS branches (A/B/C/D) and a dedicated FLCS PMG. Model each branch as separately identifiable when the selected configuration supports it, including source, relay, monitoring, isolation and loss behavior. Battery support/transfer to the FLCS is a specific path with its own contactor/relay permissives; do not make the complete avionics battery bus an equivalent substitute for FLCS power.

FLCS electrical availability and hydraulic actuator supply are separate conditions. A powered flight-control computer cannot move an actuator without sufficient hydraulic force/flow, and available hydraulic pressure cannot make a dead flight-control computer issue commands. The flight-control actuator chain consumes electrical power for the controller/valves and hydraulic power for motion as fitted.

## EPU emergency operation

The EPU is a cross-domain emergency power unit. The Block 50/52+ manual describes it as providing emergency electrical power and emergency hydraulic pressure to System A. It can automatically activate when both main and standby generators fail or when both hydraulic pressures fall below the documented threshold; manual operation is also available subject to installation interlocks. It requires DC power from a battery bus to activate.

When running, the EPU generator powers the emergency AC/DC buses. Load reduction is part of its design: essential/non-essential DC distribution changes and some non-emergency buses are removed. EPU hydraulic output augments System A. The EPU operates from engine bleed air when sufficient and hydrazine supplementation when required, so available drive condition and consumable/endurance state matter. Implement the precise switch/trigger details and emergency load list only after exact applicability is confirmed.

Do not implement EPU as a generic generator that instantly energizes every bus. It has start delay, a limited load envelope, a coupled hydraulic output, finite operating resources, heat/exhaust and common failure modes. The EPU's electrical and hydraulic benefits must disappear together when the shared machine/drive fails.

## Load classes and consumers

Create platform-specific load records for FLCS computers, dedicated branches, relays and valve electronics; engine control/accessory and fuel-system controls/pumps; flight instruments, warning/caution systems and essential displays; radar, RWR, IFF, navigation, radio, mission computers and displays; external stores, release control, gun systems and applicable equipment; hydraulic/cooling pumps where electrically driven, lighting, pitot/AOA heating and environmental-control equipment.

The EPU/standby load-shedding matrix must be sourced for the chosen configuration. Do not simply sort all loads by arbitrary importance. Some consumers may be disconnected automatically, others retained, some retained only on selected buses, and some may have their own dedicated supply.

## Coupled failure behavior

| Fault | Required causal behavior |
|---|---|
| Main generator/drive fails | Correct buses transfer or degrade according to standby and contactor topology; do not immediately black out all equipment |
| Standby generator fails | Main supply remains if healthy; standby warning appears; backup margin is gone |
| Main and standby lost | EPU activation path is evaluated using switch/interlock/DC power conditions; emergency buses energize after startup and loads shed |
| Aircraft battery depleted/isolated | Only consumers using battery paths lose that reserve; ability to start EPU/FLCS backup may be affected where specified |
| One FLCS branch/relay fails | Loss is confined to its branch and its actual consumers; no assumed all-or-nothing FLCS collapse |
| Converter/contactor/bus fault | Only downstream loads lose or degrade power; protection and isolation operate on real topology |
| External-power mismatch | Ground power is rejected/isolated rather than connected with arbitrary voltage/frequency |
| EPU common failure | Both emergency electrical and EPU hydraulic outputs fail together; independent normal sources remain only if still healthy |

## Required source data

Obtain exact selected-configuration electrical one-line diagrams and load tables; main/standby/EPU generator type, ratings and drive; battery chemistry/capacity/limits; FLCS PMG/branch schematic; converter/transformer ratings; bus nominal voltage/frequency; contactor/protection/interlock logic; load-shedding priorities; cockpit switch/indicator mapping; EPU triggers, start delay, runtime and emergency consumer list. Record manual title/revision/page and exact block/engine/operator applicability for each value.

## Acceptance scenarios

- Ground external-power validation and battery-only pre-start checks.
- Battery-to-main source transition and standby source availability.
- Main source loss with standby response and correct bus/load continuity.
- Main plus standby loss; DC-dependent EPU activation; EPU emergency bus and load-shed behavior.
- EPU hydraulic and electrical outputs remain causally coupled and finite.
- FLCS branch-specific faults, PMG loss, battery relay/transfer and electrical self-test.
- Power transients during radar/avionics startup and hydraulic pump/lighting loads.
- Bus short/open with local protection and unaffected independent bus groups.
- EPU switch/interlock faults, ground safety and failure to start.
- Deterministic replay, electrical energy accounting and consumer reset/warm-up after restoration.
