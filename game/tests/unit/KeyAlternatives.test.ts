import { describe, expect, it } from "vitest";
import { KEY_ALTERNATIVES } from "../../src/app/AircraftSession.js";
import { F16_AVIONICS_CONTROLS } from "../../src/platforms/aircraft/f16c-block50/avionics/F16FireControl.js";
import { MIG29_AVIONICS_CONTROLS } from "../../src/platforms/aircraft/mig29/avionics/MiG29WeaponControl.js";

describe("keyboard alternatives for compact keyboards", () => {
  it("map onto navigation keys and never shadow a key an aircraft already binds", () => {
    const bound = new Set([...F16_AVIONICS_CONTROLS, ...MIG29_AVIONICS_CONTROLS].map((c) => c.key));
    for (const [alt, nav] of Object.entries(KEY_ALTERNATIVES)) {
      expect(["home", "end", "pageup", "pagedown", "insert", "delete"]).toContain(nav);
      expect(bound.has(alt)).toBe(false);
    }
    expect(KEY_ALTERNATIVES["h"]).toBe("home");
  });
});
