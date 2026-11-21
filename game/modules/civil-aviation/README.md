# Civil aviation and non-combat traffic

**Owner:** game/modules/civil-aviation. **Status:** architecture only; no civil-aircraft/traffic runtime is implemented.

Own civil aircraft definitions, schedules/route plans, traffic intent and civil operating procedures. Aircraft flight physics, navigation, communications, weather, airport infrastructure, collision avoidance and rendering remain shared services.

## Scope
Represent airliners, cargo aircraft, business/general aviation and other configured civil traffic with aircraft-specific performance/weight data, flight plan, operator/registration identity, crew/passenger manifest policy, fuel reserve, departure/arrival airports, route, altitude/speed intent, communications and transponder/IFF equipment where fitted. Traffic is not a decorative looping animation; it participates in the shared airspace and collision/flight-control environment.

## Conflict and harm
Civil status is a semantic/operational identity, not an immunity flag in collision physics. Military AI should receive only its authorized identification/report picture and apply rules-of-engagement policy. An attack on a civil aircraft, misidentification, accidental engagement or deliberate use of a civilian airspace corridor creates separately recorded casualties, legal/investigative, diplomatic, public-trust and economic consequences. A civilian transponder or a missing reply is not a complete identity proof.

## Validation
Route and airport suitability; separation and conflict handling; weather/alternate/diversion; fuel reserve; transponder/report loss; military/civil traffic coexistence; identity confidence; casualty and investigation event chain; time acceleration and streamed-world persistence.
