# Validation, datasets and open engineering tools

**Read with:** `docs/testing-and-validation/README.md`, `docs/implementation-roadmap/README.md`, the subsystem's acceptance suite and the relevant physics/sensor owner.

## Open-source implementation references

### 1. Project Chrono

- [Project Chrono overview and license](https://projectchrono.org/)
- [Chrono::Vehicle overview](https://api.projectchrono.org/9.0.0/vehicle_overview.html)
- [Chrono terrain documentation](https://api.projectchrono.org/8.0.0/vehicle_terrain.html)

Use for study of modular rigid-body/contact, vehicle subsystem composition, tracked/wheeled mobility and terrain interaction. Chrono is C++ and its detailed models may be too heavy for browser execution. Inspect the current repository license and version before reusing any code; do not copy code without preserving required notices and attribution. A design reference is not automatically a browser-compatible dependency.

### 2. JSBSim — flight-dynamics software reference

- [JSBSim reference manual](https://jsbsim-team.github.io/jsbsim-reference-manual/)
- [JSBSim source repository](https://github.com/JSBSim-Team/jsbsim)

Use the programmer/formulation manual and the data-driven aircraft model organization to study 6-DoF flight dynamics, aircraft-specific controls, propulsion, gear, logging and configuration. It is C++ and LGPL, so license review is mandatory before code reuse. Included aircraft data are published approximations for educational/entertainment use, not authoritative real-aircraft data. It is an architecture/testing reference, not a drop-in web dependency.

## 3. Digital DATCOM

- [NTIS Digital DATCOM manual record](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/ADA086557.xhtml)
- [Reference bibliography](https://www.pdas.com/datcomrefs.html)

Use to understand semi-empirical stability/aerodynamic estimation and legacy workflow. Do not present generated estimates as measured aircraft data or assume the tool covers the full nonlinear flight envelope.

### 4. MIT Lincoln Laboratory radar courseware

- [Introduction to Radar Systems](https://www.ll.mit.edu/outreach/web-based-course-radar-introduction-radar-systems)
- [Graduate Radar Systems Engineering](https://www.ll.mit.edu/outreach/web-based-course-radar-graduate-level)

Use as a structured learning/testing reference for the complete RF signal chain. Courseware is not equipment-specific performance data.

### 5. RIT DIRSIG

- [Reference documentation](https://dirsig.cis.rit.edu/docs/new/)
- [Validation studies and feature handbooks](https://dirsig.cis.rit.edu/docs/new/index.html)

Use for scene-based optical/thermal imaging and selected radar/SAR scene modeling concepts. Read the validation results and known limitations before comparing outputs. DIRSIG is not an all-purpose replacement for the project's own sensor models.

## Validation data policy

For each model, maintain separate:
- **calibration/training data:** used to estimate model parameters;
- **validation data:** held out from tuning and used to assess predictive error;
- **regression fixtures:** deterministic inputs/outputs that stop accidental behavior changes;
- **synthetic fixtures:** designed to test a mechanism or edge case, explicitly not real-world calibration;
- **operational scenario tests:** coupled multi-system cases that validate the full causal chain.

Record initial state, environment, version, time step, seed, configuration, source data, outputs and error metrics. Compare time series after unit/frame/time normalization. Report bias, RMS, maximum/percentile error and confidence/validity. Never silently retune against the same data used to claim validation.

## Browser-performance research

The project targets a client-side browser runtime. Claude should profile actual workloads before selecting a high-detail method:
- entity counts and active simulation bubbles;
- number of aerodynamic elements, vehicle contacts and terrain queries;
- sensor emission/beam/dwell/measurement counts;
- event queue size and scheduling frequency;
- memory allocations, garbage collection and retained history;
- renderer and physics cost measured separately;
- worker/transfer overhead if workers are introduced;
- load/save and deterministic replay cost.

Use multi-rate updates, spatial indexes, coarse/fine simulation regions and explicit fidelity tiers only when they preserve causal behavior and are validated. Do not turn off physics, detection, damage or AI accuracy in response to frame-rate drops without an explicit mode change recorded in diagnostics.

## Licensing and distribution

- Verify the current license of any code library before importing it.
- Treat manuals and books as reference material, not content to copy.
- Do not commit complete external PDFs or image collections unless redistribution is permitted.
- Prefer linking to the issuing source and recording metadata.
- Public availability is not always permission to redistribute; check document distribution statements and license terms.
