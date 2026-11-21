# Campaign personnel, service records and casualty accounting

**Owner:** game/modules/campaign/personnel. **Status:** architecture only; no persistent campaign personnel/casualty ledger exists.

Own persistent people, service histories and campaign-level casualty/fate records. Tactical crew/infantry state lives with game/systems/crew and game/modules/infantry; this module records committed personnel outcomes without taking over their live injury simulation.

## Identity and roster
Use stable identities for pilots, aircrew, soldiers, ship crews, commanders and other named campaign personnel where gameplay requires a continuing record. Link people to unit, squadron, formation, mission, sortie, station, time and status history. A player character's service record is a person record, not the same thing as the current aircraft or a UI profile.

## Fate and uncertainty
Support active, resting, wounded, medically withdrawn, missing, rescued, captured, exchanged, returned to duty and killed states with event provenance. Ejection/rescue/capture, CSAR, POW holding, exchange, escape and repatriation are explicit event chains. Do not equate loss of a vehicle with the death of every occupant unless the evidence/rule justifies it.

Ground casualty estimates derived from vehicle losses must remain marked ESTIMATED and disclose the rule. Confirmed individual outcomes remain separate from aggregate estimates. Civilian population records use society's population model and link to casualty events where evidence permits.

## Service and remembrance
Record sorties, units served, qualifications, training, injuries, captures, awards and disciplinary/investigative outcomes without making medals erase the cost of war. War histories, casualty rolls, memorials, cemetery/archive entries and post-war epilogues are projections from the event and personnel records, not duplicate ledgers.

## Validation
Unique identity; status transition legality; occupant accounting; rescue/capture delays; missing-person resolution; prisoner exchange; aggregate-versus-confirmed separation; archive pagination; save/migration and replay.
