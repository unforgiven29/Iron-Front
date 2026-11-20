# Bomb and glide-weapon definitions

Own exact body mass/geometry/inertia, drag data, fin/control surfaces, seeker/guidance fit if present, release envelope, fuze/arming/delay, warhead and launcher/station compatibility. Carrier platform supplies hardpoint transforms, release command and aircraft mass/drag effects.

Free-fall trajectory comes from shared ballistics and environment. Guided glide behavior uses explicit sensors/navigation/guidance and has uncertainty/limits; never use a perfect target coordinate. Distinguish impact, fuze function, dud, dud-safe, airburst and delayed detonation states only where supported.

Validate release separation/initial velocity, wind/density effects, drag envelope, guidance limits, fuze safety, impact and store removal mass/CG/drag.
