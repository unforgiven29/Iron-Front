import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { F110_CONTROL } from "../../src/platforms/aircraft/f16c-block50/F110Engine.js";
import { createF16Definition } from "../../src/platforms/aircraft/f16c-block50/F16Definition.js";
import { F16_SWITCHES } from "../../src/platforms/aircraft/f16c-block50/F16Switches.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const terrain = new TerrainSurface();
terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 0, featureSizeM: 20000 }));
const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
const jet = (alt = 3000, speed = 220, throttle = 0.77) => new FixedWingAircraft(createF16Definition(), terrain, env, { positionEnuM: [0, 0, alt], headingRad: 0, speedMps: speed, throttle });
const fly = (a: FixedWingAircraft, s: number) => { for (let i = 0; i < Math.round(s * 120); i++) a.stepTick(); return a.snapshot(); };
const lights = (s: ReturnType<FixedWingAircraft["snapshot"]>) => s.lights.map((l) => l.text);

describe("F110-GE-129 DEC/MEC control logic (T.O. GR1F-16CJ-1)", () => {
  it("ENG CONT SEC: secondary control, nozzle closed, AB inhibited, SEC caution", () => {
    const a = jet(); a.controls.request(F16_SWITCHES.engineControl, "SEC", "test"); a.setThrottle(1);
    const s = fly(a, 5);
    expect(s.engines[0]!.control.mode).toBe("backup");
    expect(s.engines[0]!.control.afterburnerDemand).toBe(0);
    expect(s.indications["engineControlMode"]).toBe(3);
    expect(lights(s)).toContain("SEC");
  });

  it("PRI fuel-scheduling failure: automatic HYB, ENG HYB MODE PFL and ENGINE FAULT; F-ACK clears the caution, the PFL stays; fan speed limited", () => {
    const a = jet(); const pri = fly(a, 6).engines[0]!.spoolSpeed;
    a.controls.request(F16_SWITCHES.engineFault, "PRI FUEL SCHED", "test");
    const s = fly(a, 6);
    expect(s.indications["engineControlMode"]).toBe(2);
    expect(s.engines[0]!.control.mode).toBe("primary"); // DEC still runs AB and the nozzle in HYB
    expect(s.faultList).toContain("ENG HYB MODE");
    expect(lights(s)).toContain("ENGINE FAULT");
    // HYB: fan speed limited, and no turbine-blade temperature limiting (it may run hotter than PRI).
    expect(s.engines[0]!.control.speedDemand).toBeLessThanOrEqual(F110_CONTROL.maxPhysicalSpeed * 0.98 + 1e-6);
    expect(s.engines[0]!.control.activeLimits).not.toContain("turbine-inlet-temperature");
    expect(s.indications["temperatureLimiting"]).toBe(0);
    expect(pri).toBeGreaterThan(0.9);
    a.controls.request(F16_SWITCHES.faultAck, "ACK", "test");
    const acked = fly(a, 0.5);
    expect(lights(acked)).not.toContain("ENGINE FAULT");
    expect(acked.faultList).toContain("ENG HYB MODE");
  });

  it("HYB failure transfers to SEC; a DEC failure transfers straight to SEC", () => {
    const a = jet(); a.controls.request(F16_SWITCHES.engineFault, "PRI + HYB", "test");
    expect(fly(a, 0.6).indications["engineControlMode"]).toBe(2);
    expect(fly(a, 1.5).indications["engineControlMode"]).toBe(3);
    const b = jet(); b.controls.request(F16_SWITCHES.engineFault, "DEC FAIL", "test");
    const s = fly(b, 2);
    expect(s.engines[0]!.control.mode).toBe("backup");
    expect(lights(s)).toContain("SEC");
  });

  it("ENG A/B FAIL inhibits the afterburner in PRI", () => {
    const a = jet(); a.controls.request(F16_SWITCHES.engineFault, "AB FAIL", "test"); a.setThrottle(1);
    const s = fly(a, 6);
    expect(s.engines[0]!.afterburnerLit).toBe(false);
    expect(s.faultList).toContain("ENG A/B FAIL");
    expect(s.engines[0]!.control.activeLimits).toContain("afterburner-inhibited");
  });

  it("supersonic idle lock-up: throttle to IDLE above M 1.4 holds rpm within 15 % of MIL; not with ENG MACH FAIL", () => {
    const floor = (fault: string) => {
      const a = jet(11000, 480, 1); a.controls.request(F16_SWITCHES.engineFault, fault, "test");
      fly(a, 2); a.setThrottle(0);
      const s = fly(a, 4);
      return { s, demand: s.engines[0]!.control.speedDemand };
    };
    const normal = floor("NONE"), noMach = floor("MACH SIGNAL");
    expect(normal.s.mach).toBeGreaterThan(1.4);
    expect(normal.s.indications["supersonicLockup"]).toBe(1);
    expect(normal.demand).toBeGreaterThanOrEqual(F110_CONTROL.maxPhysicalSpeed * 0.85 - 0.005);
    expect(noMach.s.faultList).toContain("ENG MACH FAIL");
    expect(noMach.demand).toBeLessThan(normal.demand - 0.05);
  });

  it("oil leak: ENG LUBE LOW once quantity has been below ≈40 % for 15 s; alternator failure: ENGINE light, RPM reads zero, DEC lost", () => {
    const a = jet(); a.controls.request(F16_SWITCHES.engineFault, "OIL LEAK", "test");
    const s = fly(a, 200);
    expect(s.indications["oilQuantityFraction"]).toBeLessThan(0.4);
    expect(s.faultList).toContain("ENG LUBE LOW");
    const b = jet(); b.controls.request(F16_SWITCHES.engineFault, "ALTERNATOR", "test");
    const t = fly(b, 2);
    expect(lights(t)).toContain("ENGINE");
    expect(t.indications["rpmPercent"]).toBe(0);
    expect(t.engines[0]!.control.mode).toBe("backup");
  });
});
