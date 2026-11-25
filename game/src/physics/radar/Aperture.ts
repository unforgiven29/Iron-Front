/**
 * Circular reflector / planar aperture with a parabolic-on-pedestal-free (1 − r²)^p illumination
 * taper (owner: physics/radar). Everything the antenna does is derived from its physical
 * description — diameter, wavelength and taper — not entered by hand:
 *
 *   field pattern  F(u) = Λ_{p+1}(u),  Λ_n(u) = n!·(2/u)^n·J_n(u),  u = π·D·sinθ / λ
 *   beamwidth      half-power angle solved from F(u)² = 0.5
 *   efficiency     η = (2p + 1)/(p + 1)²  (uniform = 1, p=1 → 0.75, p=2 → 0.556)
 *   gain           G = η·(π·D/λ)²
 *
 * (Silver, "Microwave Antenna Theory and Design", 1949, §6.6; Hansen, "Phased Array Antennas" —
 * standard aperture theory.) Not modelled: feed blockage, spillover, surface error (Ruze),
 * radome loss and boresight error. Those enter the radar's loss budget as stated numbers.
 */

/** Bessel function of the first kind J_n(x), integer n ≥ 0, by Simpson integration of Bessel's integral. */
export function besselJ(n: number, x: number): number {
  const N = 200, h = Math.PI / N;
  let s = 0;
  for (let k = 0; k <= N; k++) {
    const t = k * h;
    const w = k === 0 || k === N ? 1 : k % 2 ? 4 : 2;
    s += w * Math.cos(n * t - x * Math.sin(t));
  }
  return (s * h) / 3 / Math.PI;
}

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

/** Normalised field pattern of a (1 − r²)^p tapered circular aperture. */
export function taperedFieldPattern(p: number, u: number): number {
  if (Math.abs(u) < 1e-6) return 1;
  const n = p + 1;
  return factorial(n) * (2 / u) ** n * besselJ(n, u);
}

export interface ApertureSpec {
  /** Aperture width (horizontal, azimuth plane), m. */
  readonly diameterM: number;
  /**
   * Aperture height (vertical, elevation plane), m, when the radiating aperture is not round — e.g.
   * a twist-Cassegrain that uses only the lower part of its paraboloid. Defaults to `diameterM`.
   */
  readonly heightM?: number;
  /** Illumination taper exponent p in (1 − r²)^p: 0 = uniform, larger = lower sidelobes, wider beam. */
  readonly taperExponent: 0 | 1 | 2 | 3;
  /** Floor on far sidelobes from surface errors and scattering, dB below peak (one-way). */
  readonly farSidelobeFloorDb: number;
  /**
   * Blockage in front of the aperture (feed, support, polarising grid), as an equivalent circular
   * obstruction of this diameter at the aperture centre, m. Its field is subtracted from the
   * aperture's, which lowers the peak and RAISES the near sidelobes, as on real reflectors.
   */
  readonly blockageDiameterM?: number;
  /** Transmitted polarisation (affects ground clutter reflectivity). */
  readonly polarization?: "horizontal" | "vertical";
  /**
   * How the beam is steered. "gimbal": the whole antenna turns, the pattern is the same at every angle.
   * "flat-mirror": twist-Cassegrain — a flat polarisation-twisting mirror turns and the beam moves
   * TWICE the mirror angle; the mirror's projected area falls as cos(mirror angle), so the beam widens
   * and gain falls as it is steered off the axis.
   */
  readonly steering?: "gimbal" | "flat-mirror";
  /**
   * Measured directivity (linear) when published. Real antennas lose gain to feed spillover,
   * blockage, polarisation twist and ohmic loss, and transmit/receive paths can differ (e.g. a
   * monopulse receive feed). When given, these replace the ideal-aperture gain on boresight; the
   * pattern SHAPE still comes from the geometry.
   */
  readonly directivity?: { readonly transmit: number; readonly receive: number };
}

/** Beam steering angles relative to the antenna's mechanical boresight (aircraft axis), rad. */
export interface Steering { readonly azRad: number; readonly elRad: number }

