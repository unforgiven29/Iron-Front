# Campaign intelligence, information warfare and deception

**Owner:** game/modules/campaign/intelligence. **Status:** architecture only; no campaign intelligence/information-warfare runtime exists.

Own strategic intelligence estimates and public information effects. Sensors own tactical observations; communications own delivery/interference; campaign intelligence correlates, assesses and reports information to authorized institutions. It must never expose hidden world truth.

## Intelligence picture
Maintain country/front/facility/formation estimates with source, collection time, delivery time, confidence, uncertainty, age, corroboration, contradiction and known deception risk. Separate observation, report, assessment and confirmed event. A stale intercept or an unverified strike claim cannot silently become a precise target coordinate.

## Signals and information security
Represent communications security posture and signals-intelligence capacity at a game/simulation level. Intercepts may reveal a planned operation only when collection, access, timing and decryption/interpretation assumptions permit; a warning is a probabilistic report, not guaranteed perfect foreknowledge. A side that suspects compromise may change security policy at the cost of delay, capacity or coordination.

Jamming/navigation interference is simulated at the physical communication/navigation layer. This campaign module consumes the resulting delivery/availability events and may affect intelligence confidence; it does not implement RF propagation or change all drones/weapons by one global scalar.

## Deception and camouflage
Represent dummy sites/decoy equipment, camouflage, concealment, feints and false/misleading reports as distinct sources of estimation error. Deception changes what an opponent believes; it does not create physical units or rewrite actual strength. Detection/exposure depends on available reconnaissance and time.

## Claims, propaganda and public alerts
A claim stores truth status (for example confirmed, partly supported, disputed, misleading, false or unverified), alleged source, actual source when known, evidence, audience, publication time and correction history. Public alerts can create panic and erode trust when false, but an alert alone never authorizes escalation; leaders require independent verification and an explicit policy path.

## Validation
Observation/report/assessment separation; stale and contradictory data; collection limits; deception exposure; no hidden-truth leakage; correction lifecycle; public trust effects; deterministic event replay.
