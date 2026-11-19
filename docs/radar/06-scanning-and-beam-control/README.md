# 06 — Scanning and Beam Control

## Purpose
Define how a radar chooses pointing direction over time and allocates finite beam, dwell, and hardware resources.

## Categories
- **Mechanical scan patterns:** circular, sector, raster, conical, track scan, and equipment-specific patterns.
- **Electronic scan patterns:** azimuth/elevation steering, sector limits, scan volume, and repositioning behavior.
- **Search volume:** azimuth/elevation limits, elevation bars, range gates, and field-of-regard.
- **Beam steering:** commanded direction, stabilization, scan loss, pointing error, and steering limits.
- **Dwell management:** observation time and the sensitivity-versus-coverage trade-off.
- **Revisit scheduling:** revisit interval, track updates, search coverage, priority, and missed opportunities.
- **Track support:** allocating updates to established tracks without unlimited attention.
- **Multifunction scheduling:** interleaving search, track, mapping, weather, and other supported tasks.
- **Resource conflicts:** finite time, power, cooling, processing channels, and transmit/receive constraints.
- **Platform stabilization:** aircraft attitude, angular motion, gimbal stabilization, and navigation quality.

## Interactions
Finite resources create realistic gaps, revisit times, and competing priorities. The radar cannot observe every direction continuously.

## Boundary
Determines where and when the radar observes. It does not decide whether a return is a detection or create a track.
