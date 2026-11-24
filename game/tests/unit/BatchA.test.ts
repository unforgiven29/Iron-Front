import { describe, expect, it } from "vitest";
import { standardAtmosphere, uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { MixedFlowTurbofan, solveCycle } from "../../src/physics/propulsion/MixedFlowTurbofan.js";
import { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { mig29ControlSystem } from "../../src/platforms/aircraft/mig29/MiG29ControlSystem.js";
import { createMiG29Definition } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";
import { RD33_DESIGN } from "../../src/platforms/aircraft/mig29/MiG29Engines.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const D = Math.PI / 180;
const sensors = (o: { alphaDeg: number; qDegS?: number; nz?: number; mach?: number; gearUp?: boolean }) => ({ nzG: o.nz ?? 1, nyG: 0, weightOnWheels: false, gearUpLocked: o.gearUp ?? true, alphaRad: o.alphaDeg * D, betaRad: 0, ratesRadps: [0, (o.qDegS ?? 0) * D, 0] as const, dynamicPressurePa: 2e4, staticPressurePa: 8e4, mach: o.mach ?? 0.5, trueAirspeedMps: 170, pitchRad: 0, rollRad: 0 });

describe("MiG-29 AoA/G system (GAF T.O. COC)", () => {
  it("the pitch kicker triggers earlier with a high pitch rate, and is disabled with the gear down", () => {
    const f = mig29ControlSystem();
    const kick = (a: number, q: number, up = true) => f.step({ pitch: 1, roll: 0, yaw: 0 }, sensors({ alphaDeg: a, qDegS: q, gearUp: up }), { lef: 0 }, 1 / 120).telemetry!["kickerDeg"]!;
    expect(kick(13, 0)).toBe(0);
    expect(kick(13, 12)).toBeGreaterThan(0); // 13° + 0.5 s × 12°/s exceeds the 15° LEF-in limit
    expect(kick(18, 0, false)).toBe(0);
  });
  it("records maximum g and flags overstress above the structural limit (9 g subsonic / 7 g supersonic) — indication only", () => {
    const f = mig29ControlSystem();
    f.step({ pitch: 0, roll: 0, yaw: 0 }, sensors({ alphaDeg: 5, nz: 8 }), { lef: 0 }, 1 / 120);
    const o = f.step({ pitch: 0, roll: 0, yaw: 0 }, sensors({ alphaDeg: 5, nz: 7.5, mach: 1.2 }), { lef: 0 }, 1 / 120);
    expect(o.telemetry!["nzMaxG"]).toBe(8);
    expect(o.annunciations).toContain("G OVERSTRESS");
  });
});

describe("engine temperatures, flows and nozzle", () => {
  const a = (() => { const x = standardAtmosphere(3000); return { temperatureK: x.temperatureK, pressurePa: x.pressurePa, mach: 0.6 }; })();
  it("after a flameout the hot section cools gradually, not instantly", () => {
    const e = new MixedFlowTurbofan(RD33_DESIGN, 0.95);
    for (let i = 0; i < 300; i++) e.step({ speed: 0.95, afterburner: 0 }, a, true, 0.01);
    const hot = e.state.exhaustGasTemperatureK!;
    for (let i = 0; i < 100; i++) e.step({ speed: 0.95, afterburner: 0 }, a, false, 0.01);
    const oneSecond = e.state.exhaustGasTemperatureK!;
    expect(oneSecond).toBeGreaterThan(hot - 0.1 * (hot - a.temperatureK));
    for (let i = 0; i < 30000; i++) e.step({ speed: 0.95, afterburner: 0 }, a, false, 0.01);
    // It settles at the windmilling gas temperature (ram-compressed air), not ambient static temperature.
    const windmillGasK = solveCycle(RD33_DESIGN, a, 0.2, 0).compressorExitTemperatureK;
    expect(Math.abs(e.state.exhaustGasTemperatureK! - windmillGasK)).toBeLessThan(10);
  });
  it("main + afterburner fuel = total; core + bypass flow = airflow at the design bypass ratio", () => {
    const c = solveCycle(RD33_DESIGN, a, 1, 0.8);
    const st = c.stations!;
    expect(st.mainFuelKgS + st.afterburnerFuelKgS).toBeCloseTo(c.fuelFlowKgS, 6);
    expect(st.coreFlowKgS + st.bypassFlowKgS).toBeCloseTo(c.airflowKgS, 6);
    expect(st.bypassFlowKgS / st.coreFlowKgS).toBeCloseTo(RD33_DESIGN.bypassRatio, 6);
    expect(st.afterburnerFuelKgS).toBeGreaterThan(st.mainFuelKgS);
  });
  it("the nozzle actuator lags its command when the afterburner lights", () => {
    const e = new MixedFlowTurbofan(RD33_DESIGN, 1);
    for (let i = 0; i < 300; i++) e.step({ speed: 1, afterburner: 0 }, a, true, 0.01);
    e.step({ speed: 1, afterburner: 1 }, a, true, 0.01);
    for (let i = 0; i < 40; i++) e.step({ speed: 1, afterburner: 1 }, a, true, 0.01);
    expect(e.state.nozzleCommandPosition - e.state.nozzleActualPosition).toBeGreaterThan(0.05);
  });
});

describe("render interpolation", () => {
  it("blends position between the last two fixed steps without changing the simulation snapshot", () => {
    const t = new TerrainSurface();
    t.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 0, featureSizeM: 20000 }));
    const j = new FixedWingAircraft(createMiG29Definition(), t, { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) }, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 300, throttle: 0.6 });
    j.advanceFrame(1 / 120 * 2.5);
    const sim = j.snapshot().positionEnuM[1], drawn = j.renderSnapshot().positionEnuM[1];
    expect(drawn).toBeLessThan(sim);
    expect(sim - drawn).toBeLessThan(300 / 120 + 0.01);
  });
});
