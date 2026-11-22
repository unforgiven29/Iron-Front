# Weapon guidance source area

**Status: folder marker and design notes only. No guidance implementation code was added for this task.**

Future reusable guidance calculations belong here. Keep guidance-law logic independent of seeker hardware, missile aerodynamics, propulsion, actuator dynamics and product-specific weapon data.

Planned responsibilities include timestamped/uncertain state-estimate contracts, proportional-navigation families, command guidance, beam riding, pursuit/trajectory laws, midcourse navigation policy interfaces, bounded command generation and validity/failure reporting.

The domain owner is [physics/guidance](../../../../physics/guidance/README.md). Weapon packages compose the selected guidance method with a particular seeker, navigation source, control system and missile dynamics profile.

Never give guidance hidden access to world truth or perfect target state. Never equate a seeker cue with a lock or a guidance command with an achieved trajectory.
