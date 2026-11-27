# MiG-29 product 9.13 cockpit — reconstruction and render specification

**Implementation status: first procedural cockpit shell integrated into Three.js; not yet measured or certified 1:1.**  
**Target:** single-seat Soviet-standard MiG-29 product 9.13, configuration ID `mig29-9-13-soviet-baseline-v1`.  
**Do not silently substitute:** product 9.12 / MiG-29A, 9.13S / MiG-29S, 9.13B, 9.13SE, SMT, MiG-29K, MiG-29M or operator-modernized equipment.

This document is deliberately strict. A visually convincing cockpit is not automatically a dimensionally correct cockpit. Do not call the result 1:1 until the geometry, equipment fit, labels, locations, materials and camera registration have passed the evidence and render gates below.

## 1. Current implementation: known gaps

The runtime now has an original procedural shell in `game/src/platforms/aircraft/mig29/MiG29CockpitModel.ts`, integrated through `CockpitLayout.buildShell` and `ThreeCockpitView.loadShell()`. The current build is a first substantial geometry pass, not a measured final asset. The legacy layout in `MiG29Cockpit.ts` is still explicitly approximate:

- It derives panel positions from pixel measurements on an oblique photograph and assumes a 100 mm attitude indicator for scale. Perspective is not corrected.
- It cites Soviet-standard 9.12-family photographs; applicability to product 9.13 is not established.
- HUD, panel-wing angles, cockpit eye point, stick dimensions, throttle dimensions, side-console controls and several instrument identifications are estimated or inferred.
- The legacy instrument/control layout is still largely photo-coordinate data with estimated positions. The new procedural shell fills in much of the tub, seat, footwell, rudder pedals, sidewalls, consoles, canopy, bezels and hardware, but those assemblies remain provisional family-level geometry. Labels, wiring, many equipment-specific sub-panels, exact seat detail, and the complete control fit remain incomplete or unverified.

The shared renderer is `game/src/rendering/three/ThreeCockpitView.ts`. In addition to simple `CockpitPartKind` overlays, it now accepts an aircraft-owned `buildShell()` factory or an optional GLB/GLTF asset. The MiG-29 currently uses the procedural factory in `MiG29CockpitModel.ts`. Its material groups are merged into bounded mesh batches and the canvas exposes shell-build status and mesh count for automated tests. The click raycast deliberately excludes shell geometry; only controls represented by separate `CockpitPart` layout entries are currently interactive. Do not claim every physical switch in the shell works until each required control has a correctly positioned, tested hit target and command mapping.

**Do not "improve" this layout by inventing another set of precise-looking coordinates.** Replace provisional geometry only when the corresponding measurement or placement has traceable evidence. Keep unknowns unknown.

## 2. Variant and source discipline

### 2.1 Target configuration

The repository selects a single-seat Soviet product 9.13 baseline. Preserve that product identity in asset manifests, source records and screenshot labels. The enlarged dorsal spine is an external configuration distinction; it does not prove every interior panel or item of equipment differs from a 9.12.

The available Eagle Dynamics MiG-29 manual identifies its DCS MiG-29A as 9-12 and discusses 9-13 / MiG-29S separately. It is a useful simulator reference for general family layout and terminology, but it is **not** a complete product 9.13 production drawing set. Do not use a DCS screenshot as a dimensional authority for the selected aircraft.

### 2.2 Reference register

