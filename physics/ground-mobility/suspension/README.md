# Vehicle suspension models

**Owner:** physics/ground-mobility/suspension. Platform data supplies suspension layout, wheel/road-wheel positions, spring/damper rates, travel, stops and limits.

Calculate suspension forces from relative displacement/velocity, normal load, geometry and dynamic limits. Outputs feed vehicle rigid-body/contact; do not move the chassis directly. Include bump stops, rebound limits, damping and load transfer only at declared fidelity. Distinguish tracked bogie/road-wheel layouts from independent/dependent wheeled suspension.

Validate static ride height, step input, bump/rebound, damping response, travel stop, asymmetrical load and contact stability.
