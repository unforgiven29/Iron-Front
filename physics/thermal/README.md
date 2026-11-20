# Thermal physics

**Owner:** physics/thermal. **Status:** architecture only; no reusable heat-transfer runtime exists.

Provide generic thermal-state and heat-flow calculations for engines, electronics, radar, batteries, weapons, environment and infrared signatures. Equipment owns its heat sources, thermal nodes, limits and control logic; cooling system owns installed cooling network.

Represent thermal mass/capacitance, heat capacity, node temperature, heat generation, conductance/resistance, convection boundary, radiative exchange and coolant coupling at declared fidelity. Keep kelvin/temperature differences dimensionally correct; a temperature limit is not a health percentage.

Temperature changes may derate, disable, damage or alter radiance of equipment through explicit interfaces. A thermal sensor measures radiance after path/detector effects, not hidden node temperatures. Validate steady-state and transient balance, time constants, ambient effects, coolant loss, overheat derating, cooldown and repeatability.
