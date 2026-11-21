# Semi-active radar homing (SARH)

**Owner:** physics/guidance for guidance-law behavior; sensors/Radar and sensors/weapon-seeker own RF observation and seeker tracking; weapon and platform packages provide the illuminator/seeker installation. **Status:** architecture specification only.

SARH uses radar energy transmitted by an external illuminator and reflected by the target. The missile's receiver measures the return and guides using the resulting angular/range-rate or other available observables. The missile is not an active transmitter merely because its seeker has radar hardware.

## Split the architecture into independent choices

A SARH weapon profile identifies the illuminator source and compatibility; illumination waveform/continuous-wave or pulsed mode and permitted schedule; seeker antenna/aperture, receiver band, polarization, FOV/gimbal, scan/track method and limits; angle-tracking method and signal processing; observable set and update quality; guidance law and reference frame; external support required during flight; and lost illumination/track behavior.

A radar lock, illumination state, missile seeker track and valid guidance solution are separate states. A platform can maintain a track while the missile receiver fails to acquire the return, and an acquired missile track can be lost when illumination quality changes.

## Conventional / non-monopulse SARH

Conventional SARH is not one universal seeker. The installed angle-tracking implementation may use conical scan, sequential lobing, conical-scan variants or another documented architecture. The seeker infers angular error from received-signal variation over a scan/sequence. This creates dependencies on scan timing, signal fluctuation, target/antenna motion, receiver SNR and tracking-loop behavior.

The specific scan pattern and hardware must come from the actual missile. Do not assign a conical-scan algorithm to every older SARH missile by default.

## Monopulse SARH

Monopulse describes an angle-measurement/track architecture in which multiple comparison channels are processed from the same received pulse/echo event to estimate angular error. Common broad categories include amplitude-comparison and phase-comparison monopulse. The exact implementation and channel calibration belong to the seeker hardware profile.

Monopulse is an angle-tracking method, not a separate source of illumination and not a guarantee of chaff immunity. It can change measurement quality, tracking response and discrimination behavior, but countermeasure outcomes still depend on the actual return scene, signal quality, processing gates and target/decoy geometry.

## Guidance and failure states

SARH guidance requires a usable illuminated target return. Model illumination continuity, antenna pointing, target aspect/geometry, return quality, clutter/interference, scan/track update, receiver limits and permitted track memory. Lost illumination may cause coast, track decay, reacquisition or loss depending on the specific weapon. Do not silently convert SARH to ARH or inertial homing.

## Validation

Test correct illuminator association; illumination absent/intermittent; seeker FOV and gimbal edges; conventional scan tracking behavior; monopulse measurement noise/bias under valid and degraded returns; update latency; false/multiple returns; clutter; chaff candidate association; target/illuminator maneuver; and loss/recovery. Keep seeker tracking technology separate from the guidance law.
