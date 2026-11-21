# Infrared, optical and laser homing guidance

**Owner:** physics/guidance for guidance interfaces; sensors/weapon-seeker and relevant optical/thermal sensor owners provide detections/tracks; weapon package supplies exact seeker and target-designation fit. **Status:** architecture specification only.

Do not use IR missile as a complete seeker model. Detector construction, scan/image processing, spectral response, field of regard, cooling, track logic and countermeasure discrimination must be defined independently.

## Infrared homing families

A variant selects one physically supported architecture:
- **Spin-scan reticle:** rotating reticle/modulator produces a time-varying signal used for angular tracking. Scan/reticle timing and signal-processing model matter.
- **Conical-scan:** seeker boresight or optical line of sight traces a cone; signal modulation provides angular error. Scan geometry, tracking lag and target modulation affect tracking.
- **Rosette scan:** line of sight scans a rosette-like path, sampling the scene over a wider pattern. Search/track timing and background/scene separation matter.
- **Other non-imaging scanning seekers:** single/few detector elements and optical modulation infer line-of-sight error from time-varying signal. Do not assume all older seekers use the same reticle pattern.
- **Imaging infrared (IIR):** a focal-plane array forms spatial image measurements. Processing may use contrast, centroid/shape/scene features and track history; it is not simply a hotter-pixel detector.
- **Multispectral / dual-band IR:** measurements in more than one spectral band are compared when the specific seeker supports that capability. This is a sensor spectral architecture, not a universal IRCCM switch.

Detector/cooling technology is another independent axis: cooled or uncooled detector; spectral band such as SWIR/MWIR/LWIR; detector noise/response; optics/transmission; warm-up/cool-down; power; thermal limits and saturation. Search scan type, detector class and spectral band must not be collapsed into one enum.

## IR seeker profile

Declare aperture/optics, spectral response, detector architecture, scan pattern or focal-plane mode, field of view and field of regard, gimbal limits, instantaneous field of view/pixel sampling where relevant, update rate, tracking-rate limits, noise/NETD or suitable abstract detector-quality parameter, saturation, background estimation, cooling/warm-up and power, track memory, angular measurement uncertainty and supported modes.

A **rear-aspect / all-aspect** label describes a capability under target signature/aspect/environment conditions, not an infrared detector architecture. It must be represented through the seeker/target observation model and documented envelope, not as an unconditional range multiplier.

## Semi-active laser and laser beam riding

Keep these separate:
- **Semi-active laser homing:** seeker observes laser energy reflected from an illuminated target/designated spot; it depends on designator compatibility, code/timing if applicable, path/visibility, spot geometry and return quality.
- **Laser beam riding:** receiver measures location within a projected beam/reference and steers to remain in that beam. It does not simply home on the target's reflected laser spot.

The two share optical propagation but have different geometry and guidance error signals.

## TV / EO and imaging scene seekers

Daylight TV/EO seekers use visible-band optics and image processing. IIR uses thermal-band image formation. Both may provide scene/feature/centroid tracks, but their physical inputs, weather limits and contrast mechanisms differ. A television seeker must not be simulated using IR radiance; an IIR seeker must not use rendered visible texture.

## Validation

Test scan/track timing, detector response, FOV/gimbal, tracking limits, target aspect/signature changes, background and sun/cloud/terrain effects, obscuration, saturation, cooling/power loss, multiple target candidates, flare scenes, seeker slew and track-rate limits, false detections, rejection and reacquisition. Keep all-aspect and IRCCM capabilities source-specific.
