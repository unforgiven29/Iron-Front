/**
 * Procedural exterior models (owner: rendering). Presentation only.
 *
 * Original, stylised low-poly geometry built in code: proportions follow the aircraft's general
 * arrangement closely enough to recognise the type, but these are NOT measured geometry, are not
 * used by any physics, sensor or signature model, and carry fictional paint schemes and markings.
 * The registry maps a model id (from an aircraft package or a world entity) to a builder, so shared
 * rendering code never branches on aircraft names.
 *
 * Model frame (same as the other world meshes): x = right, y = up, z = aft (nose toward −z), metres,
 * origin near the centre of gravity.
 */
import * as THREE from "three";

interface Paint { readonly base: string; readonly belly: string; readonly accent: string; readonly canopy: string; readonly marking: string }

const PAINTS: Readonly<Record<string, Paint>> = {
  /** Two-tone air-superiority grey. */
  "f16c": { base: "#8d969e", belly: "#a9b1b8", accent: "#5d666e", canopy: "#c9a65a", marking: "#3a4a5c" },
  /** Fictional aggressor "splinter" scheme for hostile Vipers. */
  "f16c-aggressor": { base: "#6f7f6a", belly: "#9aa59a", accent: "#3f4a3c", canopy: "#c9a65a", marking: "#b8342c" },
  /** Fictional two-tone grey-green. */
  "mig29": { base: "#7c8b8a", belly: "#b9c4c4", accent: "#566463", canopy: "#7fa3b8", marking: "#b8342c" }
};

const mats = new Map<string, THREE.Material>();
function mat(color: string, kind: "paint" | "metal" | "glass" | "dark" | "glow" = "paint"): THREE.Material {
  const key = `${kind}:${color}`;
  let m = mats.get(key);
  if (!m) {
    m = kind === "glass" ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
      : kind === "metal" ? new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.8 })
      : kind === "dark" ? new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide })
      : kind === "glow" ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.15, side: THREE.DoubleSide });
    mats.set(key, m);
  }
  return m;
}

/** Body of revolution along z from a (z, radius) profile, squashed by (sx, sy). */
function lathe(profile: readonly (readonly [number, number])[], sx: number, sy: number, material: THREE.Material, segments = 20): THREE.Mesh {
  const pts = profile.map(([z, r]) => new THREE.Vector2(Math.max(0.001, r), z));
  const g = new THREE.LatheGeometry(pts, segments);
  g.rotateX(Math.PI / 2); // lathe axis y → z (the nose, at negative profile z, stays at −z)
  g.scale(sx, sy, 1);
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

/** Horizontal plate from a planform polygon (x = span, z = chord), thickness t. */
function planform(points: readonly (readonly [number, number])[], t: number, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: t * 0.4, bevelSize: t * 0.4, bevelSegments: 1 });
  // Shape (x, y=z-chord) → rotate so shape y maps to +z and the extrusion becomes −y.
  g.rotateX(Math.PI / 2);
  g.translate(0, t / 2, 0);
  return new THREE.Mesh(g, material);
}

/** Vertical plate from a side-view polygon (z = chord, y = height), thickness t, centred on x = 0. */
function sideplate(points: readonly (readonly [number, number])[], t: number, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: t * 0.4, bevelSize: t * 0.3, bevelSegments: 1 });
  g.rotateY(-Math.PI / 2); // shape x → z, extrusion → −x
  g.translate(t / 2, 0, 0);
  return new THREE.Mesh(g, material);
}

const mirrorX = (pts: readonly (readonly [number, number])[]) => pts.map(([x, z]) => [-x, z] as const).reverse();

function canopy(at: readonly [number, number, number], size: readonly [number, number, number], color: string): THREE.Mesh {
  const g = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.Mesh(g, mat(color, "glass"));
  m.scale.set(size[0], size[1], size[2]);
  m.position.set(at[0], at[1], at[2]);
  return m;
}

function nozzle(x: number, y: number, z: number, r: number, length: number): THREE.Group {
  const grp = new THREE.Group();
  const petals = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r, length, 18, 1, true), mat("#4b4f53", "metal"));
  petals.rotation.x = Math.PI / 2;
  petals.position.set(x, y, z + length / 2);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(r * 0.8, 18), mat("#1a1612", "dark"));
  inner.position.set(x, y, z + 0.15);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 18), mat("#ff9a3c", "glow"));
  glow.position.set(x, y, z + 0.2);
  glow.name = "afterburner";
  grp.add(petals, inner, glow);
  return grp;
}

