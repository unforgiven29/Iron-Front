/**
 * Provisional Three.js cockpit view (see docs/architecture-decisions/ADR-0002).
 *
 * Presentation only: it reads an aircraft snapshot and terrain queries, and sends pilot inputs
 * and switch requests. It never changes simulation state directly. The cockpit comes from a
 * CockpitLayout (data), so this file has no aircraft-specific code.
 *
 * Frames: simulation ENU (x east, y north, z up) maps to Three.js (x = east, y = up, z = -north).
 * A floating origin keeps the camera at the scene origin and moves the world, so large
 * coordinates do not lose float32 precision on the GPU.
 */
import * as THREE from "three";
import type { Quaternion, Vector3 } from "../../core/coordinates/CoordinateFrames.js";
import { rotateVector } from "../../physics/rigidbody/RigidBody.js";
import type { TerrainSurface } from "../../world/terrain/Terrain.js";
import type { CockpitLayout, CockpitPart } from "./CockpitLayout.js";

/** What the view needs from an aircraft snapshot (structural, platform-neutral). */
export interface CockpitViewSnapshot {
  readonly positionEnuM: Vector3;
  readonly velocityEnuMps: Vector3;
  readonly bodyToWorld: Quaternion;
  readonly pilot: { readonly pitch: number; readonly roll: number; readonly yaw: number };
  readonly throttle: number;
  readonly switches: Readonly<Record<string, string>>;
}

export interface HudData {
  readonly airspeedKt: number;
  readonly mach: number;
  readonly altitudeFt: number;
  readonly headingDeg: number;
  readonly nzG: number;
  readonly alphaDeg: number;
  readonly warnings: readonly { readonly text: string; readonly level: "caution" | "warning" }[];
}

export interface MfdPage {
  readonly title: string;
  readonly lines: readonly string[];
}

export interface CockpitViewSource {
  snapshot(): CockpitViewSnapshot;
  hud(): HudData;
  mfd(screen: string): MfdPage;
  /** Request the next position of a switch (cockpit click). */
  cycleSwitch(switchId: string): void;
}

const enuToThree = (v: Vector3): THREE.Vector3 => new THREE.Vector3(v[0], v[2], -v[1]);

