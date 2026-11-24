import { describe, expect, it } from "vitest";
import { loadAircraftCatalog } from "../../src/app/AircraftCatalog.js";
import { uniformWind } from "../../src/physics/environment/Atmosphere.js";
import type { AircraftDefinition } from "../../src/platforms/aircraft/common/AircraftDefinition.js";
import { FixedWingAircraft } from "../../src/platforms/aircraft/common/FixedWingAircraft.js";
import { F110_CONTROL, F110_DESIGN } from "../../src/platforms/aircraft/f16c-block50/F110Engine.js";
import { generateSyntheticTile, TerrainSurface } from "../../src/world/terrain/Terrain.js";

function terrain() {
  const t = new TerrainSurface();
  t.addTile(generateSyntheticTile({ seed: 3, tileId: "test/t", originEnuM: [-60000, -60000], spacingM: 1000, columns: 121, rows: 121, baseHeightM: 0, reliefM: 200, featureSizeM: 20000 }));
  return t;
}

/**
 * TEST-ONLY twin-engine airframe with SYNTHETIC numbers. It exists to prove the shared runtime
 * flies a structurally different package: two off-axis engines, different surface names, its own
 * linear aero and a simple mechanical-style control system with no fly-by-wire.
 */
function testTwin(): AircraftDefinition {
  return {
    manifest: { manifestSchemaVersion: 1, id: "aircraft.test-twin", kind: "aircraft", name: "Test twin (synthetic)", version: "0.1.0", apiCompatibility: { minimum: "0.1.0", maximumExclusive: null }, provides: [{ id: "platform.aircraft.definition", apiVersion: "0.1.0" }], dependencies: [], configuration: [] },
    displayName: "Test twin",
    dataNote: "Synthetic test airframe.",
    mass: { emptyMassKg: 12000, referenceMassKg: 15000, inertiaKgM2: [[25000, 0, 0], [0, 120000, 0], [0, 0, 140000]], cgFractionMac: 0.25, internalFuelKg: 3000 },
    surfaces: [
      { id: "stab", limitDeg: 25, rateDegS: 40, bandwidthRadS: 15 },
      { id: "ailerons", limitDeg: 20, rateDegS: 60, bandwidthRadS: 15 },
      { id: "rudders", limitDeg: 25, rateDegS: 60, bandwidthRadS: 15 }
    ],
    engines: [
      { id: "left", design: F110_DESIGN, control: F110_CONTROL, positionBodyM: [-5, -0.6, 0], thrustAxisBody: [1, 0, 0] },
      { id: "right", design: F110_DESIGN, control: F110_CONTROL, positionBodyM: [-5, 0.6, 0], thrustAxisBody: [1, 0, 0] }
    ],
    cockpit: { aircraftId: "test-twin", provenance: "none", eyeFromCgM: [5, 0, -1], fieldOfViewDeg: 60, parts: [] },
    createSystems: () => ({
      aero: {
        id: "test.linear",
        compute: (i) => {
          const qS = i.dynamicPressurePa * 38;
          const cl = 0.1 + 5 * i.alphaRad, cd = 0.03 + 0.1 * cl * cl;
          const [p, q, r] = i.ratesRadps; const V = Math.max(1, i.trueAirspeedMps);
          return {
            forceBodyN: [qS * (cl * Math.sin(i.alphaRad) - cd * Math.cos(i.alphaRad)), qS * -0.8 * i.betaRad, -qS * (cl * Math.cos(i.alphaRad) + cd * Math.sin(i.alphaRad))],
            momentBodyNm: [
              qS * 11 * (-0.4 * p * 11 / (2 * V) + 0.002 * (i.surfaces["ailerons"] ?? 0)),
              qS * 3.5 * (-0.5 * i.alphaRad - 15 * q * 3.5 / (2 * V) + 0.01 * (i.surfaces["stab"] ?? 0)),
              qS * 11 * (0.1 * i.betaRad - 0.2 * r * 11 / (2 * V) + 0.001 * (i.surfaces["rudders"] ?? 0))
            ],
            outsideEnvelope: false, envelopeReasons: []
          };
        }
      },
      fcs: { reset: () => undefined, mode: () => "MECH", step: (pilot) => ({ mode: "MECH", annunciations: [], commands: { stab: pilot.pitch * 25, ailerons: pilot.roll * 20, rudders: pilot.yaw * 25 } }) },
      switches: []
    })
  };
}

describe("aircraft modularity", () => {
  it("the shared runtime flies a structurally different package (two engines, own surfaces, aero and FCS)", () => {
    const a = new FixedWingAircraft(testTwin(), terrain(), { originAltitudeMslM: 0, temperatureOffsetK: 0, wind: uniformWind("c", [0, 0, 0]) }, { positionEnuM: [0, 0, 3000], headingRad: 0, speedMps: 180, throttle: 0.6 });
    a.setPilotInputs({ pitch: 0.2, roll: 0, yaw: 0 });
    for (let i = 0; i < 240; i++) a.stepTick();
    const s = a.snapshot();
    expect(s.faults).toEqual([]);
    expect(s.engines.map((e) => e.id)).toEqual(["left", "right"]);
    expect(Object.keys(s.surfaces).sort()).toEqual(["ailerons", "rudders", "stab"]);
    expect(s.fcsMode).toBe("MECH");
    expect(s.pitchRad).toBeGreaterThan(0); // stick back pitched it up
    expect(Math.abs(s.rollRad)).toBeLessThan(0.05); // symmetric engines: no roll
  });

  it("the game loads aircraft through the module system", () => {
    const catalog = loadAircraftCatalog();
    expect(catalog.problems).toEqual([]);
    expect(catalog.ids).toEqual(["aircraft.f16c-block50"]);
    expect(catalog.definition("aircraft.f16c-block50").displayName).toBe("F-16C Block 50");
  });
});