/** Simple rail-mounted missile shape for wingtip/pylon stores (visual only). */
function store(x: number, y: number, z: number, length: number, r: number, color = "#e2e2da"): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, length, 10), mat(color));
  body.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(r, r * 4, 10), mat("#9a9a92"));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -length / 2 - r * 2;
  const fins = new THREE.Mesh(new THREE.BoxGeometry(r * 7, 0.02, r * 3), mat(color));
  fins.position.z = length / 2 - r * 2;
  const fins2 = fins.clone();
  fins2.rotation.z = Math.PI / 2;
  g.add(body, nose, fins, fins2);
  g.position.set(x, y, z);
  return g;
}

function roundel(x: number, y: number, z: number, r: number, color: string, normal: "up" | "side"): THREE.Mesh {
  // Fictional marking: a plain disc with a ring.
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.45, r, 20), mat(color));
  m.position.set(x, y, z);
  if (normal === "up") m.rotation.x = -Math.PI / 2;
  else m.rotation.y = Math.sign(x || 1) * Math.PI / 2;
  return m;
}

/** Single-engine lightweight fighter with a chin intake, blended LERX and a single fin (F-16 style). */
function buildViper(p: Paint): THREE.Group {
  const g = new THREE.Group();
  const base = mat(p.base), belly = mat(p.belly), accent = mat(p.accent);
  // Fuselage (nose at z = −7.5).
  g.add(lathe([[-7.6, 0], [-7.2, 0.18], [-6.6, 0.36], [-5.8, 0.52], [-4.8, 0.66], [-3.6, 0.76], [-2, 0.82], [1, 0.84], [4, 0.8], [5.6, 0.7], [6.6, 0.6], [7.0, 0.56]], 1, 0.92, base));
  // Radome.
  const radome = lathe([[-7.62, 0], [-7.2, 0.18], [-6.6, 0.36], [-6.2, 0.45]], 1.01, 0.93, accent);
  g.add(radome);
  // Spine fairing.
  const spine = lathe([[-3.8, 0], [-2.6, 0.32], [2, 0.36], [5.4, 0.2], [6.0, 0]], 0.9, 1, base, 12);
  spine.position.y = 0.55;
  g.add(spine);
  // Chin intake: a flattened tube under the forward fuselage, open at the front.
  const intake = lathe([[-3.4, 0.5], [-2.6, 0.55], [1.5, 0.55], [3, 0.4]], 1.05, 0.72, belly, 16);
  intake.position.y = -0.62;
  g.add(intake);
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), mat("#121212", "dark"));
  mouth.scale.set(1.05, 0.72, 1);
  mouth.position.set(0, -0.62, -3.38);
  mouth.rotation.y = Math.PI;
  g.add(mouth);
  // Wing + LERX (one planform per side), slight thickness.
  const wing: [number, number][] = [[0.55, -4.9], [0.95, -2.4], [1.2, -0.7], [4.75, 2.45], [4.75, 3.35], [0.6, 3.75]];
  g.add(planform(wing, 0.12, base), planform(mirrorX(wing), 0.12, base));
  // Horizontal tails (slight anhedral).
  const stab: [number, number][] = [[0.6, 4.6], [2.95, 6.3], [2.95, 7.05], [0.6, 7.3]];
  const sl = planform(stab, 0.08, base), sr = planform(mirrorX(stab), 0.08, base);
  sl.rotation.z = -0.06; sr.rotation.z = 0.06;
  sl.position.y = sr.position.y = -0.1;
  g.add(sl, sr);
  // Vertical fin and rudder.
  const fin = sideplate([[3.0, 0.6], [5.7, 3.9], [6.55, 3.9], [6.95, 0.6]], 0.12, base);
  const rudderLine = sideplate([[6.15, 0.9], [6.5, 3.5], [6.62, 3.5], [6.9, 0.9]], 0.13, accent);
  g.add(fin, rudderLine);
  // Ventral fins.
  for (const s of [-1, 1]) {
    const v = sideplate([[4.6, -0.45], [5.5, -1.15], [6.05, -1.15], [6.05, -0.45]], 0.06, accent);
    v.position.x = s * 0.55;
    v.rotation.z = s * 0.45;
    g.add(v);
  }
  // Bubble canopy (gold tint), frameless.
  g.add(canopy([0, 0.55, -4.3], [0.46, 0.56, 1.65], p.canopy));
  // Nozzle.
  g.add(nozzle(0, 0, 7.0, 0.56, 0.95));
  // Wingtip rails + stores.
  for (const s of [-1, 1]) g.add(store(s * 4.95, 0.02, 2.4, 2.9, 0.065));
  for (const s of [-1, 1]) g.add(store(s * 3.4, -0.35, 1.6, 3.5, 0.09));
  // Markings (fictional).
  g.add(roundel(3.1, 0.2, 2.4, 0.38, p.marking, "up"), roundel(-3.1, 0.2, 2.4, 0.38, p.marking, "up"));
  return g;
}