export class ThreeCockpitView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world = new THREE.Group();
  private readonly cockpit = new THREE.Group();
  private readonly animated: { part: CockpitPart; mesh: THREE.Mesh; base: THREE.Quaternion; basePos: THREE.Vector3 }[] = [];
  private readonly screens = new Map<string, { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture }>();
  private readonly hudCanvas: HTMLCanvasElement;
  private readonly raycaster = new THREE.Raycaster();
  private frame = 0;

  public constructor(
    private readonly container: HTMLElement,
    private readonly layout: CockpitLayout,
    terrain: TerrainSurface,
    terrainBounds: { readonly minM: readonly [number, number]; readonly maxM: readonly [number, number]; readonly stepM: number },
    private readonly source: CockpitViewSource
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.domElement.className = "cockpit-gl";
    this.hudCanvas = document.createElement("canvas");
    this.hudCanvas.className = "cockpit-hud";
    container.append(this.renderer.domElement, this.hudCanvas);

    const sky = new THREE.Color("#8fb4d6");
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 3000, 30000);
    this.scene.add(new THREE.HemisphereLight("#dfeaf5", "#4a5a3a", 1.4));
    const sun = new THREE.DirectionalLight("#ffffff", 1.6);
    sun.position.set(0.4, 1, 0.3);
    this.scene.add(sun);

    this.camera = new THREE.PerspectiveCamera(layout.fieldOfViewDeg, 16 / 9, 0.05, 60000);
    this.scene.add(this.camera, this.world);
    this.camera.add(this.cockpit);
    const cockpitLight = new THREE.PointLight("#ffffff", 0.6, 3);
    this.camera.add(cockpitLight);

    this.world.add(buildTerrainMesh(terrain, terrainBounds));
    this.buildCockpit();
    this.renderer.domElement.addEventListener("click", (e) => this.onClick(e));
  }

  /** Render one frame from the current snapshot. */
  public render(): void {
    const s = this.source.snapshot();
    this.resize();
    const q = s.bodyToWorld;
    // Camera basis in Three.js coordinates: x = body right, y = body up (-down), z = body aft.
    const right = enuToThree(rotateVector(q, [0, 1, 0]));
    const up = enuToThree(rotateVector(q, [0, 0, -1]));
    const back = enuToThree(rotateVector(q, [-1, 0, 0]));
    this.camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, back));
    const eyeWorld = rotateVector(q, this.layout.eyeFromCgM as Vector3);
    const eye = enuToThree([s.positionEnuM[0] + eyeWorld[0], s.positionEnuM[1] + eyeWorld[1], s.positionEnuM[2] + eyeWorld[2]]);
    this.world.position.copy(eye).multiplyScalar(-1);

    this.animateParts(s);
    if (this.frame++ % 6 === 0) this.drawScreens();
    this.renderer.render(this.scene, this.camera);
    this.drawHud(s);
  }

  public dispose(): void {
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.hudCanvas.remove();
  }

  // ---------------- cockpit ----------------

  private bodyToCamera(p: readonly [number, number, number]): THREE.Vector3 {
    return new THREE.Vector3(p[1], -p[2], -p[0]);
  }

  private buildCockpit(): void {
    for (const part of this.layout.parts) {
      let geometry: THREE.BufferGeometry;
      let material: THREE.Material;
      const [a, b, c] = part.sizeM;
      if (part.kind === "box") {
        geometry = new THREE.BoxGeometry(b, c, a); // camera frame: x = body y, y = body z, z = body x
        material = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.85, metalness: 0.1 });
      } else if (part.kind === "cylinder") {
        geometry = new THREE.CylinderGeometry(a, a, b, 16);
        material = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.7 });
      } else if (part.kind === "glass") {
        geometry = new THREE.PlaneGeometry(a, b);
        material = new THREE.MeshBasicMaterial({ color: part.color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
      } else {
        geometry = new THREE.PlaneGeometry(a, b);
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        this.screens.set(part.screen ?? part.id, { canvas, texture });
        material = new THREE.MeshBasicMaterial({ map: texture });
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(this.bodyToCamera(part.positionM));
      const [rx, ry, rz] = part.rotationRad ?? [0, 0, 0];
      // Body x -> camera -z, body y -> camera x, body z -> camera -y.
      mesh.quaternion.setFromEuler(new THREE.Euler(ry, -rz, -rx, "XYZ"));
      mesh.userData = { partId: part.id };
      this.cockpit.add(mesh);
      if (part.binding) this.animated.push({ part, mesh, base: mesh.quaternion.clone(), basePos: mesh.position.clone() });
    }
  }

  private animateParts(s: CockpitViewSnapshot): void {
    for (const { part, mesh, base, basePos } of this.animated) {
      const binding = part.binding;
      if (!binding) continue;
      if (binding.kind === "stick") {
        // Stick back tilts the top toward the pilot; stick right tilts it right.
        const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-s.pilot.pitch * 0.3, 0, -s.pilot.roll * 0.3));
        mesh.quaternion.copy(base).premultiply(tilt);
      } else if (binding.kind === "throttle") {
        mesh.position.copy(basePos).add(new THREE.Vector3(0, 0, -s.throttle * 0.1));
      } else {
        const i = Math.max(0, binding.positions.indexOf(s.switches[binding.switchId] ?? ""));
        mesh.position.copy(basePos).add(new THREE.Vector3(0, 0.012 * i, 0));
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissive = new THREE.Color(i > 0 ? part.color : "#000000");
        mat.emissiveIntensity = i > 0 ? 0.8 : 0;
      }
    }
  }

  private onClick(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    for (const hit of this.raycaster.intersectObjects(this.cockpit.children)) {
      const part = this.layout.parts.find((p) => p.id === hit.object.userData["partId"]);
      if (part?.binding?.kind === "switch") {
        this.source.cycleSwitch(part.binding.switchId);
        return;
      }
    }
  }

  private drawScreens(): void {
    for (const [id, { canvas, texture }] of this.screens) {
      const g = canvas.getContext("2d");
      if (!g) continue;
      const page = this.source.mfd(id);
      g.fillStyle = "#06120a";
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "#2f6b45";
      g.strokeRect(4, 4, 248, 248);
      g.fillStyle = "#8ff0a8";
      g.font = "bold 22px ui-monospace, Menlo, monospace";
      g.fillText(page.title, 14, 34);
      g.font = "17px ui-monospace, Menlo, monospace";
      page.lines.slice(0, 10).forEach((line, i) => g.fillText(line, 14, 66 + i * 19));
      texture.needsUpdate = true;
    }
  }

  // ---------------- HUD (collimated overlay) ----------------

  private resize(): void {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
      this.hudCanvas.width = Math.round(w * dpr);
      this.hudCanvas.height = Math.round(h * dpr);
    }
  }

  private project(dirEnu: Vector3): [number, number] | null {
    const v = enuToThree(dirEnu).normalize().multiplyScalar(1000).project(this.camera);
    if (v.z > 1) return null;
    return [((v.x + 1) / 2) * this.hudCanvas.width, ((1 - v.y) / 2) * this.hudCanvas.height];
  }

  private drawHud(s: CockpitViewSnapshot): void {
    const g = this.hudCanvas.getContext("2d");
    if (!g) return;
    const w = this.hudCanvas.width, h = this.hudCanvas.height;
    g.clearRect(0, 0, w, h);
    const d = this.source.hud();
    const u = h / 100;
    const color = "#7dff9a";
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = Math.max(1.5, u * 0.18);
    g.font = `600 ${Math.round(u * 2.2)}px ui-monospace, Menlo, monospace`;
    g.textBaseline = "middle";

    // Symbology is clipped to the HUD's field of view around boresight.
    const bore = this.project(rotateVector(s.bodyToWorld, [1, 0, 0]));
    if (!bore) return;
    const [cx, cy] = bore;
    g.save();
    g.beginPath();
    g.rect(cx - 22 * u, cy - 26 * u, 44 * u, 44 * u);
    g.clip();

    // Gun cross.
    g.beginPath();
    g.moveTo(cx - 1.5 * u, cy); g.lineTo(cx + 1.5 * u, cy);
    g.moveTo(cx, cy - 1.5 * u); g.lineTo(cx, cy + 1.5 * u);
    g.stroke();

    // Pitch ladder: lines at constant elevation, centred on the current heading.
    const fwd = rotateVector(s.bodyToWorld, [1, 0, 0]);
    const heading = Math.atan2(fwd[0], fwd[1]);
    for (let el = -90; el <= 90; el += 5) {
      const e = (el * Math.PI) / 180;
      const dir = (az: number): Vector3 => [Math.cos(e) * Math.sin(az), Math.cos(e) * Math.cos(az), Math.sin(e)];
      const spread = Math.min(0.5, 0.09 / Math.max(0.15, Math.cos(e)));
      const a = this.project(dir(heading - spread)), b = this.project(dir(heading + spread));
      if (!a || !b) continue;
      if (Math.hypot(a[0] - cx, a[1] - cy) > 40 * u) continue;
      g.setLineDash(el < 0 ? [u, u * 0.7] : []);
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
      if (el !== 0) { g.textAlign = "left"; g.fillText(String(Math.abs(el)), b[0] + u, b[1]); }
    }
    g.setLineDash([]);

    // Flight-path marker.
    if (Math.hypot(...s.velocityEnuMps) > 1) {
      const f = this.project(s.velocityEnuMps);
      if (f) {
        g.beginPath();
        g.arc(f[0], f[1], 1.1 * u, 0, Math.PI * 2);
        g.moveTo(f[0] - 3 * u, f[1]); g.lineTo(f[0] - 1.1 * u, f[1]);
        g.moveTo(f[0] + 1.1 * u, f[1]); g.lineTo(f[0] + 3 * u, f[1]);
        g.moveTo(f[0], f[1] - 1.1 * u); g.lineTo(f[0], f[1] - 2.4 * u);
        g.stroke();
      }
    }

    // Speed and altitude scales, heading, data block.
    const box = (text: string, x: number, y: number, align: CanvasTextAlign) => {
      g.textAlign = align;
      const tw = g.measureText(text).width + u;
      const bx = align === "right" ? x - tw : x;
      g.strokeRect(bx - 0.5 * u, y - 1.6 * u, tw + u, 3.2 * u);
      g.fillText(text, align === "right" ? x : x + 0.5 * u, y);
    };
    box(d.airspeedKt.toFixed(0), cx - 16 * u, cy - 4 * u, "left");
    box(d.altitudeFt.toFixed(0), cx + 16 * u, cy - 4 * u, "right");
    g.textAlign = "center";
    g.fillText(String(Math.round(((d.headingDeg % 360) + 360) % 360)).padStart(3, "0"), cx, cy - 22 * u);
    g.textAlign = "left";
    g.fillText(`${d.nzG.toFixed(1)}G`, cx - 20 * u, cy + 8 * u);
    g.fillText(`M ${d.mach.toFixed(2)}`, cx - 20 * u, cy + 11 * u);
    g.fillText(`α ${d.alphaDeg.toFixed(1)}`, cx - 20 * u, cy + 14 * u);
    g.restore();

    d.warnings.forEach((wn, i) => {
      g.textAlign = "center";
      g.font = `700 ${Math.round(u * 2.6)}px ui-monospace, Menlo, monospace`;
      g.fillStyle = wn.level === "warning" ? "#ff8a7a" : "#ffd36e";
      g.fillText(wn.text, w / 2, (5 + i * 3.4) * u);
    });
  }
}

