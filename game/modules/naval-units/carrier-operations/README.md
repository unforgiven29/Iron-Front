# Carrier flight-deck and aircraft handling operations

Own carrier-specific operating procedures and deck equipment state: parking/spot positions, taxi routing, deck occupancy, launch/recovery windows, catapult/arresting equipment, barriers, elevators, deck crew tasks, tie-down/service and cycle management. Carrier module coordinates operations; aircraft module owns aircraft systems/flight; ship/platform and physics own deck motion/forces.

Aircraft readiness requires actual service/resource state and crew/maintenance conditions. Launch requires clear path, aircraft configuration, catapult/launch equipment readiness and authorized command. Recovery requires correct approach/landing state, deck availability, arresting gear/barrier state and handling logic. Do not teleport aircraft to spots or declare launch/recovery successful visually.

Validate deck conflict, aircraft spot occupancy, elevator, launch abort/failure, arresting gear failure, bolter/missed recovery, moving deck approximation, damage, weather constraints and save/replay.
