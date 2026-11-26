/**
 * Explosion visual effects (owner: rendering; presentation only). The simulation decides that
 * something detonated or was destroyed; this only draws it: a bright fireball of additive
 * particles, a short light flash, a few burning debris streaks and dark smoke that lingers.
 * Sizes are visual choices, not warhead or fuel data, and nothing here feeds back into the sim.
 */
import * as THREE from "three";
import type { Vector3 } from "../../core/coordinates/CoordinateFrames.js";

export type ExplosionKind = "warhead" | "aircraft" | "ground";
export interface DecoyVisual { readonly positionEnuM: Vector3; readonly kind: "flare" | "chaff"; readonly ageS: number; readonly lifeS: number }
export interface ExplosionRequest { readonly positionEnuM: Vector3; readonly kind: ExplosionKind }

interface Particle { p: THREE.Vector3; v: THREE.Vector3; born: number; life: number; size: number; fire: number; drag: number; fall: number }

const STYLE: Readonly<Record<ExplosionKind, { fire: number; smoke: number; debris: number; radius: number; light: number }>> = {
  warhead: { fire: 60, smoke: 25, debris: 6, radius: 9, light: 300 },
  aircraft: { fire: 160, smoke: 90, debris: 26, radius: 22, light: 900 },
  ground: { fire: 90, smoke: 70, debris: 14, radius: 14, light: 500 }
};

const MAX_PARTICLES = 20000;
/** Write rows into the fixed-size buffers (allocated once) and upload only the used range. */
function upload(pts: THREE.Points, rows: readonly number[][]): void {
  const geo = pts.geometry;
  if (!geo.getAttribute("position")) {
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(THREE.DynamicDrawUsage));
    for (const k of ["size", "fire", "fade"]) geo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1).setUsage(THREE.DynamicDrawUsage));
  }
  const n = Math.min(rows.length, MAX_PARTICLES);
  const attrs = ["position", "size", "fire", "fade"].map((k) => geo.getAttribute(k) as THREE.BufferAttribute);
  const [pos, size, fire, fade] = attrs.map((a) => a.array as Float32Array) as [Float32Array, Float32Array, Float32Array, Float32Array];
  for (let i = 0; i < n; i++) { const r = rows[i]!; pos[i * 3] = r[0]!; pos[i * 3 + 1] = r[1]!; pos[i * 3 + 2] = r[2]!; size[i] = r[3]!; fire[i] = r[4]!; fade[i] = r[5]!; }
  attrs.forEach((a, j) => { a.addUpdateRange(0, j === 0 ? n * 3 : n); a.needsUpdate = true; });
  geo.setDrawRange(0, n);
}

const enuToThree = (v: Vector3): THREE.Vector3 => new THREE.Vector3(v[0], v[2], -v[1]);
const rnd = () => Math.random() * 2 - 1;
function randomDir(): THREE.Vector3 {
  const v = new THREE.Vector3(rnd(), rnd(), rnd());
  return v.lengthSq() > 1e-6 ? v.normalize() : new THREE.Vector3(0, 1, 0);
}

export class Explosions {
  private readonly particles: Particle[] = [];
  private readonly flashes: { light: THREE.PointLight; born: number; peak: number }[] = [];
  /** Smoke (normal blending) and fire (additive, drawn after the smoke so it glows through). */
  private readonly smokePts: THREE.Points;
  private readonly firePts: THREE.Points;

