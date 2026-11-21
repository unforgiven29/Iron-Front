# MiG-29 product 9.13 — flight-model validation plan

**Selected identity:** single-seat product 9.13. **Status:** validation plan only; no validated flight-model performance is claimed.

## Source applicability gate

The available GAF T.O. 1F-MIG29-1 is useful for one MiG-29 installation but does not establish exact product 9.13 applicability for every aerodynamic or flight-control parameter. Label every case by the actual dataset source variant. Do not report validated product 9.13 when the input data only represents another product/series/operator.

## Scenario envelope

After geometry, mass and coefficient source validation, plan:
- Symmetric static geometry and force/moment checks.
- Trimmed level flight across supported speed/altitude points.
- Climb/acceleration and twin-engine thrust response.
- Coordinated turns, roll/pitch/yaw response and sideslip.
- High-AoA/stall/recovery with the LERX/vortex model only when data supports it.
- Flap/slat and control configuration changes.
- Asymmetric store loading and release.
- Left/right engine thrust mismatch, engine damage and engine-out response.
- Main/boost hydraulic circuit degradation and resulting actual surface motion.
- Gear/ground-effect/takeoff/landing configurations.
- Surface damage and asymmetric force/moment cases.

## Outputs and acceptance

Record trim residuals, thrust and fuel flow per engine, angular rates, AoA/sideslip, load factor, control target vs actual position, surface force/moment, mass/CG/inertia, dataset validity and uncertainty. Compare only equivalent mass/configuration/atmosphere. Separate synthetic internal consistency from source-data comparison and held-out validation.

Do not tune a generic multiplier to make an unverified DCS trajectory match. Keep the unvalidated envelope clearly marked until qualified data exists.
