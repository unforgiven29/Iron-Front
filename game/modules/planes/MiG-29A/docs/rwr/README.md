# MiG-29 Product 9.13 — Beryoza RWR

## Designation caveat — not yet resolved

The DCS English MiG-29 manual names the warning receiver **L006LM "Berjoza"**. Other simulator/secondary references commonly call the equipment **SPO-15 / SPO-15LM Beryoza**. Public sources located so far do not conclusively establish the exact suffix/revision for every plain product 9.13 installation.

Use provisional profile ID `beryoza-9-13-provisional`. Do not hard-code L006LM or SPO-15LM as a settled historical designation until a product-9.13 primary technical description or operator manual confirms it.

Model only supported observables: received RF, sector/azimuth indications, coarse emitter-type recognition, priority, lamps/audio/BIT, finite receiver capacity, missed/overlapping pulses, unknown emitters, track aging and installation/antenna limitations. RWR uses the shared RF environment and shared RWR engine; it never reads N019 tracks, lock state or missile state. Bearing does not magically provide range. MAWS remains separate.

Before freezing the equipment profile, confirm designation/revision, antenna positions, channel arrangement, display panel, BIT, own-radar interlock, Gardenyia interaction, frequency coverage and receiver limits. Unknown values remain unknown.

Sources: [Eagle Dynamics MiG-29 Flight Manual](https://www.digitalcombatsimulator.com/upload/iblock/463/DCS%20MIG-29%20Flight%20Manual%20EN.pdf) (calls system L006LM "Berjoza"); [DCS SPO-15 development article](https://www.digitalcombatsimulator.com/en/news/2025-07-12/) (simulation methodology, not historical fit proof); [shared RWR architecture](../../../../../sensors/RWR/README.md); [RWR validation standard](../../../../../docs/sensors/RWR_VALIDATION_AND_DATA_STANDARD.md).
