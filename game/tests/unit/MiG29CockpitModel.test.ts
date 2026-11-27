import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createMiG29CockpitShell } from "../../src/platforms/aircraft/mig29/MiG29CockpitModel.js";

describe("MiG-29 cockpit shell geometry", () => {
  it("builds a substantial, finite cockpit assembly with bounded dimensions", () => {
    const shell = createMiG29CockpitShell();
    const meshes: THREE.Mesh[] = [];
    shell.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });

    expect(shell.name).toBe("mig29-9-13-cockpit-shell-provisional");
    expect(meshes.length).toBeGreaterThanOrEqual(12);

    const bounds = new THREE.Box3().setFromObject(shell);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(1.0);
    expect(size.x).toBeLessThan(1.3);
    expect(size.y).toBeGreaterThan(1.2);
    expect(size.y).toBeLessThan(1.8);
    expect(size.z).toBeGreaterThan(2.1);
    expect(size.z).toBeLessThan(2.7);

    for (const mesh of meshes) {
      const position = mesh.geometry.getAttribute("position");
      const normal = mesh.geometry.getAttribute("normal");
      expect(position.count).toBeGreaterThan(0);
      expect(normal.count).toBe(position.count);
      for (let i = 0; i < position.count; i++) {
        expect(Number.isFinite(position.getX(i))).toBe(true);
        expect(Number.isFinite(position.getY(i))).toBe(true);
        expect(Number.isFinite(position.getZ(i))).toBe(true);
        expect(Number.isFinite(normal.getX(i))).toBe(true);
        expect(Number.isFinite(normal.getY(i))).toBe(true);
        expect(Number.isFinite(normal.getZ(i))).toBe(true);
      }
    }
  });

  it("includes translucent canopy and HUD glazing as separate material groups", () => {
    const shell = createMiG29CockpitShell();
    const canopy = shell.getObjectByName("mig29-cockpit-glass");
    const hud = shell.getObjectByName("mig29-cockpit-hud");
    expect(canopy).toBeInstanceOf(THREE.Mesh);
    expect(hud).toBeInstanceOf(THREE.Mesh);
    expect(((canopy as THREE.Mesh).material as THREE.Material).transparent).toBe(true);
    expect(((hud as THREE.Mesh).material as THREE.Material).transparent).toBe(true);
  });

  it("keeps major cockpit assemblies separately addressable for render diagnostics", () => {
    const shell = createMiG29CockpitShell();
    const names = shell.children.map((child) => child.name);
    for (const name of [
      "mig29-cockpit-paint",
      "mig29-cockpit-panel",
      "mig29-cockpit-console",
      "mig29-cockpit-seat",
      "mig29-cockpit-cushion",
      "mig29-cockpit-belt",
      "mig29-cockpit-glass",
      "mig29-cockpit-hud"
    ]) {
      expect(names).toContain(name);
    }
  });
});
