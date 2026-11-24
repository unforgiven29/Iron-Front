# systems/electrical

Owner of electrical bus-power physics (`ElectricalNetwork.ts`): generators on engine or accessory
drives, converters, batteries with finite charge, buses with automatic transfer down a priority
list, load shedding on backup sources and overload trips. No aircraft logic lives here.

Each aircraft supplies its OWN installation and consequences:

- MiG-29: `platforms/aircraft/mig29/MiG29Systems.ts` — GAF T.O. 1F-MIG29-1: 30 kVA AC generator and
  12 kW DC generator on the airframe gearbox (driven by the faster engine per the freewheel rule),
  PTO DC/AC converter, silver-zinc batteries; AC on PTO or DC on batteries sheds the SAU/AFCS.
- F-16: `platforms/aircraft/f16c-block50/F16Electrical.ts` — secondary-reported: main 60 kVA,
  standby 10 kVA, EPU 5 kVA, FLCS PMG and batteries; EPU auto-start on loss of both generators;
  loss of FLCS power freezes the surfaces.

Related runtime hooks (`AircraftDefinition`): `electrical`, `systemsCoupling`, and
`AircraftSystems.accessoryDrives`; flight controls see bus state through `FlightSensors.electricalBuses`.
