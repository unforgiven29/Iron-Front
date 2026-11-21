# MiG-29 Product 9.13 — Source Register

| Source | Useful content | Caveat |
|---|---|---|
| [Eagle Dynamics MiG-29 English manual](https://www.digitalcombatsimulator.com/upload/iblock/463/DCS%20MIG-29%20Flight%20Manual%20EN.pdf) | N019/RLPK-29, avionics, cockpit, RWR, RD-33, 9-12/9-13 comparison | DCS calls its 9-13 model MiG-29S; not a plain 9.13 primary manual |
| [Eagle Dynamics MiG-29 Russian manual](https://www.digitalcombatsimulator.ru/upload/iblock/07d/elvkcoejb1qtqxs6f8xcci26elz0rga0/DCS%20MIG-29%20Flight%20Manual%20RU.pdf) | Russian terminology and figures | Same simulator-variant caveat |
| [AirWingMedia MiG-29 variants](https://airwingmedia.com/downloads/mikoyan-mig-29-fulcrum-pdf-ebook-flight-manuals/) | 9.12 / 9.13 / 9.13S distinction, spine/Gardenyia context | Secondary source |
| [NPS Institutional Archive report](https://calhoun.nps.edu/server/api/core/bitstreams/eeeed8aa-eee4-4ca5-abee-b74c2891194b/content) | Technical overview of aircraft systems | Some passages concern modernized versions |
| [DCS SPO-15 development article](https://www.digitalcombatsimulator.com/en/news/2025-07-12/) | Physics-based RWR modeling concepts | Not historical equipment proof |

For each parameter record value, units, source, page/figure, publication date/revision, product number, operator, confidence, uncertainty and status (`publicly sourced`, `estimated`, `synthetic`, `unknown`). Preserve Cyrillic labels with transliteration/translation. Linked documents are not redistributed.


## Flight-model evidence gap

The sources currently registered above are not a validated product 9.13 aerodynamic coefficient dataset or complete flight-test record. The DCS manual is simulation documentation with the variant caveat already stated; the GAF technical order in the systems research does not establish all aerodynamic values for the selected plain 9.13. Do not create numeric aero tables by scraping simulator behavior, borrowing F-16 data or substituting 9.12/9.13S values.

Use the [curated flight-dynamics reference guide](../../../../../../docs/reference-library/flight-dynamics.md) for general methods (Digital DATCOM, JSBSim architecture, NASA test methodology and flight-dynamics textbooks). These sources inform methods and software design; they do not fill the product 9.13 data gap. Keep unsupported parameters `unknown` or clearly `synthetic` until exact applicability is established.


## Movable-surface / flight-control source additions

| Source | Use | Caveat |
|---|---|---|
| [GAF T.O. 1F-MIG29-1 manual copy](https://jasonblair.net/wp-content/uploads/2015/06/MIG29-Flight-Manual-Pt-2.pdf) | Describes primary controls (tailerons, rudders, ailerons), secondary controls (LEF, flaps, speedbrakes), flap panel and upper/lower speedbrake behavior | Confirm exact applicability to the selected plain product 9.13; do not treat all values/topology as universal MiG-29 facts |
| [DCS MiG-29 English Flight Manual](https://www.digitalcombatsimulator.com/en/downloads/documentation/dcs-mig-29_flight_manual_en/) | Simulator description of geometry, LEF/slat terminology, flaps and speedbrake operation | DCS modeled variant; simulator reference only, not exact plain product 9.13 primary evidence |

Current surface-inventory conclusion: public material describes leading-edge devices/LEF, trailing-edge flaps, ailerons, tailerons, rudders and upper/lower fuselage speedbrakes. DCS documentation sometimes labels leading-edge elements "slats", while GAF wording uses LEF. Preserve that terminology discrepancy until actual slot geometry/kinematics are verified. No separate wing spoilers are identified in the current source set.
