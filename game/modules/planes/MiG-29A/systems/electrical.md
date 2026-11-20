# MiG-29 product 9.13 — electrical installation

**Shared owner:** [game/systems/electrical](../../../../systems/electrical/README.md). **Selected platform:** single-seat product 9.13. **Status:** source-based architecture outline; exact product 9.13 applicability remains unverified.

## Source-described architecture

GAF T.O. 1F-MIG29-1, Change 4, describes:
- One three-phase 115/200 V, 400 Hz constant-frequency AC generator, driven from the aircraft gearbox through a hydrodynamic constant-speed drive.
- A 36 V AC transformer supply.
- One 28.5 V DC generator (the manual gives 400 A / 12 kW).
- A PTO DC/AC converter that supplies emergency AC domains after AC generator or transformer failure.
- Two silver-zinc batteries, nominal 27.6 V, for DC-bus support during internal engine start or loss/low output of the DC generator.
- External AC and/or DC ground power for startup/alignment.

The source gives the AC generator a maximum output of 30 kVA, the 36 VAC transformer 1.5 kVA, and the PTO a minimum output of 1.5 kVA at 115 VAC and 1 kVA at three-phase 36 VAC. These figures are source-specific and must remain provisional for the selected product 9.13 until exact applicability is independently confirmed.

This is not an F-16-style main/standby/EPU generator architecture. Do not create main/standby AC generator objects, four FLCS power branches or a hydrazine EPU merely to reuse the F-16 implementation.

## Generation and drive dependency

The AC generator is maintained at constant speed by a hydrodynamic constant-speed drive even as engine RPM/load changes. Model the drive as a mechanical device with shaft speed, oil pressure/temperature, clutch/disconnect, overspeed and failure behavior. A constant-speed-drive malfunction can require the AC generator to be disconnected; this is not a normal generator trip that magically reconnects.

The DC generator is a separate source with its own regulator and overload protection. Overvoltage/short-circuit protection disconnects it from the DC bus; the cited manual describes a ground-crew reset requirement for that condition. Preserve that maintenance/reset behavior rather than allowing an in-flight switch cycle to clear every fault.

## PTO and load shedding

The PTO converter provides emergency AC outputs when the AC generator or transformer fails. It is not a replacement AC generator and does not restore the full normal bus capacity. With AC generator failure, the manual describes automatic disconnection of non-flight-essential equipment to avoid PTO overload. The cited list includes selected inertial-platform heaters, radar/optical equipment (with a navigation-system exception), IRSTS/LRF/HMS, probe/vane heaters, windshield heater sections, AFCS, external armament and IFF altitude encoder.

Create the load-shed list as a platform configuration tied to the source/revision. Each load is attached to its actual AC/DC supply and reports a specific outage/degraded state. Do not model this as a global “avionics off” flag. The manual notes that a transformer failure while on PTO can also remove the laser range finder, flight-control angular-rate sensors and approach course/glidepath indications.

The two batteries feed the DC bus during internal engine start, low DC-generator voltage and DC-generator failure. The source notes that their charging-voltage characteristic means they are not charged while generator power is available; verify the selected product 9.13 battery/charging arrangement before implementing. They are emergency DC reserve, not a substitute for the primary AC generator or an unlimited source.

## Cockpit and controls

The source-described right-console electrical power panel includes BAT-GND SUPPLY, DC GEN, AC GEN, PTO and engine-system/fuel-pump/anti-surge switches. Controls issue commands to equipment; feedback/indications derive from generator, drive, converter, battery, bus and protection state. The DC voltmeter reports the source connected to the DC bus; the battery amp-hour counter is a separate charge indication.

## Cross-system consumers and interfaces

Wire actual electrical dependencies: engine controls; fuel pump and engine fuel-system electrical controls; ignition/start interfaces; fuel/engine anti-surge controls; flight-control/AFCS equipment; navigation/inertial units; radar, optical sight, IRSTS/LRF and helmet-mounted sight; radios/IFF; heaters; displays and warning systems; anti-skid and electrically operated pneumatic valves; landing-gear selector/valves and nose-wheel steering mode logic. Exact bus assignment and load ratings need the source wiring diagram; do not infer them from a list of powered equipment.

Hydraulic pressures are physically independent from electrical generation, but their cockpit pressure indicator described by the manual is supplied by 115 VAC from the AC generator. If the AC generator fails, the hydraulic system may still hold/use pressure while that particular indicator becomes unavailable. Publish underlying hydraulic truth and electrical indication validity separately.

## Failure matrix

| Fault | Required behavior |
|---|---|
| AC generator failure | AC buses fail/transfer to PTO-backed essential consumers; non-flight-essential loads shed; PTO capacity and thermal limit constrain remaining use |
| Constant-speed-drive fault | Drive warning/disconnect logic isolates generator; do not let the generator continue at arbitrary frequency |
| Transformer failure | PTO supplies documented essential AC domains; the source identifies additional equipment lost in this case |
| DC generator failure | Battery supplies DC bus while finite charge/current envelope allows; warning and state of charge respond |
| DC overvoltage/short | Protective disconnect isolates DC generator; ground-reset-required state remains latched if applicable |
| PTO overload/failure | Converter-backed loads brown out or disconnect according to protection; no standby AC source is invented |
| Battery depletion | DC reserve is exhausted; AC generator and PTO are not thereby replaced |
| External-power fault | Incompatible source is rejected or isolated by its monitoring/connection logic |

## Data required before authoritative 9.13 runtime

Verify generator type/ratings, constant-speed-drive mechanics and oil limits, DC generator details, actual bus topology and branch ratings, converter source and load envelope, exact battery count/chemistry/capacity/charge process, load-shedding matrix, warning logic, cockpit wiring and engine/accessory gearbox applicability for product 9.13. Store source/page/revision and confidence per record.

## Acceptance scenarios

- External AC/DC ground supply and internal-power start.
- AC generator normal regulation over engine RPM/load, drive fault/disconnect and AC generator loss.
- PTO activation, essential-load continuity, exact non-essential load shedding and converter overload behavior.
- Transformer failure with its distinct additional losses.
- DC generator loss with battery discharge and finite endurance.
- DC overvoltage/short and latched ground-reset state.
- AC generator loss while hydraulic pressure remains available but AC-powered hydraulic indication is invalid.
- Save/replay of source, battery, converter and bus states.
