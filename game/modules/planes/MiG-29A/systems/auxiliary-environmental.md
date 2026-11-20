# MiG-29 product 9.13 — auxiliary, environmental and thermal interfaces

**Purpose:** document the systems that couple into the electrical, hydraulic and pneumatic networks. **Status:** preliminary source integration map; do not treat every fit as authoritative for product 9.13 without variant-specific evidence.

## APU and engine accessory interfaces

The GAF MiG-29 flight manual identifies an auxiliary power system and describes internal-power ground operation in which the APU can generate electrical and hydraulic power. It also describes the AC generator and hydraulic pumps as gearbox-driven. The selected product 9.13 package therefore needs distinct records for:
- APU mechanical state, start sequence, fuel/air requirements and permissible ground/flight operation.
- APU-generated electrical/hydraulic outputs only where the exact source supports those outputs.
- Engine gearbox power take-offs and load interactions for AC generation, DC generation and hydraulic pumps.
- Interlocks that disconnect engine gearbox drives during the described internal-power mode.

Do not assume the APU is an unlimited ground generator or that it can replace every engine-driven source in flight.

## Environmental control and equipment cooling

The manual source set and technical descriptions identify air-conditioning/pressurization and radar cooling functions, but exact product 9.13 installation details require dedicated evidence. Keep separate:
- Cabin/cockpit ventilation, temperature control and pressurization.
- Avionics/equipment-bay cooling and pressurization.
- Radar/electronics liquid or gas cooling loops where specifically fitted.
- Engine/accessory, hydraulic-fluid and fuel thermal paths.
- Pilot oxygen/breathing equipment and anti-G/pressure-suit functions where installed.

Use game/systems/cooling for installed cooling-fluid/airflow networks and physics/thermal for heat transfer. Pneumatic compartment pressurization is not the same as the environmental-control airflow loop. Radar cooling consumes power and cooling capacity; transmitter temperature then affects radar equipment through its owner interface.

## Cross-system examples

- APU start may require battery/DC supply, then provide a bounded mechanical/electrical/hydraulic service output.
- Hydraulic pump demand is mechanically coupled to the engine gearbox, not arbitrarily charged to the electrical network.
- Hydraulic reservoir headspace pressurization is supplied by the main pneumatic network through a regulator.
- Hydraulic reservoir cooling is coupled to fuel tank 3 in the source-described installation, with finite heat transfer.
- The hydraulic pressure indicator is powered by 115 VAC in the source-described installation; loss of its electrical supply makes the indication unavailable without automatically depressurizing the hydraulic circuit.
- Radar/avionics equipment require both electrical supply and their installed cooling/pressurization services; losing one should affect equipment through its documented thermal/pressure limits, not instant global shutdown.

## Research checklist

Confirm exact 9.13 APU type/output/mode, engine gearbox output mapping, ECS architecture, cockpit pressurization control, air conditioning/heat exchanger/turbocooler, radar cooling fluid and capacity, equipment-bay pressurization, oxygen/anti-G equipment fit and electrical bus assignments. Record each source and variant applicability independently.
