# Weapon seeker profile index

**Owner:** weapon-specific seeker profile data. Runtime observation/track processing lives in sensors/weapon-seeker, and physical RF/IR/optical models live in their canonical sensor/physics owners. **Status:** architecture/profile specification; no weapon seeker runtime exists.

## Choose only the relevant profile family

- [Radar seekers](radar.md): active radar and semi-active radar installations, illumination dependency, antenna/receiver, search and measurement methods.
- [Infrared seekers](infrared.md): spin-scan, conical-scan, rosette, other scanning, IIR, multispectral and detector/cooling axes.
- [Optical, laser and passive-RF seekers](optical-laser-passive-rf.md): EO/TV, imaging, semi-active laser, laser beam-reference receivers and passive RF.

## Seeker profile minimum

A seeker profile declares stable product/component ID; exact weapon/variant/software fit; physical sensing family; aperture/antenna/optics; spectral or RF band/polarization; scan/image pattern; FOV/field of regard and gimbal limits; receiver/detector response/noise/dynamic range; measurement types and uncertainty; search/acquisition/track gates; update/revisit/frame rate; scan/tracking rate; supported modes; power/cooling/warm-up; environmental limits; track memory; damage/failure states; discrimination capabilities supported by evidence; and source/provenance.

Do not use rear-aspect/all-aspect, IRCCM, monopulse, LOAL or home-on-jam as a substitute for the actual sensor architecture. They describe capabilities, modes or measurement methods on different axes.

## Required state separation

Cue state ≠ seeker search state ≠ detection candidate ≠ acquired track ≠ valid guidance solution. A weapon can receive a cue but fail to find a candidate; detect multiple candidates but reject them; track a target but exceed gimbal/rate limits; or have a valid track but insufficient control authority.

## Runtime susceptibility rule

A qualitative chaff/flare rating may be retained only as a sourced reference annotation. Runtime decision must use dynamic inputs and candidate association outputs in sensors/weapon-seeker/countermeasure-discrimination. Do not add a single scalar susceptibility or flare-immunity parameter.
