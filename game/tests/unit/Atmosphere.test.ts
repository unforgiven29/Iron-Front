import { describe, expect, it } from "vitest";
import type { Quaternion } from "../../src/core/coordinates/CoordinateFrames.js";
import {
  AtmosphereEnvelopeError, geometricToGeopotential, gravityMagnitude, layeredWind, localAirflow,
  sampleEnvironment, standardAtmosphere, uniformWind
} from "../../src/physics/environment/Atmosphere.js";

/** Geometric altitude that gives an exact geopotential height. */
const fromGeopotential = (h: number) => (6_356_766 * h) / (6_356_766 - h);
const rel = (actual: number, expected: number) => Math.abs(actual - expected) / Math.abs(expected);

describe("standard atmosphere (ISO 2533 / ICAO / US 1976 tabulated values)", () => {
  // Reference values from the U.S. Standard Atmosphere 1976 tables (geopotential altitude).
  const table: [number, number, number, number, number][] = [
    // H m, T K, p Pa, rho kg/m3, a m/s
    [0, 288.15, 101_325, 1.225, 340.294],
    [5_000, 255.65, 54_019.9, 0.736116, 320.529],
    [11_000, 216.65, 22_632.1, 0.363918, 295.070],
    [15_000, 216.65, 12_044.6, 0.193674, 295.070],
    [20_000, 216.65, 5_474.89, 0.0880349, 295.070],
    [25_000, 221.65, 2_511.02, 0.0394658, 298.455],
    [32_000, 228.65, 868.019, 0.0132250, 303.131],
    [-1_000, 294.65, 113_929, 1.34700, 344.111]
  ];
  for (const [h, T, p, rho, a] of table) {
    it(`matches the tables at ${h} m geopotential`, () => {
      const s = standardAtmosphere(fromGeopotential(h));
      expect(s.geopotentialAltitudeM).toBeCloseTo(h, 6);
      expect(s.temperatureK).toBeCloseTo(T, 6);
      expect(rel(s.pressurePa, p)).toBeLessThan(1e-5);
      expect(rel(s.densityKgM3, rho)).toBeLessThan(2e-5);
      expect(rel(s.speedOfSoundMps, a)).toBeLessThan(2e-6);
    });
  }

  it("is continuous across layer boundaries", () => {
    for (const h of [11_000, 20_000]) {
      const below = standardAtmosphere(fromGeopotential(h - 1e-6));
      const above = standardAtmosphere(fromGeopotential(h + 1e-6));
      expect(rel(below.pressurePa, above.pressurePa)).toBeLessThan(1e-9);
      expect(Math.abs(below.temperatureK - above.temperatureK)).toBeLessThan(1e-6);
    }
  });

  it("refuses to extrapolate outside the envelope", () => {
    expect(() => standardAtmosphere(fromGeopotential(32_001))).toThrow(AtmosphereEnvelopeError);
    expect(() => standardAtmosphere(fromGeopotential(-2_001))).toThrow("outside the standard-atmosphere envelope");
    expect(() => standardAtmosphere(Number.NaN)).toThrow("finite");
  });

  it("applies an ISA+dT day: same pressure, warmer air is thinner and sound is faster", () => {
    const std = standardAtmosphere(3_000);
    const hot = standardAtmosphere(3_000, 20);
    expect(hot.pressurePa).toBe(std.pressurePa);
    expect(hot.temperatureK).toBeCloseTo(std.temperatureK + 20, 12);
    expect(hot.densityKgM3).toBeLessThan(std.densityKgM3);
    expect(hot.speedOfSoundMps).toBeGreaterThan(std.speedOfSoundMps);
    expect(() => standardAtmosphere(0, 100)).toThrow("±60 K");
  });

  it("converts geometric to geopotential height and weakens gravity with height", () => {
    expect(geometricToGeopotential(0)).toBe(0);
    expect(geometricToGeopotential(fromGeopotential(11_000))).toBeCloseTo(11_000, 6);
    expect(gravityMagnitude(0)).toBe(9.80665);
    expect(gravityMagnitude(10_000)).toBeCloseTo(9.7759, 3);
  });
});

