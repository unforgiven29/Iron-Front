# 11 — Detection and Thresholding

## Purpose
Define how processed radar data becomes a detection report, including uncertainty, probability, and false-alarm behavior.

## Categories
- **Detection threshold:** threshold selection, sensitivity, and missed-detection/false-alarm trade-offs.
- **Probability of detection (Pd):** likelihood under stated signal, target, fluctuation, and processing assumptions.
- **Probability of false alarm (Pfa):** probability of declaring a detection from noise or clutter.
- **False-alarm rate:** expected false reports over time/search volume, with units and assumptions.
- **CFAR processing:** cell-averaging, greatest-of, smallest-of, ordered-statistic, and suitable variants.
- **Noise/clutter estimation:** reference cells, guard cells, contamination, nonhomogeneous backgrounds, and threshold adaptation.
- **Swerling models:** influence of target fluctuation assumptions on detection statistics.
- **Detection reports:** range, bearing/elevation, Doppler, amplitude or signal quality, timestamp, and uncertainty.
- **Measurement quality:** confidence, error/covariance estimates, ambiguity flags, and source metadata.
- **False/missed detections:** realistic persistence, intermittent returns, and downstream consequences.

## Interactions
Detection depends on SNR/SINR, integration, target fluctuation, thresholding, and processing. A distance check is not a detection model.

## Boundary
Decides whether a measurement is reported. Persistent target identity and history belong in folder 12.