  public constructor(private readonly parent: THREE.Object3D) {
    // Point size in pixels ≈ diameter (m) × 600 / distance (m) for the cockpit field of view.
    const vs = "attribute float size; attribute float fire; attribute float fade; varying float vFire; varying float vFade; void main(){ vFire = fire; vFade = fade; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(size * 600.0 / -mv.z, 1.0, 1024.0); gl_Position = projectionMatrix * mv; }";
    const make = (fragmentShader: string, blending: THREE.Blending, order: number) => {
      const pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending, vertexShader: vs, fragmentShader }));
      pts.frustumCulled = false;
      pts.renderOrder = order;
      parent.add(pts);
      return pts;
    };
    this.smokePts = make("varying float vFire; varying float vFade; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard; float soft = 1.0 - smoothstep(0.1, 0.5, r); gl_FragColor = vec4(mix(vec3(0.18,0.17,0.16), vec3(0.78,0.8,0.82), vFire), soft * vFade * 0.5); }", THREE.NormalBlending, 2);
    // Fire: white-yellow core cooling to orange and deep red.
    this.firePts = make("varying float vFire; varying float vFade; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard; float soft = 1.0 - smoothstep(0.0, 0.5, r); vec3 hot = mix(vec3(0.85,0.18,0.03), vec3(1.0,0.92,0.6), clamp(vFire*1.5-0.3,0.0,1.0)); gl_FragColor = vec4(hot * soft * soft * vFade * 0.28, 1.0); }", THREE.AdditiveBlending, 3);
  }

  public spawn(req: ExplosionRequest): void {
    const now = performance.now() / 1000, st = STYLE[req.kind], c = enuToThree(req.positionEnuM);
    for (let i = 0; i < st.fire; i++) {
      const v = randomDir().multiplyScalar(st.radius * (0.6 + Math.random()) * 1.6);
      if (req.kind === "ground" && v.y < 0) v.y = -v.y;
      this.particles.push({ p: c.clone(), v, born: now + Math.random() * 0.08, life: 0.7 + Math.random() * 0.8, size: st.radius * (0.5 + Math.random() * 0.6), fire: 1, drag: 2.5, fall: 0 });
    }
    for (let i = 0; i < st.smoke; i++) {
      const v = randomDir().multiplyScalar(st.radius * 0.6 * Math.random());
      v.y += 1.5;
      this.particles.push({ p: c.clone().add(randomDir().multiplyScalar(st.radius * 0.4)), v, born: now + 0.15 + Math.random() * 0.4, life: 5 + Math.random() * 6, size: st.radius * (0.6 + Math.random() * 0.6), fire: 0, drag: 0.6, fall: -0.6 });
    }
    for (let i = 0; i < st.debris; i++) {
      const v = randomDir().multiplyScalar(40 + Math.random() * 80);
      if (req.kind === "ground") v.y = Math.abs(v.y);
      this.particles.push({ p: c.clone(), v, born: now, life: 1.5 + Math.random() * 1.5, size: 1.5 + Math.random() * 1.5, fire: 0.85, drag: 0.4, fall: 9.81 });
    }
    const light = new THREE.PointLight("#ffb060", 0, st.light, 1.5);
    light.position.copy(c);
    this.parent.add(light);
    this.flashes.push({ light, born: now, peak: req.kind === "warhead" ? 40 : 90 });
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
  }

  /** Advance and upload the particles (call once per rendered frame); decoys are drawn this frame only. */
  public update(dt: number, decoys: readonly DecoyVisual[] = []): void {
    const now = performance.now() / 1000;
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]!, a = now - f.born;
      f.light.intensity = f.peak * Math.max(0, 1 - a / 0.5) ** 2;
      if (a > 0.5) { this.parent.remove(f.light); f.light.dispose(); this.flashes.splice(i, 1); }
    }
    const live = this.particles.filter((p) => now - p.born < p.life);
    this.particles.length = 0;
    this.particles.push(...live);
    const fireRows: number[][] = [], smokeRows: number[][] = [];
    for (const p of live) {
      const age = now - p.born;
      if (age < 0) continue;
      p.v.multiplyScalar(Math.exp(-p.drag * dt));
      p.v.y -= p.fall * dt;
      p.p.addScaledVector(p.v, dt);
      const t = age / p.life;
      if (p.fire > 0) {
        // Fireballs swell fast then shrink as they cool; debris (small) stays small.
        const size = p.size < 4 ? p.size : p.size * (0.5 + 1.5 * Math.min(1, t * 4)) * (1 - 0.4 * t);
        fireRows.push([p.p.x, p.p.y, p.p.z, size, p.fire * Math.max(0, 1 - t * 1.2), Math.max(0, 1 - t) ** 1.5]);
      } else {
        smokeRows.push([p.p.x, p.p.y, p.p.z, p.size * (0.6 + 1.4 * Math.sqrt(t)), 0, Math.min(1, age * 1.5) * (1 - t)]);
      }
    }
    for (const d of decoys) {
      const p = enuToThree(d.positionEnuM), t = d.ageS / Math.max(0.1, d.lifeS);
      // Flare: small white-hot point with a flicker; chaff: thin grey cloud that blooms and fades.
      if (d.kind === "flare") {
        // Two stacked points: a wide glow and a hot core, so the flare reads at a distance.
        const f = Math.max(0.3, 1 - t * t) * (0.85 + Math.random() * 0.3);
        fireRows.push([p.x, p.y, p.z, 14, 0.6, f], [p.x, p.y, p.z, 5, 1, f * 3]);
      } else smokeRows.push([p.x, p.y, p.z, 4 + 18 * Math.sqrt(t), 1, 0.5 * (1 - t)]);
    }
    upload(this.firePts, fireRows);
    upload(this.smokePts, smokeRows);
  }

  public get activeParticles(): number { return this.particles.length; }
}