describe("wind and local airflow", () => {
  const LEVEL_EAST: Quaternion = [1, 0, 0, 0]; // body forward = east, right = south, down = down

  it("interpolates layered wind and holds the end layers", () => {
    const w = layeredWind("test", [{ heightM: 0, velocityEnuMps: [0, 0, 0] }, { heightM: 1000, velocityEnuMps: [10, -20, 0] }]);
    expect(w.sample([0, 0, 500], 0)).toEqual([5, -10, 0]);
    expect(w.sample([0, 0, -50], 0)).toEqual([0, 0, 0]);
    expect(w.sample([0, 0, 5000], 0)).toEqual([10, -20, 0]);
    expect(() => layeredWind("bad", [{ heightM: 10, velocityEnuMps: [0, 0, 0] }, { heightM: 10, velocityEnuMps: [0, 0, 0] }])).toThrow("strictly increasing");
    expect(() => layeredWind("bad", [])).toThrow("at least one");
  });

  it("computes airspeed relative to the air mass, in world and body frames", () => {
    const env = sampleEnvironment({ originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("hw", [-20, 0, 0]) }, [0, 0, 0], 0);
    const flow = localAirflow([100, 0, 0], LEVEL_EAST, env);
    expect(flow.airVelocityEnuMps).toEqual([120, 0, 0]);
    flow.airVelocityBodyMps.forEach((v, i) => expect(v).toBeCloseTo([120, 0, 0][i] as number, 12));
    expect(flow.trueAirspeedMps).toBe(120);
    expect(flow.machNumber).toBeCloseTo(120 / 340.294, 5);
    expect(flow.dynamicPressurePa).toBeCloseTo(0.5 * env.atmosphere.densityKgM3 * 120 * 120, 9);
    expect(rel(flow.dynamicPressurePa, 0.5 * 1.225 * 120 * 120)).toBeLessThan(1e-5);

    const crosswind = localAirflow([100, 0, 0], LEVEL_EAST, sampleEnvironment({ originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("xw", [0, 10, 0]) }, [0, 0, 0], 0));
    // Wind blowing north -> air moves south relative to the jet: body +y (right = south when heading east).
    expect(crosswind.airVelocityBodyMps[1]).toBeCloseTo(10, 12);
  });

  it("samples altitude from the scenario origin and supplies downward gravity", () => {
    const env = sampleEnvironment({ originAltitudeMslM: 1_000, temperatureOffsetK: 0, wind: uniformWind("calm", [0, 0, 0]) }, [5, 5, 500], 0);
    expect(env.atmosphere.geometricAltitudeM).toBe(1_500);
    expect(env.gravityEnuMps2[0]).toBe(0);
    expect(env.gravityEnuMps2[2]).toBeCloseTo(-gravityMagnitude(1_500), 12);
    expect(() => sampleEnvironment({ originAltitudeMslM: 0, temperatureOffsetK: 0, wind: { id: "broken", sample: () => [Number.NaN, 0, 0] } }, [0, 0, 0], 0)).toThrow('"broken"');
  });

  it("gives the same answer regardless of query order", () => {
    const cfg = { originAltitudeMslM: 200, temperatureOffsetK: -5, wind: layeredWind("w", [{ heightM: 0, velocityEnuMps: [1, 2, 0] }, { heightM: 3000, velocityEnuMps: [9, -4, 0] }]) };
    const points: [number, number, number][] = [[0, 0, 10], [100, -40, 2500], [7, 7, 900]];
    const forward = points.map((p) => sampleEnvironment(cfg, p, 1));
    const backward = [...points].reverse().map((p) => sampleEnvironment(cfg, p, 1)).reverse();
    expect(backward).toEqual(forward);
  });
});
