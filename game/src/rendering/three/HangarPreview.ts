/**
 * Menu backdrop: a slowly turning exterior model on a dark hangar floor (presentation only).
 */
import * as THREE from "three";
import { buildAircraftModel } from "./models/AircraftModels.js";

export class HangarPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);
  private readonly turntable = new THREE.Group();
  private model: THREE.Group | null = null;
  private raf = -1;
  private running = false;
  private angle = 0.6;
  private last = 0;

  public constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.domElement.className = "hangar-gl";
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.append(this.renderer.domElement);
    this.scene.fog = new THREE.Fog("#070b0f", 40, 120);
    this.scene.add(new THREE.HemisphereLight("#cfe0f0", "#20262c", 1.1));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(-12, 18, -6);
    const rim = new THREE.DirectionalLight("#7fb6ff", 1.4);
    rim.position.set(10, 6, 14);
    this.scene.add(key, rim, this.turntable);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: "#0d1318", roughness: 0.85, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.2;
    const grid = new THREE.GridHelper(80, 40, "#1f3a4d", "#132430");
    grid.position.y = -2.19;
    this.scene.add(floor, grid);
    this.camera.position.set(0, 4.5, 30);
    this.camera.lookAt(0, -0.3, 0);
  }

  public show(modelId: string | undefined): void {
    if (this.model) this.turntable.remove(this.model);
    this.model = modelId ? buildAircraftModel(modelId) : null;
    if (this.model) {
      const burner = this.model.getObjectByName("afterburner");
      if (burner) burner.visible = false;
      this.model.traverse((o) => { if (o.name === "afterburner") o.visible = false; });
      this.turntable.add(this.model);
    }
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.angle += dt * 0.18;
      this.turntable.rotation.y = this.angle;
      this.resize();
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  public stop(): void { this.running = false; cancelAnimationFrame(this.raf); }

  public dispose(): void { this.stop(); this.renderer.dispose(); this.renderer.domElement.remove(); }

  private resize(): void {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x === w && size.y === h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    // Keep the aircraft framed on narrow screens.
    this.camera.position.z = this.camera.aspect < 1 ? 44 : 30;
    this.camera.updateProjectionMatrix();
  }
}
