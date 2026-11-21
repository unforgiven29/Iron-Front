# Non-cooperative target recognition (NCTR)

**Owner:** sensors/NCTR. **Status:** architecture only; no NCTR runtime is implemented.

Own classification/identification estimates made from permitted sensor-derived features without relying on an IFF reply. NCTR is not a sensor omniscience API and does not own radar/IRST signal generation or IFF interrogation.

Inputs are extracted features from a fitted sensor/processing chain (for example supported radar modulation/return features, engine/acoustic/thermal signatures or other documented method), plus calibration, aspect, range, geometry, environmental conditions, receiver quality and track uncertainty. A platform declares which methods and feature sources it actually has.

Output is a ranked hypothesis set with confidence, ambiguity, feature provenance, acquisition time, validity and track association. Training/library coverage, target variant similarities, aspect, emissions control, damage, clutter and measurement quality can produce unknown, ambiguous or incorrect classification. Do not return a certain type from a hidden entity identifier.

IFF and NCTR remain separate evidence sources; fusion may combine them but preserves conflict. Rules of engagement and command policy consume the resulting identification quality, not the renderer label.

Validate known/unknown classes, similar signatures, aspect/range variation, stale tracks, false classifications, library gaps, IFF conflict, equipment degradation and no hidden-truth leakage.
