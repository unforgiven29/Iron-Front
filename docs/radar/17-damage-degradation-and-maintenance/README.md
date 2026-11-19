# 17 — Damage, Degradation, and Maintenance

## Purpose
Describe how wear, faults, battle damage, environmental stress, and maintenance change radar performance over time.

## Categories
- **Antenna damage:** aperture damage, misalignment, radome effects, and degraded patterns.
- **Array element failures:** failed/drifting T/R modules, element faults, and changed beam patterns.
- **Mechanical failures:** drive wear, jammed axes, stabilization problems, and scan-rate degradation.
- **Transmitter degradation:** reduced output, unstable frequency, thermal derating, and intermittent faults.
- **Receiver degradation:** increased noise figure, gain problems, channel failure, and saturation faults.
- **Cooling/power faults:** overheating, power instability, load shedding, and protective shutdown.
- **Calibration drift:** phase, amplitude, timing, alignment, and boresight errors.
- **Environmental wear:** vibration, temperature cycling, moisture, and other modeled stresses.
- **BIT/fault isolation:** detected faults, ambiguous diagnostics, and degraded modes.
- **Maintenance/repair:** inspection, component replacement, calibration, repair time, and spare parts.

## Interactions
Damage should have localized consequences where possible. A failed array module should affect array performance rather than necessarily destroying every radar function.

## Boundary
Owns health, failure, and repair behavior. Baseline component physics belong to hardware and antenna folders.