| Reference | What it can support | Restrictions / confidence |
|---|---|---|
| IrasD, [MiG-29 cockpit 1](https://commons.wikimedia.org/wiki/File:MiG-29_cockpit_1.jpg), [cockpit 2](https://commons.wikimedia.org/wiki/File:MiG-29_cockpit_2.jpg), [cockpit 3](https://commons.wikimedia.org/wiki/File:MiG-29_cockpit_3.jpg), [cockpit 4](https://commons.wikimedia.org/wiki/File:MiG-29_cockpit_4.jpg), circa 1995 | High-resolution visual references for panel appearance, seat/tub, consoles and spatial relationships | The files are labelled generically as MiG-29; exact product number/operator fit is not established by their captions. They are CC BY-SA/GFDL-licensed; preserve the selected license, author, file URL and attribution if copies or derivatives are stored. |
| [Eagle Dynamics MiG-29 English manual](https://www.digitalcombatsimulator.com/upload/iblock/463/DCS%20MIG-29%20Flight%20Manual%20EN.pdf) and [Russian manual](https://www.digitalcombatsimulator.ru/upload/iblock/07d/elvkcoejb1qtqxs6f8xcci26elz0rga0/DCS%20MIG-29%20Flight%20Manual%20RU.pdf) | Cockpit overview, panel groupings, instrument function and Russian nomenclature | Simulator reference; DCS MiG-29A is 9-12. The manual is not authoritative dimensional evidence for plain product 9.13. |
| GAF T.O. 1F-MIG29-1, Flight Manual, 30 Sep 1994, Change 4, 20 Sep 2001. [Publicly indexed copy](https://www.airwar.ru/other/manuals/%5Baviation%5D%20-%20%5Bmanuals%5D%20-%20MiG-29%20Flight%20Manual.pdf) | Detailed control/panel diagrams and operating descriptions. Figure 1-67A identifies front-side flare, HUD, HDD, RHAW, stick, radar-control, weapon-control and IR-volume areas; other figures document left-console flap buttons and right-console test controls. | German Air Force installation/operating reference. Its applicability to the exact Soviet product 9.13 and every fitted equipment revision must be checked. The manual itself restricts reproduction/disclosure; do not copy its pages into the game or redistribute them. Use it as a source pointer and record page/figure references. |
| [AVSIM.su archive: `РЛЭ МИГ-29`](https://www.avsim.su/f/50153-rle-mig-29/) | Archive entry describes separate flight/weapon manuals for 9-12, 9-13 and 9-13S, with drawings, diagrams and nomograms | High-priority research lead. The linked ZIP was not retrieved/inspected in this pass. Verify document title, issue/revision, exact variant and operator before using any drawing or value. Do not copy/redistribute without checking rights. |
| [ICM 1:72 MiG-29 `9-13` instruction sheet](https://agtom.eu/instrukcie/ICM/ICM72141/ICM72141.pdf) | Product-9-13 model-kit parts and assembly sequence, including cockpit/tub/seat assembly context | Scale-model representation only, not a production drawing or exact dimension authority. Useful as a low-confidence component/assembly cross-check, not for absolute dimensions. |
| [AViaDeJaVu MiG-29SD/SE cockpit key](https://aviadejavu.ru/Site/Arts/Art57176.htm) | Cross-check of panel/control families and location names | This is an SD/SE development-aircraft reference, not the target 9.13 baseline. Use only for a feature independently established as common; never import its modernization-specific panels as baseline. |
| [ICM 1:72 MiG-29 9.13 kit overview](https://aircraftinplastic.com/models/mig-29-72/mig-29-72-2.html) | External product-9.13 recognition and general airframe context | Model-kit review, not an internal cockpit dimension source. |
| Commercial MiG-29K / SMT / Polish cockpit models | Potential visual comparison only | Wrong variant/configuration or unclear data provenance; some are editorial-use-only. Do not import, convert or redistribute without an appropriate license and a documented variant match. |

### 2.3 Additional panel inventory from the DCS manual

The DCS Russian pilot manual's cockpit overview (printed pages 24–25, Figure 15) labels 22 front-panel items. The photographed plate is valuable for arranging and checking the current instrument list. It is still a **DCS simulator reference**, not a measured plain-9.13 drawing. Preserve the original abbreviations where translation or installation identity is unclear.

| Figure 15 callout | Manual's item | Reconstruction use |
|---:|---|---|
| 1 | Landing-gear control | Verify the handle's actual panel cut-out, grip shape and travel |
| 2 | Weapon-control-system panel | Distinct panel and control inventory; don't replace with a generic screen |
| 3 | Combined angle-of-attack / overload indicator | Correct dual-scale instrument, pointer and bezel |
| 4 | Signal lamp | Separate lens/bezel and state-driven illumination |
| 5 | Command flight director instrument (КПП) | Full instrument face, director bars, attitude display and slip indication |
| 6 | Vertical-speed indicator | Dedicated instrument; do not conflate with turn/slip |
| 7 | Radio altimeter | Separate scale and indication from the barometric altimeter |
| 8 | Engine RPM indicator | Twin-engine representation and exact scale/needle treatment |
| 9 | ИПВ | Retain original designation until the exact equipment/function is verified for the target configuration |
| 10 | EKRAN system panel | Panel/annunciator assembly, not an arbitrary modern MFD |
| 11 | Signal/annunciator panel | Individual lamps, legends and grouped annunciations |
| 12 | SAU control panel | Controls and state indicators, separate from the SAU simulation logic |
| 13 | Indicated-airspeed indicator | Correct units, tick spacing, pointer and instrument form |
| 14 | Barometric altimeter | Correct nested scales/counters and pressure-setting control |
| 15 | Flight/landing indicator | Gear, flap/LEF and speedbrake indication segments |
| 16 | Horizontal navigation instrument (ПНП) | Rotating compass card, course pointers and navigation bars |
| 17 | Clock | Clock/stopwatch layout and controls |
| 18 | Airspeed/Mach indicator | Separate from item 13; verify exact panel fit and scale |
| 19 | Remaining countermeasures indicator | Correct counter/display and association with the installed dispenser |
| 20 | Exhaust-gas-temperature indicators | Two separate engine instruments with individual markings |
| 21 | Fuel quantity indicator | Correct tank/quantity representation; do not copy another variant's fuel computer |
| 22 | СПО-15 «Берёза» | RWR indicator/control fit; check exact product/operator nomenclature and revision |

These 22 callouts must be reconciled against the current `MiG29Cockpit.ts` inventory. The existing layout does not yet represent every item as a measured, separate physical assembly. Do not blindly add all 22 at inferred coordinates: use the image as a relative arrangement reference, confirm exact target fit and obtain dimensions before claiming accuracy.

The English/Russian DCS manuals and the GAF T.O. also describe systems and console controls beyond this front-panel plate. Maintain separate inventories for the left console, right console, centre/floor area and seat; do not assume Figure 15 is a complete cockpit parts list.

## 2.4 Evidence labels

Every geometry/control record must carry one of these evidence states:

- `VERIFIED_9_13`: direct product 9.13 drawing, manual, measurement or confirmed aircraft-specific source.
- `COMMON_FAMILY_CORROBORATED`: multiple sources show it as common across the relevant variants, but no direct 9.13 drawing has been found.
- `PHOTO_ESTIMATE`: visually estimated from a reference image; not an exact dimension.
- `INFERRED`: deduced from neighbouring equipment or functional context.
- `UNKNOWN`: no defensible evidence.

Store source ID, document title, revision/date, page/figure or image file, variant/operator, measurement method, unit, uncertainty and a short rationale beside each value. Never silently promote an estimate to verified.

## 3. Full cockpit assembly inventory

Model the physical cockpit as an assembly of separately named objects. Do not limit the task to the front instrument face.

### A. Primary tub and airframe interfaces
- Cockpit tub floor, lower sidewalls, forward bulkhead and rear bulkhead.
- Left/right console support structure, instrument-panel mounts, brackets and visible fasteners.
- Sill lips, canopy rail channels, canopy seals and structural attachment points.
- Forward windscreen frame, canopy bow/frames, latch/locking hardware, emergency jettison interfaces and visible rails.
- Internal paint, anti-glare surfaces, edge trim, wear, stencils and inspection labels.
- Cable/pipe runs only where visible and supported by reference.

### B. Seat and restraint system
- Correct single-seat K-36-family seat configuration for the chosen product/operator baseline; exact seat subvariant remains to be sourced.
- Seat bucket, headbox, headrest, side structure, adjustment rails, cushions, harness, leg-restraint lines, buckles and visible fittings.
- Ejection handles and guards, safety pins only in the appropriate ground state, oxygen hose/connector and seat-to-airframe interfaces.
- Seat geometry must be a separate assembly with its own datum, not a generic chair placed by eye.

### C. Main instrument panel and glareshield
- Main panel structure, individual removable sub-panels, bezels, instrument cut-outs, fasteners and labels.
- Flight instrument group, navigation/heading group, combined AoA/G, engine instruments, hydraulic/pneumatic indications, fuel indications, warning/caution annunciators, clocks and standby equipment according to verified baseline fit.
- HUD projector housing, combiner glass, brackets, dimming/brightness/test controls and correct sight line.
- HDD/radar/weapon display only to the extent the selected fit supports it. Do not invent a modern MFD/glass-cockpit arrangement.
- Each gauge must have the correct shape, bezel depth, glass, dial face, markings, pointer count, pointer pivot and lighting. Do not use a generic circular dial with a substituted label.

### D. Left console and left sidewall
- Throttle quadrant and each lever/grip/button/trigger as separate parts where the real assembly separates them.
- Engine-start and engine-control areas, radio/navigation controls and lighting controls as confirmed for the target fit.
- Flap/LEF controls, landing-gear control, emergency gear extension, emergency brake and other documented controls in their real panel locations.
- Sidewall trim, handles, wiring conduits and visible equipment cases.

### E. Right console and right sidewall
- Radar/weapon-control and optical-system controls.
- RWR indicator/control assembly and its actual fitted variant; do not assume every source's SPO-15 / Beryoza nomenclature describes the same hardware revision.
- Aircraft systems, warning/test, engine/intake, electrical and auxiliary panels as verified.
- Radio/navigation equipment, countermeasure controls and other operator-specific hardware only if part of the selected baseline.

### F. Centre area, floor and pilot controls
- Control stick base/boot, shaft, grip, trigger, weapon-release and trim/hat controls; use the correct grip geometry and button positions.
- Rudder pedals, toe-brake surfaces, linkages and adjustment rails.
- Footwells, heel plates, floor panels, floor fasteners, cable covers and drain/inspection features.
- Any centre pedestal or panel between the pilot's legs must be derived from evidence, not borrowed from an F-16 or generic fighter.

### G. Canopy, sight line and lighting
- Canopy transparency, curvature, framing, locks, hinges/actuators, rails and seals.
- HUD combiner position and tilt; pilot eye reference point; instrument readability and obstruction envelope.
- Flood/instrument/console lighting, warning lamps, dimmers, backlighting and night-light colour only where confirmed.
- Correct reflections and transparency without the canopy or HUD becoming opaque, disappearing or double-rendering.

This inventory is a coverage checklist, not permission to place undocumented equipment. Each item remains evidence-labelled.

## 4. Dimensional reconstruction procedure

1. Freeze a single configuration record before modelling: product 9.13, single-seat, operator/date baseline, equipment fit and external/internal changes. Record unresolved fields.
2. Build a source contact sheet from legally usable photographs. Record original resolution, crop, camera/view direction, image corrections and known lens/perspective distortion. Keep untouched originals.
3. Find orthographic drawings or measured dimensions for the cockpit opening, panel mounting datum, canopy rails, seat rails, floor and instrument-panel frame. A perspective photo cannot establish absolute dimensions by itself.
4. Define one aircraft datum and convert all cockpit dimensions to metres. Record the transformation from aircraft body coordinates to the Three.js cockpit eye frame.
5. Establish a measured pilot eye point from the seat adjustment datum and cockpit geometry. Do not preserve the current `eyeFromCgM: [4.9, 0, -1.15]` merely because it renders.
6. Reconstruct the tub and canopy first, then the seat and major panel assemblies, then each control/instrument assembly. Keep major geometry and equipment fit in separate collections.
7. Use multiple views to solve camera/perspective. Do not infer depth from a single image. Triangulate control/panel placement from at least two independent views or a dimensioned drawing.
8. Add high-detail textures only after geometry and labels are verified. Raster photographs may guide authoring; do not use a photograph as a flat texture to disguise incorrect geometry.
9. Export a browser-ready GLB with real-world metre scale, named nodes, compact PBR materials, correct normals/tangents, no hidden duplicate geometry and a reproducible export manifest.

## 5. Asset and coordinate contract

Current procedural source:

`game/src/platforms/aircraft/mig29/MiG29CockpitModel.ts`

Current integration:

`game/src/platforms/aircraft/mig29/MiG29Cockpit.ts` → `CockpitLayout.buildShell` → `ThreeCockpitView`.

The eventual model may be moved to an authored GLB if that improves measured geometry/detail and supports named animated nodes; this is not a prerequisite for the current browser runtime. A GLB conversion or replacement still needs a manifest with: asset ID/version; target variant/operator; source IDs; author; creation tool/version; license and redistribution rights; SHA-256; real-world dimensions; unit; local axes/handedness; origin/pivot; cockpit eye datum; material/texture inventory; named node inventory; animation names; clickable node IDs; LODs; and export settings.

Coordinate integration:
- Keep the aircraft simulation convention documented in the existing project: body frame is FRD (forward, right, down), with metres.
- glTF is +Y up; write and test one explicit glTF-to-aircraft transform. Do not compensate for a wrong transform with scattered per-part offsets.
- The cockpit model must be registered to an aircraft datum (not scaled by an arbitrary visual guess). Verify the origin and bounding box against measured fuselage/cockpit dimensions.
- The asset is presentation geometry only. It must not become collision, mass, inertia, visibility or sensor truth without separate validated data.

### Interactive nodes

Use stable, unique node names and IDs. Every interactive control needs a declared type, allowed detents/axis, owning subsystem command, feedback source and failure/power behavior. No click target may directly edit aircraft simulation state. Use a deliberate solution for detailed shell control hit-testing: renderer-recognized node metadata or transparent hit volumes tested in the actual cockpit camera. The current procedural shell is non-interactive by design; only controls with explicit overlay parts and bindings are clickable.

### Materials

Use a consistent physically based material workflow. Separate painted metal, anodized/black panel finish, rubber, glass, transparent HUD combiner, painted legends, luminous warning lenses and bare/worn metal. Create decals/labels as readable geometry or texture atlases at the correct physical size. Do not apply one generic grey material to every surface.

## 6. Render and visual validation gates

A correct source asset can still render incorrectly. Run all of the following in the actual Vite/Three.js application and on the deployed GitHub Pages URL.

### Asset-load gates
- No procedural shell build errors or missing external GLB/buffer/texture/font/relative-path requests on the Pages base path.
- No missing materials, broken UVs, invalid normals, non-finite transforms, transparent sorting problems or console/WebGL errors.
- Confirm all expected meshes and textures load; report load failure visibly rather than silently substituting an empty cockpit.
- Confirm cleanup/disposal and repeated entry/exit do not leak GPU resources.
- Test current stable Firefox and Chromium desktop builds; also test the project's supported mobile fallback.

### Camera and geometry gates
- Capture reference-matched head-on, pilot-eye, overhead, left-console, right-console, and side/seat views.
- Align camera position, focal length/FOV and image crop before comparing against photos; otherwise a perspective mismatch can be mistaken for a model error.
- Compare silhouette, panel boundaries, instrument centres, seat profile, console slopes, canopy bow, footwell and control spacing against references.
- Verify physical scale from documented dimensions. Where dimensions are unavailable, report a bounded estimate and leave that feature unverified.
- No floating objects, intersections, z-fighting, face reversal, panel clipping, incorrect occlusion, control overlap or instruments hidden by the glare shield.
- From the pilot eye point, all gauges/readouts must be visible at realistic head position; do not widen FOV just to hide wrong geometry.

### Functional gates
- Every clickable control has a unique hit area, correct cursor/selection feedback and correct typed command.
- Test each detent and the return-to-rest/guard behaviour. Control meshes and visible state must animate together.
- Instruments display correct live values, units, scale and invalid/power-off state from aircraft snapshots.
- HUD and HDD are separate optical/viewing surfaces with correct placement, transparency and display ownership.
- Power loss, faults, damage and failed displays must not leave misleading "always-on" graphics.

### Evidence gates for the 1:1 claim
- All primary dimensions and all high-salience placements have a traceable direct or independently corroborated source.
- Variant/operator fit is resolved for every major panel and instrument. No modernization parts have slipped into the selected baseline.
- Unresolved geometry/equipment is listed explicitly; no undocumented filler parts are allowed.
- Source-to-model comparison board and dimension report are committed with the asset.
- A reviewer can reproduce the render captures from a documented command.
- Only after those gates pass may the asset be described as "1:1 within the documented measurement tolerances." Until then use "high-detail reconstruction; partial measurements" or "provisional."

## 7. Required delivery files

- `game/src/platforms/aircraft/mig29/MiG29CockpitModel.ts` — current material-batched procedural shell. Replace/extend from measured data; do not treat the current source as a final 1:1 model.
- If a measured authored GLB supersedes the procedural source: a GLB plus an adjacent manifest with scale, axes, variant, provenance, license, node and texture inventory.
- `assets/cockpit/source-register.json` — page/figure/photo references and evidence labels.
- `assets/cockpit/measurement-report.md` — measured dimensions, datums, uncertainty and unresolved values.
- `assets/cockpit/validation/` — repeatable screenshots, comparison overlays and visual QA checklist.
- Updated `MiG29Cockpit.ts` — aircraft-specific component placement, bindings and eye datum; remove obsolete pixel-derived coordinates when replacement measurements exist.
- Updated `CockpitLayout.ts` and `ThreeCockpitView.ts` shell-factory/load-diagnostics support.
- Unit tests for finite geometry, dimensions and mesh inventory, plus browser tests covering shell construction, camera visibility, control hit-testing and visible instruments.

## 8. Immediate no-shortcuts rule

Do not use a paid/editorial-only cockpit model, a MiG-29K/SMT model, or an unlicensed DCS/third-party extraction as the final asset. Do not label a model "product 9.13" solely because it resembles a Fulcrum. If the exact 9.13 dimensions or installation cannot be found, stop and record the gap rather than fabricate precision.

The present repository has useful family-level cockpit photographs and system references, but **does not yet contain enough confirmed product 9.13 dimensional evidence to truthfully certify a 1:1 cockpit**. A complete asset requires the missing measured data as well as the 3D work.
