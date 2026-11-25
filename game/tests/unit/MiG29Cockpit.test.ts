import { describe, expect, it } from "vitest";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { MIG29_COCKPIT_INSTRUMENTS, MIG29_COCKPIT_LAYOUT } from "../../src/platforms/aircraft/mig29/MiG29Cockpit.js";
import { createMiG29Definition, MIG29_SWITCHES } from "../../src/platforms/aircraft/mig29/MiG29Definition.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

const terrain = new TerrainSurface();
terrain.addTile(generateSyntheticTile({ seed: 1, tileId: "t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 0, featureSizeM: 20000 }));
const env = { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) };
const fly = (a: FixedWingAircraft, s: number) => { for (let i = 0; i < Math.round(s * 120); i++) a.stepTick(); return a.snapshot(); };

describe("MiG-29 cockpit", () => {
  it("every instrument part has a value source, and every lever is bound to a real switch with its real positions", () => {
    const def = createMiG29Definition();
    const ids = new Set(Object.values(MIG29_SWITCHES) as string[]);
    for (const p of MIG29_COCKPIT_LAYOUT.parts) {
      if (p.kind === "instrument") expect(MIG29_COCKPIT_INSTRUMENTS[p.id], p.id).toBeDefined();
      if (p.binding?.kind === "switch") {
        expect(ids.has(p.binding.switchId), p.binding.switchId).toBe(true);
        const switchId = p.binding.switchId;
        const sw = def.createSystems().switches.find((s) => s.definition.id === switchId)!;
        expect(p.binding.positions).toEqual(sw.definition.positions);
      }
    }
  });

  it("gauges read the live snapshot", () => {
    const a = new FixedWingAircraft(createMiG29Definition(), terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 200, throttle: 0.7 });
    const s = fly(a, 3);
    const v = (id: string) => MIG29_COCKPIT_INSTRUMENTS[id]!(s);
    expect(v("ias")[0]).toBeCloseTo(s.equivalentAirspeedMps * 3.6, 6);
    expect(v("alt")[0]).toBeCloseTo(s.altitudeMslM, 6);
    expect(v("fuel")[0]).toBeCloseTo(s.fuelKg, 6);
    expect(v("rpm")).toHaveLength(2);
    for (const x of [...v("rpm"), ...v("egt-l"), ...v("egt-r"), ...v("hydgas"), ...v("adi"), ...v("hsi"), ...v("ramps"), ...v("aoa"), ...v("ralt")]) expect(Number.isFinite(x)).toBe(true);
    expect(v("hydgas")[0]).toBeCloseTo(s.hydraulics!.circuits.find((c) => c.id === "main")!.pressurePa / 98066.5, 6);
    expect(v("hydgas")[3]).toBeCloseTo(s.pneumatics!.systems.find((c) => c.id === "emergency")!.pressurePa / 98066.5, 6);
    expect(v("ralt")[0]).toBeCloseTo(s.ground.kind === "airborne" ? s.ground.aglM : 0, 6);
    expect(v("cabin").every((x) => Number.isNaN(x))).toBe(true); // not simulated: drawn empty, never faked
  });

  it("powered instruments show no reading (OFF) when their bus is unpowered; pitot-static ones keep working", () => {
    const a = new FixedWingAircraft(createMiG29Definition(), terrain, env, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 200, throttle: 0.7 });
    a.controls.request(MIG29_SWITCHES.acGen, "OFF", "test");
    a.controls.request(MIG29_SWITCHES.pto, "OFF", "test");
    const s = fly(a, 1);
    expect(s.electrical!.buses.find((b) => b.id === "ac36")!.powered).toBe(false);
    const v = (id: string) => MIG29_COCKPIT_INSTRUMENTS[id]!(s);
    expect(v("adi").every((x) => Number.isNaN(x))).toBe(true);
    expect(v("hydgas").every((x) => Number.isNaN(x))).toBe(true);
    expect(v("hsi").every((x) => Number.isNaN(x))).toBe(true);
    expect(Number.isFinite(v("ias")[0]!)).toBe(true);
    expect(Number.isFinite(v("fuel")[0]!)).toBe(true); // DC bus still powered
  });
});
