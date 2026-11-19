# Aerodynamics — PFM Surface Model

**Empty source placeholders. No aerodynamic solver is implemented yet.**

This subsystem owns aircraft geometry and aerodynamic force/moment generation. It does not own 6-DoF integration, global weather or engine thermodynamics.

Planned architecture:
- **Geometry:** aircraft reference frames, wings, panels/strips, tails, fins, control surfaces and aerodynamic stations.
- **Local flow:** surface-local velocity, angular-rate effects, AoA/sideslip, dynamic pressure and induced flow.
- **Coefficient data:** aircraft-specific lift/drag/moment maps, stability/control derivatives, Mach/AoA/configuration ranges, interpolation, uncertainty and provenance.
- **Loads:** lift, profile/induced/wave drag, pitching/rolling/yawing moments and force application points.
- **Flow interaction:** downwash, sidewash, wing/tail interference, vortex effects, propwash/jet interaction where appropriate.
- **Nonlinear behavior:** stall, separation, post-stall response, dynamic lag/hysteresis and high-AoA behavior where supported.
- **Configuration:** flaps/slats, speed brakes, stores, fuel state, icing and damage effects.
- **Validation:** trim, coefficient comparisons, stability, maneuvers, stall and regression cases.

Every surface must use its own local air sample; one aircraft-wide AoA/q value is insufficient. Use aircraft-specific data and explicit validity envelopes. Do not approximate the entire aircraft with one lift curve or arbitrary multipliers. See [PFM architecture](../../docs/flight-model/README.md).
