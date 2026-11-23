import { describe, expect, it } from "vitest";
import { standardAtmosphere } from "../../src/physics/environment/Atmosphere.js";
import { f16Aerodynamics, F16Engine, SurfaceActuator } from "../../src/platforms/aircraft/f16c-block50/F16FlightModel.js";
import { allF16Parameters, F16_ENGINE, F16_MASS } from "../../src/platforms/aircraft/f16c-block50/F16Data.js";

const FT = 0.3048;
const DEG = Math.PI / 180;

/** Solve level 1-g trim (alpha, elevator) at speed V, sea level, by Newton iteration on Cm = 0 and Z + W cos(a)... = 0. */
function trimLevel(vMps: number, cg = 0.35) {
  const atm = standardAtmosphere(0);
  const q = 0.5 * atm.densityKgM3 * vMps * vMps;
  const W = F16_MASS.massKg.value * 9.80665;
  const residual = (a: number, el: number) => {
    const o = f16Aerodynamics({ alphaRad: a, betaRad: 0, trueAirspeedMps: vMps, dynamicPressurePa: q, mach: vMps / atm.speedOfSoundMps, ratesRadps: [0, 0, 0], surfaces: { elevatorDeg: el, aileronDeg: 0, rudderDeg: 0 }, cgFractionMac: cg });
    // Level flight, pitch = alpha: lift balance in earth vertical, ignoring the (small) thrust term.
    const vertical = -o.forceBodyN[2] * Math.cos(a) + o.forceBodyN[0] * Math.sin(a) - W;
    return [o.coefficients.cm, vertical / (q * 27.87)] as const;
  };
  let a = 2 * DEG, el = 0;
  for (let i = 0; i < 50; i++) {
    const [f1, f2] = residual(a, el);
    const h1 = 1e-6, h2 = 1e-4;
    const [a1, a2] = residual(a + h1, el), [e1, e2] = residual(a, el + h2);
    const j11 = (a1 - f1) / h1, j12 = (e1 - f1) / h2, j21 = (a2 - f2) / h1, j22 = (e2 - f2) / h2;
    const det = j11 * j22 - j12 * j21;
    a -= (f1 * j22 - f2 * j12) / det;
    el -= (j11 * f2 - j21 * f1) / det;
  }
  return { alphaDeg: a / DEG, elevatorDeg: el };
}

describe("F-16 aerodynamics (provisional NASA TP-1538 / Stevens & Lewis dataset)", () => {
  it("reproduces the Stevens & Lewis sea-level trim at 502 ft/s (alpha ≈ 2.12°, elevator ≈ -0.76°)", () => {
    const t = trimLevel(502 * FT);
    expect(t.alphaDeg).toBeCloseTo(2.12, 1);
    expect(t.elevatorDeg).toBeCloseTo(-0.76, 1);
  });

  it("trims at higher alpha when slower; a forward CG needs more nose-up elevator", () => {
    const fast = trimLevel(250), slow = trimLevel(120);
    expect(slow.alphaDeg).toBeGreaterThan(fast.alphaDeg);
    expect(trimLevel(150, 0.25).elevatorDeg).toBeLessThan(trimLevel(150, 0.35).elevatorDeg);
  });

  it("has relaxed static stability at the 0.35 MAC reference CG, becomes stable with a forward CG, and damps rates", () => {
    const base = { betaRad: 0, trueAirspeedMps: 150, dynamicPressurePa: 13781, mach: 0.44, surfaces: { elevatorDeg: 0, aileronDeg: 0, rudderDeg: 0 }, cgFractionMac: 0.35 };
    const cm = (a: number, q = 0, cg = 0.35) => f16Aerodynamics({ ...base, cgFractionMac: cg, alphaRad: a * DEG, ratesRadps: [0, q, 0] }).coefficients.cm;
    // NASA TP-1538 studies the F-16's relaxed longitudinal static stability: near-neutral/unstable at low alpha.
    expect(cm(6)).toBeGreaterThan(cm(2));
    expect(cm(6, 0, 0.2)).toBeLessThan(cm(2, 0, 0.2));
    expect(cm(4, 0.5)).toBeLessThan(cm(4, 0));
    const roll = (p: number) => f16Aerodynamics({ ...base, alphaRad: 4 * DEG, ratesRadps: [p, 0, 0] }).coefficients.cl;
    expect(roll(1)).toBeLessThan(roll(0));
  });

  it("flags conditions outside the dataset envelope", () => {
    const o = f16Aerodynamics({ alphaRad: 60 * DEG, betaRad: 0, trueAirspeedMps: 300, dynamicPressurePa: 5e4, mach: 0.9, ratesRadps: [0, 0, 0], surfaces: { elevatorDeg: 0, aileronDeg: 0, rudderDeg: 0 }, cgFractionMac: 0.35 });
    expect(o.outsideEnvelope).toBe(true);
    expect(o.envelopeReasons.join(" ")).toContain("Mach 0.90");
  });

  it("every parameter carries status and source; unknowns are not zero", () => {
    for (const { name, parameter } of allF16Parameters()) {
      expect(parameter.source.length, name).toBeGreaterThan(0);
      if (parameter.status === "unknown") expect(Number.isNaN(parameter.value), name).toBe(true);
    }
  });
});

describe("F-16 actuators and engine", () => {
  it("actuators are rate-limited and never jump to the command", () => {
    const a = new SurfaceActuator(25, 60);
    a.step(25, 0.1);
    expect(a.positionDeg).toBeCloseTo(6, 9); // 60 deg/s * 0.1 s
    for (let i = 0; i < 100; i++) a.step(40, 0.01);
    expect(a.positionDeg).toBe(25);
  });

  it("engine spools, uses afterburner above the detent, burns fuel and flames out when empty", () => {
    const e = new F16Engine(0, 500);
    expect(e.commandedPower(F16_ENGINE.afterburnerDetentThrottle.value)).toBeCloseTo(F16_ENGINE.militaryThrustFraction.value, 12);
    let s = e.step(1, 1, 0.01);
    expect(s.thrustN).toBeLessThan(0.1 * F16_ENGINE.maxAfterburnerThrustN.value);
    for (let i = 0; i < 1000; i++) s = e.step(1, 1, 0.01);
    expect(s.afterburner).toBe(true);
    expect(s.thrustN).toBeGreaterThan(0.99 * F16_ENGINE.maxAfterburnerThrustN.value);
    for (let i = 0; i < 100_000 && !s.flameout; i++) s = e.step(1, 1, 0.01);
    expect(s).toMatchObject({ flameout: true, thrustN: 0, fuelKg: 0 });
    const high = new F16Engine(1);
    for (let i = 0; i < 2000; i++) high.step(1, 0.3, 0.01);
    expect(high.state.thrustN).toBeLessThan(0.5 * F16_ENGINE.maxAfterburnerThrustN.value);
  });
});
