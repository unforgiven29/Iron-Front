# Infantry casualty care, combat medics and evacuation

**Owner:** game/modules/infantry/medical-support. **Status:** architecture only; no medical/medevac runtime exists.

Own tactical first-aid, medic tasks, casualty triage and evacuation orchestration. Individual injury physiology belongs to the infantry/person model; crew/campaign personnel histories and logistics own persistent records and medical resources.

## Individual condition
Where supported by evidence and chosen fidelity, injuries are tracked by body region (head, torso, each arm and leg), injury mechanism/severity, bleeding rate, blood-loss state, pain/shock, consciousness, mobility, weapon-handling impairment and treatment history. Do not replace this with one health bar when the selected model needs anatomical outcomes. Avoid unsupported clinical precision; gameplay parameters must be explicitly tuned and never described as medical prediction.

## Treatment and evacuation
First aid consumes time, supplies, patient access and medic capability. Tourniquet, pressure dressing/bandage, airway/other treatment actions are separate tools with applicability limits. A medic must receive a report or observe the casualty, navigate to them, assess/treat and request evacuation; no magical squad-wide healing. Evacuation requires a reachable pickup/landing point, available vehicle/crew, capacity, route and risk. Medevac can be by ground ambulance, APC/IFV, helicopter or other configured transport.

## Consequences
Wounds can lead to return to duty, temporary unavailability, medical withdrawal, evacuation, death or unresolved status. Keep event time and confidence; a casualty not found is missing, not automatically dead. Treatment, evacuation and survivor status flow into the campaign personnel record. Civilian medical facilities and humanitarian capacity are separate from military casualty treatment.

## Validation
Bleeding progression and treatment bounds; limb injury/mobility; medic casualty risk; supplies/time; blocked pickup and landing zone; vehicle capacity; evacuation interruption; duplicate care prevention; patient status reconciliation; save/replay and clear uncertainty labels.
