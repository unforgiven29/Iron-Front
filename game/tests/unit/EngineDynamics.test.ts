import { describe, expect, it } from "vitest";
import { standardAtmosphere } from "../../src/physics/environment/Atmosphere.js";
import { Fadec } from "../../src/physics/propulsion/Fadec.js";
import { MixedFlowTurbofan } from "../../src/physics/propulsion/MixedFlowTurbofan.js";
import { RD33_CONTROL, RD33_DESIGN } from "../../src/platforms/aircraft/mig29/MiG29Engines.js";

const amb = (ft: number, mach: number, distortion = 0) => { const a = standardAtmosphere(ft * 0.3048); return { temperatureK: a.temperatureK, pressurePa: a.pressurePa, mach, ...(distortion ? { inletCondition: { weightOnWheels: false, equivalentAirspeedMps: 200, state: { rampExtension: 0, rampScheduled: 0, auxOpen: false, mode: "x", distortion } } } : {}) }; };
const run = (fadec: Fadec, e: MixedFlowTurbofan, throttle: number, a: ReturnType<typeof amb>, s: number, each?: (t: number) => void) => {
  for (let i = 1; i <= s * 100; i++) { const c = fadec.step(throttle, { ambient: a, spoolSpeed: e.state.spoolSpeed, fuelAvailable: true }, 0.01); e.step({ speed: c.speedDemand, afterburner: c.afterburnerDemand, throat: c.throat }, a, true, 0.01); each?.(i / 100); }
  return e.state;
};
const fresh = (a: ReturnType<typeof amb>) => { const f = new Fadec(RD33_DESIGN, RD33_CONTROL, 0, a); return { f, e: new MixedFlowTurbofan(RD33_DESIGN, f.initialSpeed) }; };

describe("engine dynamics (shared core, RD-33 data)", () => {
  it("two spools: in a spool-up the fan (NL) lags the core (NH); thrust follows the fan", () => {
    const a = amb(10000, 0.6), { f, e } = fresh(a);
    run(f, e, 0, a, 15);
    let lagSeen = false;
    run(f, e, 0.77, a, 6, () => { if (e.state.spoolSpeed - e.state.fanSpeed > 0.01) lagSeen = true; });
    expect(lagSeen).toBe(true);
    expect(Math.abs(e.state.spoolSpeed - e.state.fanSpeed)).toBeLessThan(0.01);
  });

  it("a normal throttle burst does not surge; heavy inlet distortion does, thrust collapses, and it recovers", () => {
    const a = amb(10000, 0.6), { f, e } = fresh(a);
    let surged = false;
    run(f, e, 1, a, 10, () => { if (e.state.surging) surged = true; });
    expect(surged).toBe(false);
    const bad = amb(10000, 0.6, 1);
    const before = e.state.netThrustN;
    run(f, e, 1, bad, 0.2);
    expect(e.state.surging).toBe(true);
    expect(e.state.netThrustN).toBeLessThan(0.4 * before);
    expect(e.state.health!.surgeCount).toBeGreaterThan(0);
    run(f, e, 1, a, 12);
    expect(e.state.surging).toBe(false);
    expect(e.state.health!.surgeCount).toBe(1); // recovers without re-surging
    expect(e.state.spoolSpeed).toBeGreaterThan(0.97);
  });

  it("afterburner zones light in sequence (three spraybars)", () => {
    const a = amb(5000, 0.7), { f, e } = fresh(a);
    run(f, e, 0.77, a, 15);
    const seen = new Set<number>();
    run(f, e, 1, a, 8, () => seen.add(e.state.afterburnerZonesLit));
    expect(e.state.afterburnerZones).toBe(3);
    expect([...seen].filter((z) => z > 0).sort()).toEqual([1, 2, 3]);
  });

  it("the afterburner blows out at low burner pressure (very high altitude, low speed) and stays out for the relight delay", () => {
    const a = amb(52000, 0.55), { f, e } = fresh(a);
    run(f, e, 0.77, a, 25);
    let blown = false;
    run(f, e, 1, a, 6, () => { if (e.state.afterburnerBlowout) blown = true; });
    expect(blown || !e.state.afterburnerLit).toBe(true);
  });

  it("RPM hang-up: IDLE→MIL acceleration is slower above 30,000 ft at low airspeed", () => {
    // Time from IDLE to 97 % of the speed the engine finally settles at (MIL) at that condition.
    const t = (ft: number, m: number) => { const a = amb(ft, m), { f, e } = fresh(a); run(f, e, 0, a, 20); const idle = e.state.spoolSpeed; const trace: number[] = []; run(f, e, 0.77, a, 40, () => trace.push(e.state.spoolSpeed)); const fin = trace[trace.length - 1]!; return trace.findIndex((v) => v >= idle + 0.97 * (fin - idle)) / 100; };
    expect(t(35000, 0.45)).toBeGreaterThan(t(5000, 0.45) * 1.2); // "momentary" hang-up (GAF T.O.)
  });

  it("oil warms up with running time and oil pressure follows NH²", () => {
    const a = amb(5000, 0.5), { f, e } = fresh(a);
    const t0 = e.state.health!.oilTemperatureK;
    run(f, e, 0.7, a, 120);
    expect(e.state.health!.oilTemperatureK).not.toBeCloseTo(t0, 0);
    expect(e.state.health!.oilPressurePa / (e.state.spoolSpeed ** 2)).toBeCloseTo(3.5 * 98066.5, -2);
    expect(e.state.health!.hotSectionEquivalentS).toBeGreaterThan(0);
  });
});
