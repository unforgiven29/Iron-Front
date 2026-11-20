# Behind-armour effects

**Owner:** physics/armour/behind-armour-effects. Convert residual projectile/spall/blast effects into structured damage inputs. Platform damage maps identify components/zones; crew system owns injury/incapacitation; campaign owns casualty history.

Inputs include impact location, penetration/residual energy, fragment field, direction, interior layout and uncertainty. Outputs identify affected volume/location, effect type, severity range and confidence. Do not produce guaranteed kills or mutate platform health directly.

Validate residual energy routing, fragment intersection, compartment boundaries, component susceptibility data, uncertainty and isolation of unrelated zones.
