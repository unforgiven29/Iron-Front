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
  readonly diameterM: number;
  /** Illumination taper exponent p in (1 − r²)^p: 0 = uniform, larger = lower sidelobes, wider beam. */
  readonly taperExponent: 0 | 1 | 2 | 3;
  /** Floor on far sidelobes from blockage/surface errors, dB below peak (one-way). */
  readonly farSidelobeFloorDb: number;
  /**
   * Measured directivity (linear) when published. Real antennas lose gain to feed spillover,
   * blockage, polarisation twist and ohmic loss, and transmit/receive paths can differ (e.g. a
   * monopulse receive feed). When given, these replace the ideal-aperture gain; the pattern SHAPE
   * still comes from diameter, taper and wavelength.
   */
  readonly directivity?: { readonly transmit: number; readonly receive: number };
}

export interface AntennaPattern {
  readonly wavelengthM: number;
  /** Ideal-aperture peak gain η·(πD/λ)². */
  readonly peakGainLinear: number;
  /** Gains actually used by the radar equation (measured directivity when published, else ideal). */
  readonly transmitGain: number;
  readonly receiveGain: number;
  readonly halfPowerBeamwidthRad: number;
  readonly firstSidelobeDb: number;
  readonly taperEfficiency: number;
  /** One-way power gain relative to peak at an angle off boresight (0..1). */
  gain(offsetRad: number): number;
}

/** Build the antenna's pattern from its geometry and wavelength (tabulated once, then interpolated). */
export function antennaPattern(spec: ApertureSpec, wavelengthM: number): AntennaPattern {
  if (!(spec.diameterM > 0) || !(wavelengthM > 0)) throw new RangeError("Aperture diameter and wavelength must be positive.");
  const p = spec.taperExponent;
  const k = (Math.PI * spec.diameterM) / wavelengthM;
  // Tabulate power pattern in u up to 60 (covers many sidelobes); beyond, use the floor.
  const du = 0.02, maxU = 60;
  const table: number[] = [];
  for (let u = 0; u <= maxU + du; u += du) table.push(taperedFieldPattern(p, u) ** 2);
  // Half-power point.
  let i = 0;
  while ((table[i] as number) > 0.5) i++;
  const uHalf = (i - 1 + ((table[i - 1] as number) - 0.5) / ((table[i - 1] as number) - (table[i] as number))) * du;
  // First sidelobe peak: first local maximum after the first null.
  let j = i;
  while (j + 1 < table.length && (table[j + 1] as number) < (table[j] as number)) j++;
  let sl = 0;
  while (j + 1 < table.length && (table[j + 1] as number) >= (table[j] as number)) { j++; sl = table[j] as number; }
  const floor = 10 ** (-spec.farSidelobeFloorDb / 10);
  // Aperture (taper) efficiency of (1 − r²)^p illumination: (2p + 1)/(p + 1)².
  const taperEfficiency = (2 * p + 1) / (p + 1) ** 2;
  return {
    wavelengthM,
    peakGainLinear: taperEfficiency * k * k,
    transmitGain: spec.directivity?.transmit ?? taperEfficiency * k * k,
    receiveGain: spec.directivity?.receive ?? taperEfficiency * k * k,
    halfPowerBeamwidthRad: 2 * Math.asin(Math.min(1, uHalf / k)),
    firstSidelobeDb: 10 * Math.log10(sl),
    taperEfficiency,
    gain(offsetRad: number): number {
      const u = k * Math.sin(Math.min(Math.PI / 2, Math.abs(offsetRad)));
      if (Math.abs(offsetRad) >= Math.PI / 2) return floor;
      if (u >= maxU) return floor;
      const x = u / du, a = Math.floor(x), f = x - a;
      const v = (table[a] as number) * (1 - f) + (table[a + 1] as number) * f;
      return Math.max(v, floor);
    }
  };
}
