# Electro-optical and FLIR imaging

**Owner:** sensors/EO-FLIR. **Status:** architecture only; no detector or image-formation runtime.

Represent exact visible/near-IR/thermal imaging equipment, optics, field of view, focal length/zoom, aperture, spectral response, detector resolution/pitch/frame rate/integration time, stabilization, gimbal limits, boresight, cooling and power. Separate sensor mechanisms by band and illumination; do not silently merge IRST and FLIR.

Chain: target/background radiance or reflected illumination → optical path → aperture/lens/filter/focus → PSF/motion blur → detector sampling/noise/saturation → image processing → candidate extraction → uncertain angular/range report if supported. Physics/optics owns path; world owns obstruction; sensor owns detector/processing; renderer only presents image.

Weather, obscurants, glare, background clutter, motion, focus drift, detector noise, saturation, cooling/power loss and dirty/damaged windows degrade behavior. Validate angular pixel mapping, contrast/path behavior, weather, motion, gimbal limits, false/missed detections and browser cost.