export interface AntennaPattern {
  readonly wavelengthM: number;
  readonly polarization: "horizontal" | "vertical";
  /** Ideal-aperture peak gain η·(π/λ)²·W·H (blockage included). */
  readonly peakGainLinear: number;
  /** Boresight gains used by the radar equation (measured directivity when published, else ideal). */
  readonly transmitGain: number;
  readonly receiveGain: number;
  /** Half-power beamwidth in azimuth (and elevation) on boresight. */
  readonly halfPowerBeamwidthRad: number;
  readonly halfPowerBeamwidthElRad: number;
  readonly firstSidelobeDb: number;
  readonly taperEfficiency: number;
  /** One-way power gain relative to boresight peak at an angle off the beam centre (0..1), unsteered, azimuth plane. */
  gain(offsetRad: number): number;
  /**
   * One-way relative power gain for an offset with components across the beam (right, up), rad, at a
   * given steering. Includes the scan loss and beam broadening of a flat-mirror antenna.
   */
  gain2(offRightRad: number, offUpRad: number, steering?: Steering): number;
  /** Mirror angle needed for a beam steering angle (half of it for a flat mirror). */
  mirrorAngle(beamAngleRad: number): number;
}

/** Build the antenna's pattern from its geometry and wavelength (tabulated once, then interpolated). */
export function antennaPattern(spec: ApertureSpec, wavelengthM: number): AntennaPattern {
  if (!(spec.diameterM > 0) || !(wavelengthM > 0)) throw new RangeError("Aperture diameter and wavelength must be positive.");
  const p = spec.taperExponent;
  const W = spec.diameterM, H = spec.heightM ?? spec.diameterM;
  const kW = (Math.PI * W) / wavelengthM, kH = (Math.PI * H) / wavelengthM;
  // Blockage: obstruction of relative radius β with unit illumination, against the taper's integral πa²/(p+1).
  const beta = Math.min(0.5, (spec.blockageDiameterM ?? 0) / Math.min(W, H));
  const eps = beta * beta * (p + 1);
  // Field table in u (normalised to the aperture), blockage subtracted.
  const du = 0.02, maxU = 60;
  const field: number[] = [];
  for (let u = 0; u <= maxU + du; u += du) field.push((taperedFieldPattern(p, u) - eps * taperedFieldPattern(0, u * beta)) / (1 - eps));
  const power = (u: number) => {
    if (u >= maxU) return 0;
    const x = u / du, a = Math.floor(x), f = x - a;
    const v = (field[a] as number) * (1 - f) + (field[a + 1] as number) * f;
    return v * v;
  };
  // Half-power point and first sidelobe, in u.
  let uHalf = 0;
  while (power(uHalf) > 0.5) uHalf += du / 4;
  let u0 = uHalf;
  while (u0 + du < maxU && power(u0 + du) < power(u0)) u0 += du;
  let sl = 0;
  while (u0 + du < maxU && power(u0 + du) >= power(u0)) { u0 += du; sl = power(u0); }
  const floor = 10 ** (-spec.farSidelobeFloorDb / 10);
  const taperEfficiency = (2 * p + 1) / (p + 1) ** 2;
  const ideal = taperEfficiency * (1 - eps) ** 2 * kW * kH;
  const flat = spec.steering === "flat-mirror";
  const gain2 = (dR: number, dU: number, st?: Steering): number => {
    if (Math.hypot(dR, dU) >= Math.PI / 2) return floor;
    // Flat mirror: tilted by half the beam angle; its projection shrinks the aperture in that plane.
    const cAz = flat && st ? Math.cos(st.azRad / 2) : 1;
    const cEl = flat && st ? Math.cos(st.elRad / 2) : 1;
    const u = Math.hypot(kW * cAz * Math.sin(dR), kH * cEl * Math.sin(dU));
    return Math.max(power(u) * cAz * cEl, floor);
  };
  return {
    wavelengthM,
    polarization: spec.polarization ?? "vertical",
    peakGainLinear: ideal,
    transmitGain: spec.directivity?.transmit ?? ideal,
    receiveGain: spec.directivity?.receive ?? ideal,
    halfPowerBeamwidthRad: 2 * Math.asin(Math.min(1, uHalf / kW)),
    halfPowerBeamwidthElRad: 2 * Math.asin(Math.min(1, uHalf / kH)),
    firstSidelobeDb: 10 * Math.log10(Math.max(1e-12, sl)),
    taperEfficiency,
    gain: (offsetRad: number) => gain2(offsetRad, 0),
    gain2,
    mirrorAngle: (beamAngleRad: number) => (flat ? beamAngleRad / 2 : beamAngleRad)
  };
}
