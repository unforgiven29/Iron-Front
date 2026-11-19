# F-16C Block 50 — AN/APG-68(V)5 Radar

Use the mechanically scanned, multimode AN/APG-68(V)5 as the initial Block 50 baseline. This is not an AESA: do not add electronic beam steering or per-element T/R module behavior. Radar physics and propagation remain in shared `sensors/Radar/` and `physics/radar/`; this folder supplies the aircraft equipment fit, controls and display mapping.

Model finite scan volume, beam pattern, scan/revisit, search/acquisition/track modes, range/velocity/angle uncertainty, look-down clutter, Doppler processing, sidelobes, mode transitions, track coast and emissions. Radar must publish time-stamped RF emissions to the shared RF environment. Never give radar hidden target truth.

Do not copy APG-68(V)9 or APG-83 performance into this profile. Exact transmitter power, waveforms, sensitivity and detection ranges require trustworthy data; otherwise keep them unknown or explicitly synthetic for tests.

Sources: [Falcon BMS avionics manual 4.37 — APG-68(V)5](https://cdn.falcon-bms.com/docs/4.37/TO%201F-16CMAM-34-1-1%20BMS.pdf); [DCS Block 50 baseline](https://www.digitalcombatsimulator.com/es/news/2019-02-15_Beta/); [Shaw AFB F-16C fact sheet](https://www.shaw.af.mil/About-Us/Fact-Sheets/Display/Article/663884/f-16c-fighting-falcon/).
