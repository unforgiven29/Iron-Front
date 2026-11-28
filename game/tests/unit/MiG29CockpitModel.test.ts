import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createMiG29CockpitShell } from "../../src/platforms/aircraft/mig29/MiG29CockpitModel.js";

describe("MiG-29 neutral cockpit shell geometry", () => {
  it("builds a substantial, finite structural frame with realistic bounded proportions", () => {
    const shell = createMiG29CockpitShell();
    const meshes: THREE.Mesh[] = [];
    shell.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });

    expect(shell.name).toBe("mig29-9-13-cockpit-shell-frame");
    expect(shell.userData.visualMode).toBe("neutral-structural-blockout");
    expect(shell.userData.controlsIncluded).toBe(false);
    expect(meshes.length).toBeGreaterThanOrEqual(11);

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
      if (mesh.material instanceof THREE.MeshStandardMaterial || mesh.material instanceof THREE.MeshPhysicalMaterial) {
        expect(mesh.material.color.r).toBeCloseTo(mesh.material.color.g, 6);
        expect(mesh.material.color.g).toBeCloseTo(mesh.material.color.b, 6);
      }
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

  it("builds four individually angled front-panel plates with a wider, taller wraparound layout", () => {
    const shell = createMiG29CockpitShell();
    const expected: readonly [string, number][] = [
      ["mig29-cockpit-panel-port-outer", 0.54],
      ["mig29-cockpit-panel-port-inner", 0.25],
      ["mig29-cockpit-panel-center", 0],
      ["mig29-cockpit-panel-starboard", -0.36]
    ];
    const sections = shell.userData.panelSections as readonly {
      name: string;
      yawRad: number;
      minU: number;
      maxU: number;
      topV: number;
      bottomV: number;
    }[];
    expect(sections).toHaveLength(4);

    for (const [name, angle] of expected) {
      const panel = shell.getObjectByName(name) as THREE.Mesh | undefined;
      expect(panel).toBeInstanceOf(THREE.Mesh);
      expect(panel?.userData.panelYawRad).toBeCloseTo(angle, 6);
    }
    expect(sections[0]!.minU).toBeCloseTo(-0.52, 6);
    expect(sections[3]!.maxU).toBeCloseTo(0.52, 6);
    expect(sections[2]!.bottomV - sections[2]!.topV).toBeGreaterThan(0.40);
    expect(new Set(sections.map((section) => section.yawRad)).size).toBe(4);
  });

  it("cuts every circular and rectangular mount through its angled panel plate", () => {
    const shell = createMiG29CockpitShell();
    const cutouts = shell.userData.panelCutouts as readonly { panelPart: string; kind: string }[];
    expect(cutouts).toHaveLength(16);

    for (const panelName of [
      "panel-port-outer",
      "panel-port-inner",
      "panel-center",
      "panel-starboard"
    ]) {
      const mesh = shell.getObjectByName("mig29-cockpit-" + panelName) as THREE.Mesh | undefined;
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(cutouts.filter((cutout) => cutout.panelPart === panelName).length).toBeGreaterThan(0);
      // The extruded panel mesh includes its outer shell, opening walls and back faces.
      expect(mesh!.geometry.getAttribute("position").count).toBeGreaterThan(100);
    }
  });

  it("has deep blank mounting recesses in monochrome neutral-grey material", () => {
    const shell = createMiG29CockpitShell();
    const panel = shell.getObjectByName("mig29-cockpit-panel-center") as THREE.Mesh | undefined;
    const recess = shell.getObjectByName("mig29-cockpit-panel-recess") as THREE.Mesh | undefined;
    expect(panel).toBeInstanceOf(THREE.Mesh);
    expect(recess).toBeInstanceOf(THREE.Mesh);
    const panelMaterial = (panel as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const recessMaterial = (recess as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(recessMaterial.color.r).toBeLessThan(panelMaterial.color.r);
    expect(recessMaterial.color.r).toBeCloseTo(recessMaterial.color.g, 6);
    expect(recessMaterial.color.g).toBeCloseTo(recessMaterial.color.b, 6);
  });

  it("keeps outboard side consoles integrated within the cockpit tub", () => {
    const shell = createMiG29CockpitShell();
    const port = shell.getObjectByName("mig29-cockpit-port-console") as THREE.Mesh | undefined;
    const starboard = shell.getObjectByName("mig29-cockpit-starboard-console") as THREE.Mesh | undefined;
    expect(port).toBeInstanceOf(THREE.Mesh);
    expect(starboard).toBeInstanceOf(THREE.Mesh);

    const portSize = new THREE.Box3().setFromObject(port!).getSize(new THREE.Vector3());
    const starboardSize = new THREE.Box3().setFromObject(starboard!).getSize(new THREE.Vector3());
    expect(portSize.y).toBeLessThan(0.32);
    expect(starboardSize.y).toBeLessThan(0.32);
    expect(portSize.x).toBeLessThan(0.38);
    expect(starboardSize.x).toBeLessThan(0.38);
    expect(portSize.z).toBeGreaterThan(0.85);
    expect(starboardSize.z).toBeGreaterThan(0.85);
    const portBounds = new THREE.Box3().setFromObject(port!);
    const starboardBounds = new THREE.Box3().setFromObject(starboard!);
    expect(portBounds.max.y).toBeGreaterThan(-0.44);
    // The decks must sit outboard of the front-panel footprint and leave a clear central tub.
    expect(portBounds.min.x).toBeLessThan(-0.55);
    expect(portBounds.max.x).toBeLessThan(0);
    expect(starboardBounds.min.x).toBeGreaterThan(0);
    expect(starboardBounds.max.x).toBeGreaterThan(0.55);
    const yaw = shell.userData.consolePanelYawRad as { port: number; starboard: number };
    expect(yaw.port).toBeCloseTo(0.30, 6);
    expect(yaw.starboard).toBeCloseTo(Math.PI - 0.30, 6);
    expect(starboardBounds.min.x - portBounds.max.x).toBeGreaterThan(0.40);
  });

  it("uses tapered sidewall structure and a blank lower pedestal without raised side rails", () => {
    const shell = createMiG29CockpitShell();
    expect(shell.getObjectByName("mig29-cockpit-tub")).toBeInstanceOf(THREE.Mesh);
    expect(shell.getObjectByName("mig29-cockpit-central-pedestal")).toBeInstanceOf(THREE.Mesh);
    expect(shell.children.some((child) => child.name.includes("sill-rail"))).toBe(false);
  });

  it("keeps clear neutral canopy glazing and removes the forward transverse canopy hoop", () => {
    const shell = createMiG29CockpitShell();
    const canopy = shell.getObjectByName("mig29-cockpit-canopy-glazing");
    expect(canopy).toBeInstanceOf(THREE.Mesh);
    expect(((canopy as THREE.Mesh).material as THREE.Material).transparent).toBe(true);
    expect(shell.getObjectByName("mig29-cockpit-glare-brow")).toBeInstanceOf(THREE.Mesh);
    expect(shell.getObjectByName("mig29-cockpit-hud-support")).toBeInstanceOf(THREE.Mesh);
    expect(shell.getObjectByName("mig29-cockpit-hud")).toBeUndefined();
    const brow = shell.getObjectByName("mig29-cockpit-glare-brow") as THREE.Mesh;
    const browSize = new THREE.Box3().setFromObject(brow).getSize(new THREE.Vector3());
    expect(browSize.y).toBeLessThan(0.02);
    expect(browSize.z).toBeLessThan(0.045);
    const hudSupport = shell.getObjectByName("mig29-cockpit-hud-support") as THREE.Mesh;
    const hudSize = new THREE.Box3().setFromObject(hudSupport).getSize(new THREE.Vector3());
    expect(hudSize.y).toBeLessThan(0.12);
    expect(shell.userData.frontCanopyBowIncluded).toBe(false);
  });

  it("keeps the major structural assemblies separately addressable", () => {
    const shell = createMiG29CockpitShell();
    const names = shell.children.map((child) => child.name);
    for (const name of [
      "mig29-cockpit-tub",
      "mig29-cockpit-panel-port-outer",
      "mig29-cockpit-panel-port-inner",
      "mig29-cockpit-panel-center",
      "mig29-cockpit-panel-starboard",
      "mig29-cockpit-panel-support",
      "mig29-cockpit-panel-recess",
      "mig29-cockpit-glare-brow",
      "mig29-cockpit-hud-support",
      "mig29-cockpit-port-console",
      "mig29-cockpit-starboard-console",
      "mig29-cockpit-central-pedestal",
      "mig29-cockpit-seat-frame",
      "mig29-cockpit-canopy-frame",
      "mig29-cockpit-canopy-glazing"
    ]) {
      expect(names).toContain(name);
    }
  });
});
