# Flight air-data derivation and measurement boundary

**Owner:** physics/flight-model/air-data for derived air-data interfaces and measurement provenance. Aircraft instrument hardware/sensor behavior belongs to its installed equipment and sensor/system owners. **Status:** architecture only.

Air-data computation must distinguish the physical atmospheric/kinematic quantities from what the pilot's instruments indicate. The A-4E-C includes an AirDataComputer with separate TAS/EAS/CAS and barometric-altitude calculations; Iron-Front should preserve that separation while adding explicit errors and validity.

## Physical quantities

The environment and rigid-body systems provide ambient pressure, temperature, density, speed of sound, wind, altitude and aircraft velocity. The FM derives true airspeed, Mach, local dynamic pressure and body-relative airflow from these sources. These are not automatically instrument readings.

## Indicated measurements

The installed pitot/static and air-data system may provide impact/static pressure, indicated airspeed, calibrated airspeed, equivalent airspeed, barometric altitude, vertical speed and temperature measurements depending on equipment. Each has calibration, position error, instrument error, lag, icing/blockage, leak, damage and power dependencies where installed.

Do not allow a pitot failure to reduce actual aerodynamic airspeed. Do not allow an erroneous altimeter to move the aircraft. Instrument readings are observations of the physical state, with uncertainty and faults.

## Interfaces

Publish true physical values separately from measured/indicated values. Sensor consumers, flight-control computers and cockpit instruments subscribe to the correct value type. A flight-control computer may use its own sensor/filter estimate rather than reading an ideal global Mach/AoA variable.

## Tests

TAS/EAS/CAS relationships in the supported atmosphere model; pressure-altitude conversion; unit and reference checks; sensor blockage/leak/damage; measurement lag/noise; power loss; valid/invalid indication; and assurance that air-data faults do not rewrite rigid-body truth.
