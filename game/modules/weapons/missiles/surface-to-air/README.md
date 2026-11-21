# Surface-to-air missile variants

**Owner:** SAM/MANPADS product definition. Ground air-defence packages own the radar/EO director, command network, launcher, crew, power/cooling and reload. Shared propulsion/ballistics/guidance/seeker owners execute the missile. **Status:** architecture specification.

## Guidance families

A SAM variant may be command-guided, radar beam-riding, SARH, ARH, IR homing, semi-active laser or another documented combination. MANPADS may use scanning IR or imaging/multispectral seekers depending on exact variant. Do not classify every SAM by only "radar" or "IR."

Separate the surveillance/search radar, tracking/illumination director, launch-control system and missile seeker. A search radar's detection is not a launch-quality track; a director track is not missile seeker acquisition; a missile's terminal acquisition is not a guaranteed hit.

## Remote track and command input

Target state enters through a local director or allowed command/datalink update. Each observation has age, source, uncertainty and quality. Loss of search radar, tracking radar, command link, illuminator or missile seeker has different consequences depending on the installed architecture.

## Platform installation

Ground unit records launcher type, number of rails, allowed missiles, reload inventory, elevation/azimuth limits, stabilization, power/cooling, director interface, crew readiness and mobility. Keep missile package separate from the launcher/ground unit.

## Validation

Test surveillance-to-track handoff; launcher readiness; launch-zone/safe envelope; command or illumination loss; seeker acquisition; terrain/low-altitude conditions; chaff/flare/ECM interaction; guidance and motor failure; fuze/warhead; reload and damage; and no campaign-truth bypass.
