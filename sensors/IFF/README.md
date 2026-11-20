# Identification Friend or Foe (IFF)

**Owner:** sensors/IFF. **Status:** architecture only; no interrogation/reply runtime.

Model compatible interrogation/reply transactions using fitted equipment, supported modes, timing, configuration and authentication policy. Chain: interrogator ready → request emitted → path/reception → transponder eligibility/mode → reply generation → return path → validation → identity/status assessment.

A valid reply supports only the identity claim allowed by that protocol/configuration. No reply does not prove hostile: equipment may be absent, damaged, disabled, out of coverage or masked. Preserve mode, source, timestamp and uncertainty. Do not copy faction/campaign truth into response. Do not invent real secure keys or claim classified cryptography.

Test compatible/incompatible modes, absent/delayed/overlapping replies, garble, wrong code, stale response, transponder/power fault and ambiguous identity.
