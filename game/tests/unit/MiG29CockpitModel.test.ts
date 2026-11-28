import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createMiG29CockpitShell } from "../../src/platforms/aircraft/mig29/MiG29CockpitModel.js";

describe("MiG-29 neutral cockpit shell geometry", () => {
  it("builds a substantial, finite structural frame with bounded dimensions", () => {
    const shell = createMiG29CockpitShell();
    const meshes: THREE.Mesh[] = [];
    shell.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });

    expect(shell.name).toBe("mig29-9-13-cockpit-shell-frame");
    expect(shell.userData.visualMode).toBe("neutral-structural-blockout");
    expect(shell.userData.controlsIncluded).toBe(false);
    expect(meshes.length).toBeGreaterThanOrEqual(7);

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
      expect(mesh.userData.shell).toBe(true);
      expect(mesh.name).not.toMatch(/switch|button|knob|lever|throttle|stick|pedal/i);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.r).toBeCloseTo(material.color.g, 6);
      expect(material.color.g).toBeCloseTo(material.color.b, 6);
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

  it("keeps clear, neutral canopy glazing as a separate transparent shell part", () => {
    const shell = createMiG29CockpitShell();
    const canopy = shell.getObjectByName("mig29-cockpit-canopy-glazing");
    expect(canopy).toBeInstanceOf(THREE.Mesh);
    expect(((canopy as THREE.Mesh).material as THREE.Material).transparent).toBe(true);
    expect(shell.getObjectByName("mig29-cockpit-hud")).toBeUndefined();
  });

  it("keeps only the major empty cockpit assemblies separately addressable", () => {
    const shell = createMiG29CockpitShell();
    const names = shell.children.map((child) => child.name);
    for (const name of [
      "mig29-cockpit-tub",
      "mig29-cockpit-panel",
      "mig29-cockpit-port-console",
      "mig29-cockpit-starboard-console",
      "mig29-cockpit-seat-frame",
      "mig29-cockpit-canopy-frame",
      "mig29-cockpit-canopy-glazing"
    ]) {
      expect(names).toContain(name);
    }
  });
});
