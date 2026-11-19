# F-16C Block 50 — Variant Baseline

| System | Selected project baseline | Applicability note |
|---|---|---|
| Airframe | F-16C Block 50, single seat | Record operator and date |
| Engine | GE F110-GE-129 | Block 50 fit; do not substitute Block 52 F100-PW-229 |
| Radar | AN/APG-68(V)5 | Early/representative Block 50 baseline; later V9 upgrades exist |
| RWR | AN/ALR-56M | Listed in USAF Block 50/52 upgrade context |
| Countermeasures | ALE-47 | Confirm exact aircraft/software revision |
| Mission equipment | HTS, ECM pods, targeting pods, MIDS/Link 16, etc. | Explicit fit and date; not all guaranteed |

This library uses the APG-68(V)5 baseline described in Falcon BMS avionics material and the DCS F-16C Block 50 announcement. USAF Shaw material notes later Block 50/52 aircraft with APG-68(V)9. The project must therefore version the aircraft configuration by date/software and must not combine the V5 and V9 feature sets.

Stable ID suggestion: `f16c-block50-usaf-ccip-v1`.

Sources: [DCS Block 50 baseline](https://www.digitalcombatsimulator.com/es/news/2019-02-15_Beta/); [Falcon BMS avionics manual](https://cdn.falcon-bms.com/docs/4.37/TO%201F-16CMAM-34-1-1%20BMS.pdf); [Shaw AFB fact sheet](https://www.shaw.af.mil/About-Us/Fact-Sheets/Display/Article/663884/f-16c-fighting-falcon/).
