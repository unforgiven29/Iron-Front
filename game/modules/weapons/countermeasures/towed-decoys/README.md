# Towed decoy product and tether dynamics

**Owner:** decoy platform/weapon definition and deployment. Tether/vehicle motion uses physics; RF/IR response is supplied by the appropriate physical owner.

A towed decoy is a physically connected moving object during deployment. Model it separately from an ejected cartridge because its geometry and kinematic relationship to the carrier matter.

## Required configuration

Define stowed/deployed state, attachment station, cable/tether length and mass, payout/retraction limits, deployment/release/jettison sequence, allowable speed/load envelope, decoy body mass/inertia/aero, power/emission source and failure behavior. Use exact product-specific data; do not assume every towed decoy is powered or retractable.

## Runtime state

Track tether payout, tension, angle, decoy position/velocity, carrier-relative motion, cable vibration/sag approximation, damage/cut state, deployment failure and decoy emissions/signature. If using a simplified tether constraint, declare it and test stability. The decoy position should not be hard-coded to an arbitrary offset when the aircraft maneuvers.

## Integration

The carrier retains the physical connection and any mass/drag load while connected. The RF receiver observes the decoy signal through normal propagation. Damage to the tether may cause a distinct cut/lost-decoy event. The decoy's emission/signature is not a precomputed seeker outcome.

## Tests

Test payout, tension/load limits, maneuvering, drag, cable cut, loss of power, carrier/decoy separation and seeker candidate association.
