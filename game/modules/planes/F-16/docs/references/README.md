# F-16C Block 50 — Source Register

| Source | Use | Caveat |
|---|---|---|
| [Falcon BMS Flight Manual 4.38](https://cdn.falcon-bms.com/docs/4.38/TO%201F-16CMAM-1%20BMS.pdf) | Systems, procedures, limitations, flight characteristics; multiple blocks | Simulation manual; isolate Block 50 |
| [Falcon BMS Avionics Manual 4.37](https://cdn.falcon-bms.com/docs/4.37/TO%201F-16CMAM-34-1-1%20BMS.pdf) | APG-68(V)5 and avionics modes | Simulation manual |
| [Eagle Dynamics Block 50 announcement](https://www.digitalcombatsimulator.com/es/news/2019-02-15_Beta/) | Dated F110-GE-129 / APG-68(V)5 / ALR-56M baseline | DCS's modeled fit |
| [Shaw AFB F-16C fact sheet](https://www.shaw.af.mil/About-Us/Fact-Sheets/Display/Article/663884/f-16c-fighting-falcon/) | ALR-56M, ALE-47, later APG-68(V)9 upgrades | Evolving fleet, not one frozen configuration |
| [USAF F-16 fact sheet](https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104505/f-16-fighting-falcon/) | General airframe / FBW context | Family-level |
| [AFJAG cockpit overview PDF](https://www.afjag.af.mil/Portals/77/documents/AFD-081204-037.pdf) | Broad cockpit zones | Not a Block 50 technical order |

## Flight-model research additions

| Source | Use | Caveat |
|---|---|---|
| [NASA TP-1538](https://ntrs.nasa.gov/citations/19800005879) | F-16-derived relaxed-static-stability fighter study, high-AoA departures and control-system interaction | Research/simulator configuration; not a complete Block 50 coefficient dataset |
| [NASA/TP-2004-212046](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20040040334.pdf) | F-16XL digital-FCS flight-test methodology and handling qualities | F-16XL is a modified delta-wing research aircraft, not a production Block 50 |
| [USAF Digital DATCOM manual](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/ADA086557.xhtml) | Generic semi-empirical stability, high-lift/control and dynamic-derivative methods | General estimation method; not an F-16 data source |
| [Falcon BMS FM developer notes](https://www.falcon-bms.com/blog/category/flight-model) | Simulation architecture, local aerodynamic modeling and F-16 FLCS case study | BMS implementation notes, not independent engineering validation |

For each parameter record value, units, source, page/table/figure, revision/date, block/operator/OFP applicability, confidence, uncertainty and status (`publicly sourced`, `estimated`, `synthetic`, `unknown`). These linked documents are not copied into this repository; check reuse terms before extracting images.


## Movable-surface / flight-control source additions

| Source | Use | Caveat |
|---|---|---|
| [F-16C/D Blocks 50 and 52+ Flight Manual, T.O. GR1F16CJ1, 15 Oct 2002 (third-party mirror)](https://studylib.net/doc/26036763/block-50) | Describes LEF scheduling, TEF/flaperon dual function, LEF asymmetry/lock, FLCS and speedbrakes | Mirror of a technical manual; verify revision and exact Block 50/OFP applicability against an authorized source before accepting exact schedules/limits |
| [USAF T.O. 1F-16A-1 flight manual](https://www.aahs-online.org/resources/e-library/fm/USAF-F16A_B-Flight-Manual.pdf) | Older A/B control and device terminology for historical context | Not a Block 50 data source |
| [Eagle Dynamics F-16C guide](https://www.digitalcombatsimulator.com/upload/iblock/3dc/5p9ejw7gi488n9zd15csrxxs8os2dflk/DCS_F-16C_Early_Access_Guide_EN.pdf) | Cockpit/interaction overview and simulated FLCS control panels | Simulator documentation only; do not use as independent engineering proof |

Current surface-inventory conclusion: source material identifies LEFs, TEF flaperons, stabilators, rudder and fuselage speedbrakes. The current source set does not identify separate wing spoilers or conventional slot-forming slats for the selected F-16C Block 50 package. Keep these as provisional not-fitted pending exact-baseline confirmation.