/** Twin-engine fighter with under-LERX intakes, widely spaced nacelles and twin fins (MiG-29 style). */
function buildFulcrum(p: Paint): THREE.Group {
  const g = new THREE.Group();
  const base = mat(p.base), belly = mat(p.belly), accent = mat(p.accent);
  // Forward fuselage / cockpit section (nose at z = −8.6), drooped slightly.
  const fwd = lathe([[-8.7, 0], [-8.2, 0.2], [-7.4, 0.38], [-6.2, 0.55], [-4.8, 0.72], [-3.2, 0.8], [-1.0, 0.78], [1.5, 0.55], [3.5, 0.2]], 1, 0.95, base);
  fwd.position.y = 0.3;
  g.add(fwd);
  const radome = lathe([[-8.72, 0], [-8.2, 0.2], [-7.6, 0.34], [-7.3, 0.4]], 1.01, 0.96, accent);
  radome.position.y = 0.3;
  g.add(radome);
  // Lifting centre body: a wide flat lathe between the nacelles.
  const body = lathe([[-4.5, 0], [-3.0, 0.9], [0, 1.25], [4.5, 1.2], [7.0, 0.8], [7.6, 0.3]], 1.6, 0.32, base, 16);
  body.position.y = 0.1;
  g.add(body);
  // Engine nacelles with rectangular-ish intakes under the LERX.
  for (const s of [-1, 1]) {
    const nac = lathe([[-3.2, 0.5], [-2.2, 0.58], [3.5, 0.6], [6.8, 0.56], [7.8, 0.5]], 1.05, 1, belly, 16);
    nac.position.set(s * 1.05, -0.35, 0);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 1.6), belly);
    lip.position.set(s * 1.05, -0.45, -3.1);
    lip.rotation.x = 0.12;
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.7), mat("#101010", "dark"));
    mouth.position.set(s * 1.05, -0.5, -3.92);
    mouth.rotation.set(0.12, Math.PI, 0);
    g.add(nac, lip, mouth, nozzle(s * 1.05, -0.35, 7.8, 0.5, 0.8));
  }
  // Wing + LERX.
  const wing: [number, number][] = [[0.7, -5.7], [1.35, -2.6], [1.75, -0.9], [5.75, 2.75], [5.75, 3.85], [1.75, 4.3], [0.7, 4.3]];
  g.add(planform(wing, 0.13, base), planform(mirrorX(wing), 0.13, base));
  // Horizontal tails.
  const stab: [number, number][] = [[1.6, 5.5], [4.05, 7.35], [4.05, 8.1], [1.6, 8.45]];
  g.add(planform(stab, 0.08, base), planform(mirrorX(stab), 0.08, base));
  // Twin fins, canted outward, mounted on the nacelle shoulders.
  for (const s of [-1, 1]) {
    const fin = sideplate([[3.4, 0.4], [6.1, 3.55], [7.05, 3.55], [7.65, 0.4]], 0.11, base);
    fin.position.x = s * 1.55;
    fin.rotation.z = -s * 0.11;
    const band = sideplate([[5.9, 2.9], [6.0, 3.1], [7.2, 3.1], [7.3, 2.9]], 0.12, mat(p.marking));
    band.position.x = s * 1.6;
    band.rotation.z = -s * 0.11;
    g.add(fin, band);
  }
  // Canopy: blended bubble with a dorsal spine behind it.
  g.add(canopy([0, 0.95, -5.0], [0.48, 0.5, 1.45], p.canopy));
  const spine = lathe([[-3.8, 0], [-3.0, 0.35], [2.5, 0.4], [6.0, 0]], 0.8, 0.7, base, 12);
  spine.position.y = 0.9;
  g.add(spine);
  // Stores: two medium-range under the wings, two short-range outboard.
  for (const s of [-1, 1]) g.add(store(s * 2.7, -0.4, 1.0, 4.0, 0.115), store(s * 4.1, -0.3, 1.7, 2.9, 0.08));
  g.add(roundel(4.3, 0.2, 2.9, 0.4, p.marking, "up"), roundel(-4.3, 0.2, 2.9, 0.4, p.marking, "up"));
  return g;
}

const BUILDERS: Readonly<Record<string, () => THREE.Group>> = {
  "f16c": () => buildViper(PAINTS["f16c"]!),
  "f16c-aggressor": () => buildViper(PAINTS["f16c-aggressor"]!),
  "mig29": () => buildFulcrum(PAINTS["mig29"]!)
};

export const AIRCRAFT_MODEL_IDS: readonly string[] = Object.keys(BUILDERS);

/** Build the exterior model for an id; unknown ids get a neutral placeholder silhouette. */
export function buildAircraftModel(id: string): THREE.Group {
  const build = BUILDERS[id];
  const g = build ? build() : buildViper({ base: "#6d747c", belly: "#7d848c", accent: "#5a6068", canopy: "#445566", marking: "#6d747c" });
  g.userData = { modelId: id };
  return g;
}
