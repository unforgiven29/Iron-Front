# Artillery platform modules

Own exact artillery system configuration: tube/launcher geometry, traverse/elevation limits, recoil mechanism, platform mobility, crew stations, ammunition handling/storage, fire-control interface, communications, power/hydraulic needs, damage zones and source data.

Fire missions consume target reports with coordinate frame, source, age and uncertainty. Fire-control may calculate an estimated solution; it must not read exact hidden target position. Ammunition type, fuze, propellant/charge, barrel state and weather influence supported trajectory data. Shared ballistics computes projectile path; weapon and damage services own impact/effect.

Model setup/deployment time, traverse/elevation slew, reload, barrel heat/wear where supported and counter-battery/relocation orders. Validate firing solution under coordinate error, range/charge limits, terrain clearance, dispersion, reload, recoil stability, barrel/crew damage, ammunition accounting and deterministic mission replay.
