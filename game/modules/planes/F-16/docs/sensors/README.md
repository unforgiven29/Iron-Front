# F-16C Block 50 — Other Sensors and Electronic Warfare

Fit is mission- and date-dependent. Do not automatically equip every aircraft with every pod.

| System | Function | Boundary |
|---|---|---|
| AN/APG-68(V)5 | Active fire-control radar | Shared radar physics |
| AN/ALR-56M | Passive radar warning | Shared RWR engine; aircraft profile here |
| AN/ASQ-213 HTS | Passive emitter detection/geolocation support for HARM | Separate pod sensor; not the RWR |
| AN/ALQ-131 / ALQ-184 | External ECM pod, where fitted | RF emitter and resource consumer |
| ALE-47 | Chaff/flare dispenser | Inventory, programs and physical release |
| IFF / datalink / navigation | Identification and cooperative data | Separate reports with provenance and age |
| Targeting pod / EO-IR | Optional mission equipment | Explicit loadout/configuration |

Do not turn RWR bearing into precise range because HTS or datalink exists. Jammers alter the RF environment and can reveal the aircraft. MAWS is not assumed in this baseline. Sensor reports retain their own uncertainty and timestamps.

Sources: [Shaw AFB F-16C fact sheet](https://www.shaw.af.mil/About-Us/Fact-Sheets/Display/Article/663884/f-16c-fighting-falcon/); [USAF F-16 fact sheet](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104505/f-16-fighting-falcon/); [DCS Block 50 baseline](https://www.digitalcombatsimulator.com/es/news/2019-02-15_Beta/).
