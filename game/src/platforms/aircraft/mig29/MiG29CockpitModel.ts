/**
 * MiG-29 cockpit interior — rebuilt procedural presentation model.
 *
 * Coordinates are camera-local: X right, Y up, Z aft; the pilot design-eye is the origin.
 * The panel and instrument registration follow public MiG-29 cockpit photographs and the
 * documented instrument grouping. Overall dimensions, panel angles and the exact product 9.13
 * fit remain provisional because no dimensioned Soviet 9.13 cockpit drawing has been verified.
 *
 * Dynamic instrument faces and the eight currently supported clickable switches are overlaid
 * by MiG29Cockpit.ts. This module supplies the physical structure and visible hardware only.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

type Surface =
  | "paint" | "panel" | "console" | "frame" | "black" | "rubber"
  | "metal" | "bezel" | "seat" | "cushion" | "belt" | "warning"
  | "amber" | "glass" | "hud";
type Vec3 = readonly [number, number, number];
type Bucket = { positions: number[]; normals: number[]; indices: number[] };

const FACE_X = 0.845;
const FACE_DOWN = 0.37;
const FACE_TILT = -0.30;
const WING_START = 0.20;
const WING_YAW = 0.38;
const PX = 0.1 / 75;
const OX = 390;
const OY = 190;
const V_TOP = (30 - OY) * PX;
const V_BOTTOM = (300 - OY) * PX;

const palette: Record<Surface, THREE.Material> = {
  paint: new THREE.MeshStandardMaterial({ color: "#69777a", roughness: 0.86, metalness: 0.12 }),
  panel: new THREE.MeshStandardMaterial({ color: "#737f81", roughness: 0.82, metalness: 0.18 }),
  console: new THREE.MeshStandardMaterial({ color: "#535f62", roughness: 0.88, metalness: 0.12 }),
  frame: new THREE.MeshStandardMaterial({ color: "#303638", roughness: 0.72, metalness: 0.38 }),
  black: new THREE.MeshStandardMaterial({ color: "#171b1d", roughness: 0.92, metalness: 0.06 }),
  rubber: new THREE.MeshStandardMaterial({ color: "#252a29", roughness: 0.98, metalness: 0 }),
  metal: new THREE.MeshStandardMaterial({ color: "#929a99", roughness: 0.42, metalness: 0.68 }),
  bezel: new THREE.MeshStandardMaterial({ color: "#353b3d", roughness: 0.55, metalness: 0.56 }),
  seat: new THREE.MeshStandardMaterial({ color: "#505c4d", roughness: 0.92, metalness: 0.04 }),
  cushion: new THREE.MeshStandardMaterial({ color: "#353d38", roughness: 1, metalness: 0 }),
  belt: new THREE.MeshStandardMaterial({ color: "#a18a50", roughness: 0.92, metalness: 0 }),
  warning: new THREE.MeshStandardMaterial({ color: "#b83c2c", roughness: 0.58, metalness: 0.1 }),
  amber: new THREE.MeshStandardMaterial({ color: "#bd8b37", roughness: 0.58, metalness: 0.08 }),
  glass: new THREE.MeshPhysicalMaterial({ color: "#c0d6dc", roughness: 0.08, metalness: 0, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide }),
  hud: new THREE.MeshPhysicalMaterial({ color: "#b7e2c8", roughness: 0.04, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })
};

const emptyBucket = (): Bucket => ({ positions: [], normals: [], indices: [] });

function addGeometry(bucket: Bucket, geometry: THREE.BufferGeometry, centre: Vec3, rotation: Vec3 = [0, 0, 0]): void {
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...centre),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation, "XYZ")),
    new THREE.Vector3(1, 1, 1)
  );
  geometry.applyMatrix4(matrix);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const offset = bucket.positions.length / 3;
  for (let i = 0; i < position.count; i++) {
    bucket.positions.push(position.getX(i), position.getY(i), position.getZ(i));
    bucket.normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
  }
  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i++) bucket.indices.push(index.getX(i) + offset);
  } else {
    for (let i = 0; i < position.count; i++) bucket.indices.push(i + offset);
  }
  geometry.dispose();
}

function box(b: Bucket, centre: Vec3, size: Vec3, rotation: Vec3 = [0, 0, 0]): void {
  addGeometry(b, new THREE.BoxGeometry(...size), centre, rotation);
}

function rounded(b: Bucket, centre: Vec3, size: Vec3, radius: number, rotation: Vec3 = [0, 0, 0]): void {
  const bevel = Math.max(0.0005, Math.min(radius, Math.min(...size) * 0.46));
  addGeometry(b, new RoundedBoxGeometry(...size, 3, bevel), centre, rotation);
}

function cylinder(b: Bucket, centre: Vec3, radius: number, length: number, axis: Vec3 = [0, 1, 0], radial = 16): void {
  const direction = new THREE.Vector3(...axis).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const geometry = new THREE.CylinderGeometry(radius, radius, length, radial, 1, false);
  geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...centre), quaternion, new THREE.Vector3(1, 1, 1)));
  addGeometry(b, geometry, [0, 0, 0]);
}

function torus(b: Bucket, centre: Vec3, radius: number, tube: number, axis: Vec3 = [0, 0, 1], radial = 36): void {
  const direction = new THREE.Vector3(...axis).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  const geometry = new THREE.TorusGeometry(radius, tube, 8, radial);
  geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...centre), quaternion, new THREE.Vector3(1, 1, 1)));
  addGeometry(b, geometry, [0, 0, 0]);
}

function panelPoint(u: number, v: number, depth = 0): THREE.Vector3 {
  const over = Math.max(0, Math.abs(u) - WING_START);
  const side = Math.sign(u);
  const lateral = side * (Math.min(Math.abs(u), WING_START) + over * Math.cos(WING_YAW));
  const forward = FACE_X + Math.sin(FACE_TILT) * v - over * Math.sin(WING_YAW);
  const down = FACE_DOWN + Math.cos(FACE_TILT) * v;
  const normal = panelNormal(u);
  return new THREE.Vector3(lateral, -down, -forward).addScaledVector(normal, depth);
}

function panelRotation(u: number): Vec3 {
  return [FACE_TILT, Math.abs(u) > WING_START ? -Math.sign(u) * WING_YAW : 0, 0];
}

function panelNormal(u: number): THREE.Vector3 {
  return new THREE.Vector3(0, 0, 1)
    .applyEuler(new THREE.Euler(...panelRotation(u), "XYZ"))
    .normalize();
}

function panelCylinder(b: Bucket, u: number, v: number, depth: number, radius: number, length: number, radial = 24): void {
  const point = panelPoint(u, v, depth);
  const normal = panelNormal(u);
  cylinder(b, [point.x, point.y, point.z], radius, length, [normal.x, normal.y, normal.z], radial);
}

function panelBox(b: Bucket, u: number, v: number, width: number, height: number, depth: number, thickness: number): void {
  const point = panelPoint(u, v, depth);
  box(b, [point.x, point.y, point.z], [width, height, thickness], panelRotation(u));
}

function panelKeypad(b: Bucket, u: number, v: number, width: number, height: number, columns: number, rows: number): void {
  panelBox(b, u, v, width, height, 0.012, 0.012);
  const insetX = width * 0.13, insetY = height * 0.16;
  const cellW = (width - insetX * 2) / columns;
  const cellH = (height - insetY * 2) / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = u - width / 2 + insetX + cellW * (col + 0.5);
      const y = v - height / 2 + insetY + cellH * (row + 0.5);
      const point = panelPoint(x, y, 0.022);
      const accent = (row + col) % 7 === 0;
      rounded(b(accent ? "amber" : "metal"), [point.x, point.y, point.z],
        [cellW * 0.58, cellH * 0.48, 0.008], 0.002, panelRotation(u));
    }
  }
}

function panelRing(b: Bucket, u: number, v: number, depth: number, radius: number, tube: number): void {
  const point = panelPoint(u, v, depth);
  const normal = panelNormal(u);
  torus(b, [point.x, point.y, point.z], radius, tube, [normal.x, normal.y, normal.z], 40);
}

function panelSegment(b: Bucket, u0: number, u1: number, v0: number, v1: number): void {
  const front = [panelPoint(u0, v0), panelPoint(u1, v0), panelPoint(u1, v1), panelPoint(u0, v1)];
  const back = front.map((p) => p.clone().add(new THREE.Vector3(0, 0, -0.045)));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(
    [...front, ...back].flatMap((p) => [p.x, p.y, p.z]), 3
  ));
  geometry.setIndex([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
    0, 5, 4, 0, 1, 5, 1, 6, 5, 1, 2, 6,
    2, 7, 6, 2, 3, 7, 3, 4, 7, 3, 0, 4
  ]);
  geometry.computeVertexNormals();
  addGeometry(b, geometry, [0, 0, 0]);
}

function extrudedSidewall(b: Bucket, side: -1 | 1): void {
  const shape = new THREE.Shape();
  shape.moveTo(side * 0.34, -0.82);
  shape.lineTo(side * 0.48, -0.82);
  shape.lineTo(side * 0.48, -0.56);
  shape.lineTo(side * 0.455, -0.45);
  shape.lineTo(side * 0.405, -0.405);
  shape.lineTo(side * 0.36, -0.47);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.86, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.008, bevelThickness: 0.008 });
  geometry.translate(0, 0, -0.88);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const offset = b.positions.length / 3;
  for (let i = 0; i < position.count; i++) {
    b.positions.push(position.getX(i), position.getY(i), position.getZ(i));
    b.normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
  }
  const index = geometry.getIndex();
  if (index) for (let i = 0; i < index.count; i++) b.indices.push(index.getX(i) + offset);
  geometry.dispose();
}

function canopySurface(b: Bucket): void {
  const rows = 24, columns = 41, positions: number[] = [], indices: number[] = [];
  for (let row = 0; row < rows; row++) {
    const z = -1.17 + 2.22 * row / (rows - 1);
    const top = 0.47 - 0.08 * Math.max(0, z / 1.05);
    for (let col = 0; col < columns; col++) {
      const theta = -Math.PI / 2 + Math.PI * col / (columns - 1);
      positions.push(0.505 * Math.sin(theta), 0.08 + (top - 0.08) * Math.cos(theta), z);
    }
  }
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < columns - 1; col++) {
      const a = row * columns + col;
      const c = (row + 1) * columns + col;
      indices.push(a, a + 1, c + 1, a, c + 1, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal");
  const offset = b.positions.length / 3;
  for (let i = 0; i < p.count; i++) {
    b.positions.push(p.getX(i), p.getY(i), p.getZ(i));
    b.normals.push(n.getX(i), n.getY(i), n.getZ(i));
  }
  for (let i = 0; i < geometry.getIndex()!.count; i++) b.indices.push(geometry.getIndex()!.getX(i) + offset);
  geometry.dispose();
}

function addToggle(b: Bucket, x: number, y: number, z: number, kind: "toggle" | "knob" | "button", accent = false): void {
  cylinder(b, [x, y + 0.006, z], 0.012, 0.012, [0, 1, 0], 14);
  if (kind === "toggle") {
    cylinder(b, [x, y + 0.027, z - 0.003], 0.0038, 0.036, [0.10, 0.94, -0.30], 10);
    cylinder(b, [x + 0.002, y + 0.043, z - 0.008], 0.006, 0.012, [0.10, 0.94, -0.30], 12);
  } else if (kind === "knob") {
    cylinder(b, [x, y + 0.017, z], accent ? 0.014 : 0.011, 0.022, [0, 1, 0], 18);
    cylinder(b, [x, y + 0.031, z], 0.008, 0.006, [0, 1, 0], 18);
  } else {
    cylinder(b, [x, y + 0.017, z], accent ? 0.010 : 0.008, 0.016, [0, 1, 0], 16);
  }
}

function materialMesh(name: Surface, bucket: Bucket): THREE.Mesh | null {
  if (bucket.indices.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(bucket.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(bucket.normals, 3));
  geometry.setIndex(bucket.indices);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, palette[name]);
  mesh.name = `mig29-cockpit-${name}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.shell = true;
  return mesh;
}

/** Build the rebuilt MiG-29 cockpit shell. Shape and dimensions are provisional, not measured. */
export function createMiG29CockpitShell(): THREE.Group {
  const buckets = Object.fromEntries(
    (["paint", "panel", "console", "frame", "black", "rubber", "metal", "bezel", "seat", "cushion", "belt", "warning", "amber", "glass", "hud"] as Surface[])
      .map((surface) => [surface, emptyBucket()])
  ) as Record<Surface, Bucket>;
  const b = (surface: Surface) => buckets[surface];

  // Lower cockpit tub: thin floor, low side liners and aft bulkhead. No shoulder-high side slabs.
  rounded(b("frame"), [0, -0.842, 0.02], [0.92, 0.055, 2.30], 0.018);
  rounded(b("paint"), [0, -0.808, 0.02], [0.84, 0.018, 2.18], 0.006);
  for (const side of [-1, 1] as const) {
    extrudedSidewall(b("paint"), side);
    rounded(b("frame"), [side * 0.475, -0.575, 0.045], [0.035, 0.43, 1.88], 0.012);
    box(b("rubber"), [side * 0.492, -0.355, 0.045], [0.012, 0.018, 1.82]);
    for (let i = 0; i < 15; i++) {
      const z = -0.80 + i * 1.72 / 14;
      cylinder(b("metal"), [side * 0.492, -0.32, z], 0.0028, 0.0035, [1, 0, 0], 8);
    }
  }
  rounded(b("frame"), [0, -0.34, 1.08], [0.90, 0.90, 0.085], 0.025);

  // Main instrument panel: one central face and two inward-turned outer panels.
  panelSegment(b("panel"), -0.20, 0.20, V_TOP, V_BOTTOM);
  panelSegment(b("panel"), -0.43, -0.20, V_TOP, V_BOTTOM);
  panelSegment(b("panel"), 0.20, 0.43, V_TOP, V_BOTTOM);
  for (const side of [-1, 1] as const) {
    const top = panelPoint(side * 0.43, V_TOP);
    const bottom = panelPoint(side * 0.43, V_BOTTOM);
    const delta = bottom.clone().sub(top);
    const mid = top.clone().add(bottom).multiplyScalar(0.5).add(new THREE.Vector3(0, 0, -0.02));
    cylinder(b("frame"), [mid.x, mid.y, mid.z], 0.010, delta.length(), [delta.x, delta.y, delta.z], 12);
  }

  // Recessed dark wells and raised bezels behind the live gauge/screen textures.
  const gauges: readonly [number, number, number][] = [
    [130, 165, 65], [140, 235, 65], [255, 150, 75], [245, 245, 95],
    [340, 140, 55], [330, 215, 55], [440, 145, 60], [515, 140, 60],
    [445, 210, 55], [505, 210, 55]
  ];
  for (const [px, py, sizePx] of gauges) {
    const u = (px - OX) * PX, v = (py - OY) * PX, diameter = sizePx * PX;
    panelCylinder(b("black"), u, v, 0.002, diameter * 0.49, 0.008, 32);
    panelRing(b("bezel"), u, v, 0.012, diameter * 0.52, diameter * 0.055);
    panelRing(b("metal"), u, v, 0.020, diameter * 0.54, 0.0018);
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI * 0.5 * i;
      panelCylinder(b("metal"), u + Math.cos(angle) * diameter * 0.53, v + Math.sin(angle) * diameter * 0.53, 0.021, 0.0028, 0.003, 8);
    }
  }
  const windows: readonly [number, number, number, number][] = [
    [570, 180, 32, 72], [435, 255, 55, 42], [490, 255, 55, 42], [555, 255, 55, 42], [600, 95, 0, 0], [650, 215, 0, 0]
  ];
  for (const [px, py, widthPx, heightPx] of windows) {
    const u = (px - OX) * PX, v = (py - OY) * PX;
    const width = widthPx > 0 ? widthPx * PX : (px === 600 ? 0.15 : 0.10);
    const height = heightPx > 0 ? heightPx * PX : (px === 600 ? 0.13 : 0.10);
    const rail = 0.008;
    const centre = panelPoint(u, v, 0.009);
    box(b("black"), [centre.x, centre.y, centre.z], [width + 0.018, height + 0.018, 0.012], panelRotation(u));
    for (const [dx, dy, sx, sy] of [
      [-width / 2 - rail / 2, 0, rail, height + rail * 2],
      [width / 2 + rail / 2, 0, rail, height + rail * 2],
      [0, -height / 2 - rail / 2, width, rail],
      [0, height / 2 + rail / 2, width, rail]
    ] as const) {
      const p = panelPoint(u + dx, v + dy, 0.018);
      box(b("bezel"), [p.x, p.y, p.z], [sx, sy, 0.014], panelRotation(u + dx));
    }
  }
  for (const u of [-0.39, -0.2925, -0.195, -0.0975, 0, 0.0975, 0.195, 0.2925, 0.39]) {
    for (const v of [V_TOP + 0.012, V_BOTTOM - 0.012]) panelCylinder(b("metal"), u, v, 0.013, 0.003, 0.003, 8);
  }
  // Warning/caution lamps at the outer shoulders of the main panel.
  for (const [u, v, amber] of [[-0.38, -0.15, false], [0.38, -0.15, true], [-0.39, 0.12, false], [0.39, 0.12, true]] as const) {
    panelCylinder(b("bezel"), u, v, 0.012, 0.012, 0.012, 16);
    panelCylinder(b(amber ? "amber" : "warning"), u, v, 0.021, 0.0065, 0.004, 16);
  }

  // Additional instrument-control units: recessed keypads, signal-light banks and mechanical-state panel.
  panelKeypad(b("black"), -0.285, -0.145, 0.17, 0.105, 4, 3);
  panelKeypad(b("black"), -0.055, -0.157, 0.245, 0.085, 6, 2);
  panelKeypad(b("black"), 0.105, 0.112, 0.13, 0.060, 5, 2);
  panelKeypad(b("black"), -0.075, 0.118, 0.11, 0.080, 3, 3);
  for (let i = 0; i < 7; i++) {
    const u = -0.31 + i * 0.045;
    panelCylinder(b("bezel"), u, -0.078, 0.016, 0.0065, 0.004, 12);
    panelCylinder(b(i % 3 === 0 ? "warning" : "amber"), u, -0.078, 0.021, 0.0035, 0.003, 12);
  }

  // Padded glare shield: a shallow faceted hood rather than a thick pill-shaped beam.
  rounded(b("black"), [0, -0.105, -0.82], [0.88, 0.058, 0.13], 0.012, [0.06, 0, 0]);
  box(b("frame"), [0, -0.148, -0.783], [0.86, 0.012, 0.035], [0.06, 0, 0]);
  for (const u of [-0.31, -0.23, -0.15, -0.07, 0.07, 0.15, 0.23, 0.31]) {
    const point = panelPoint(u, -0.16, 0.016);
    cylinder(b("amber"), [point.x, point.y, point.z], 0.003, 0.003, panelNormal(u).toArray() as Vec3, 10);
  }

  // HUD projector assembly above the glare shield; paired supports frame a thin combiner.
  rounded(b("black"), [0, 0.075, -1.00], [0.205, 0.082, 0.135], 0.012);
  box(b("frame"), [0, 0.026, -0.94], [0.28, 0.022, 0.075]);
  rounded(b("bezel"), [0, 0.119, -1.015], [0.16, 0.018, 0.025], 0.005);
  for (const side of [-1, 1] as const) {
    box(b("metal"), [side * 0.105, 0.115, -1.035], [0.010, 0.17, 0.014], [0.04, side * 0.05, 0]);
    cylinder(b("bezel"), [side * 0.13, 0.015, -0.92], 0.009, 0.018, [0, 1, 0], 16);
  }
  const combiner = new THREE.BufferGeometry();
  combiner.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.105, 0.015, -1.045, 0.105, 0.015, -1.045,
    0.105, 0.205, -1.005, -0.105, 0.205, -1.005
  ], 3));
  combiner.setIndex([0, 1, 2, 0, 2, 3]);
  combiner.computeVertexNormals();
  const pos = combiner.getAttribute("position"), norm = combiner.getAttribute("normal");
  for (let i = 0; i < pos.count; i++) {
    b("hud").positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    b("hud").normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
  }
  for (let i = 0; i < combiner.getIndex()!.count; i++) b("hud").indices.push(combiner.getIndex()!.getX(i));
  combiner.dispose();

  // Side consoles: continuous, raised angled housings running forward to the instrument panel.
  for (const side of [-1, 1] as const) {
    const x = side * 0.36;
    rounded(b("console"), [x, -0.455, -0.08], [0.235, 0.135, 1.48], 0.020, [side * 0.055, 0, side * 0.045]);
    rounded(b("panel"), [x, -0.378, -0.08], [0.222, 0.022, 1.42], 0.007, [side * 0.055, 0, side * 0.045]);
    box(b("frame"), [side * 0.485, -0.48, -0.08], [0.026, 0.16, 1.46], [0, 0, side * 0.04]);

    const rows = side < 0
      ? [-0.70, -0.44, -0.18, 0.10, 0.38, 0.64]
      : [-0.68, -0.40, -0.12, 0.16, 0.44, 0.66];
    const columns = side < 0 ? [-0.065, 0.005, 0.070] : [-0.052, 0.052];
    for (let row = 0; row < rows.length; row++) {
      for (let col = 0; col < columns.length; col++) {
        const xx = x + columns[col]!;
        const z = rows[row]!;
        const kind = (row + col) % 4 === 0 ? "knob" : (row + col) % 3 === 0 ? "button" : "toggle";
        addToggle(b(kind === "button" && row % 2 === 0 ? "amber" : "metal"), xx, -0.368, z, kind, row === 0);
      }
    }

    // A few guarded controls, instrument windows and placards break up the dense switch fields.
    const plaques = side < 0 ? [-0.27, 0.40] : [-0.24, 0.34, 0.59];
    for (const z of plaques) {
      rounded(b("black"), [x, -0.357, z], [0.14, 0.014, 0.095], 0.006);
      box(b("bezel"), [x, -0.346, z + 0.052], [0.15, 0.009, 0.008]);
      for (const dx of [-0.045, 0, 0.045]) addToggle(b("amber"), x + dx, -0.343, z, "button");
    }

    if (side > 0) {
      rounded(b("black"), [x, -0.34, 0.02], [0.18, 0.028, 0.38], 0.010);
      for (const z of [-0.13, -0.045, 0.04, 0.125, 0.21]) {
        rounded(b("panel"), [x, -0.319, z], [0.16, 0.012, 0.058], 0.004);
        for (const dx of [-0.044, 0, 0.044]) addToggle(b("metal"), x + dx, -0.311, z, "button");
      }
      for (let i = 0; i < 10; i++) {
        const z = -0.69 + i * 0.135;
        box(b("black"), [side * 0.405, -0.342, z], [0.045, 0.012, 0.085]);
        for (const dx of [-0.01, 0.01]) addToggle(b("amber"), side * 0.405 + dx, -0.334, z, "button");
      }
    }
  }

  // Left-console twin throttle quadrant: physical base and guard rails around the live levers.
  rounded(b("black"), [-0.36, -0.285, -0.27], [0.18, 0.065, 0.39], 0.018, [0.08, 0, 0]);
  rounded(b("bezel"), [-0.36, -0.248, -0.27], [0.16, 0.016, 0.36], 0.006);
  for (const x of [-0.405, -0.365]) {
    cylinder(b("metal"), [x, -0.20, -0.29], 0.012, 0.085, [0, 1, 0], 16);
    rounded(b("rubber"), [x, -0.145, -0.29], [0.028, 0.06, 0.045], 0.008, [0.10, 0, 0]);
  }

  // Centre control column boot and compact grip. The live stick overlay is the moving shaft.
  rounded(b("rubber"), [0, -0.748, -0.36], [0.12, 0.024, 0.15], 0.026);
  rounded(b("rubber"), [0, -0.30, -0.405], [0.045, 0.082, 0.044], 0.012, [0.16, 0, 0]);
  cylinder(b("warning"), [0, -0.252, -0.420], 0.007, 0.008, [0, 1, 0], 12);
  for (const x of [-0.016, 0.016]) cylinder(b("amber"), [x, -0.262, -0.438], 0.003, 0.005, [0, 1, 0], 8);

  // Rudder pedals and footwells are below the main field of view.
  for (const side of [-1, 1] as const) {
    const x = side * 0.205;
    box(b("frame"), [x, -0.735, -0.51], [0.025, 0.045, 0.46]);
    box(b("metal"), [x, -0.658, -0.59], [0.14, 0.052, 0.10], [-0.15, side * 0.04, 0]);
    box(b("rubber"), [x, -0.627, -0.592], [0.13, 0.022, 0.07], [-0.15, side * 0.04, 0]);
    cylinder(b("metal"), [x, -0.69, -0.32], 0.010, 0.42, [0, 0, 1], 12);
  }

  // K-36 family seat: behind the control column, with distinct back pan, head pad and harness.
  for (const side of [-1, 1] as const) {
    const x = side * 0.245;
    box(b("metal"), [x, -0.42, 0.70], [0.028, 0.67, 0.09], [0.16, 0, 0]);
    cylinder(b("bezel"), [x, -0.40, 0.76], 0.012, 0.55, [0, 1, 0], 14);
  }
  rounded(b("seat"), [0, -0.40, 0.78], [0.48, 0.60, 0.12], 0.05, [0.16, 0, 0]);
  rounded(b("cushion"), [0, -0.47, 0.70], [0.42, 0.10, 0.40], 0.035, [-0.08, 0, 0]);
  rounded(b("seat"), [0, -0.70, 0.48], [0.48, 0.13, 0.43], 0.05);
  rounded(b("cushion"), [0, -0.625, 0.48], [0.42, 0.035, 0.36], 0.018);
  rounded(b("seat"), [0, 0.005, 0.99], [0.39, 0.27, 0.16], 0.045);
  rounded(b("cushion"), [0, 0.022, 1.075], [0.30, 0.09, 0.045], 0.018);
  for (const side of [-1, 1] as const) {
    const x = side * 0.12;
    box(b("belt"), [x, -0.20, 0.60], [0.045, 0.48, 0.018], [0.19, 0, side * 0.12]);
    box(b("belt"), [x, -0.48, 0.34], [0.04, 0.30, 0.018], [-0.22, 0, side * 0.12]);
    rounded(b("metal"), [x, -0.34, 0.48], [0.045, 0.055, 0.025], 0.006);
    torus(b("warning"), [side * 0.10, -0.70, 0.23], 0.055, 0.009, [0, 0, 1], 24);
  }

  // Canopy side rails: narrow gunmetal runners with thin seals, not heavy black beams.
  for (const side of [-1, 1] as const) {
    rounded(b("frame"), [side * 0.515, 0.080, -0.11], [0.022, 0.024, 2.08], 0.007);
    rounded(b("rubber"), [side * 0.498, 0.094, -0.11], [0.008, 0.009, 2.02], 0.003);
  }
  canopySurface(b("glass"));
  for (const z of [-1.12, 0.98]) {
    const top = z < 0 ? 0.47 : 0.40;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const theta = -Math.PI / 2 + Math.PI * i / 32;
      points.push(new THREE.Vector3(0.508 * Math.sin(theta), 0.08 + (top - 0.08) * Math.cos(theta), z));
    }
    for (let i = 0; i < points.length - 1; i++) {
      const delta = points[i + 1]!.clone().sub(points[i]!);
      const mid = points[i]!.clone().add(points[i + 1]!).multiplyScalar(0.5);
      cylinder(b("metal"), [mid.x, mid.y, mid.z], 0.0048, delta.length() + 0.003, [delta.x, delta.y, delta.z], 8);
    }
  }

  const shell = new THREE.Group();
  shell.name = "mig29-9-13-cockpit-shell-provisional";
  for (const surface of Object.keys(buckets) as Surface[]) {
    const mesh = materialMesh(surface, buckets[surface]);
    if (mesh) shell.add(mesh);
  }
  shell.userData.shell = true;
  shell.userData.provenance = "Rebuilt family-level reconstruction guided by public MiG-29 cockpit images; product 9.13 dimensions and exact equipment fit remain unverified.";
  return shell;
}
