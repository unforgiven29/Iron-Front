# F-16C Block 50 — Airframe and Aircraft Systems

Document aircraft-specific structure, wing/LEX/tails, surface stations, landing gear, fuel tanks/feed/transfer, electrical generation and buses, EPU, hydraulic systems A/B, actuators, environmental control, oxygen, canopy, ejection seat, brakes, anti-skid, speed brake, fire detection/extinguishing, damage zones and line routing.

Do not use a global `aircraftPowered` boolean. Model providers/consumers, capacity, voltage, pressure, flow, priority, transient response and faults. A failure should affect only connected downstream systems. Record exact redundancy only when supported by an applicable source.

Sources: [Falcon BMS Flight Manual 4.38](https://cdn.falcon-bms.com/docs/4.38/TO%201F-16CMAM-1%20BMS.pdf); [USAF F-16 fact sheet](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104505/f-16-fighting-falcon/).