function buildTerrainMesh(terrain: TerrainSurface, b: { readonly minM: readonly [number, number]; readonly maxM: readonly [number, number]; readonly stepM: number }): THREE.Mesh {
  const nx = Math.floor((b.maxM[0] - b.minM[0]) / b.stepM) + 1;
  const ny = Math.floor((b.maxM[1] - b.minM[1]) / b.stepM) + 1;
  const positions = new Float32Array(nx * ny * 3);
  const colors = new Float32Array(nx * ny * 3);
  const valid = new Uint8Array(nx * ny);
  const low = new THREE.Color("#4f6b3a"), mid = new THREE.Color("#7c7a52"), high = new THREE.Color("#b7b2a3");
  let minH = Infinity, maxH = -Infinity;
  const heights = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const s = terrain.sample(b.minM[0] + i * b.stepM, b.minM[1] + j * b.stepM);
    const k = j * nx + i;
    if (s.status === "valid") { valid[k] = 1; heights[k] = s.heightM; minH = Math.min(minH, s.heightM); maxH = Math.max(maxH, s.heightM); }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    const x = b.minM[0] + i * b.stepM, y = b.minM[1] + j * b.stepM;
    positions.set([x, heights[k] as number, -y], k * 3);
    const t = maxH > minH ? ((heights[k] as number) - minH) / (maxH - minH) : 0;
    const c = t < 0.5 ? low.clone().lerp(mid, t * 2) : mid.clone().lerp(high, (t - 0.5) * 2);
    colors.set([c.r, c.g, c.b], k * 3);
  }
  // Triangles only where all corners have valid data: missing terrain stays a hole, never flat.
  const index: number[] = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, bb = a + 1, c = a + nx, d = c + 1;
    if (valid[a] && valid[bb] && valid[c] && valid[d]) index.push(a, bb, c, bb, d, c); // counter-clockwise seen from above
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}
