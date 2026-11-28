/**
 * MiG-29 product 9.13 cockpit — neutral structural shell.
 *
 * This pass deliberately contains no fitted instruments, display faces, switches, knobs,
 * buttons, levers, stick, throttle or pedals. It is a monochrome construction frame: cockpit
 * tub, main-panel structure, blank console trays, bare seat frame and canopy structure.
 *
 * Geometry remains a reference-guided family-level approximation. Do not describe it as a
 * measured 1:1 product 9.13 reconstruction until dimensioned 9.13 evidence and visual QA exist.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

type Vec3 = readonly [number, number, number];
type Bucket = { positions: number[]; normals: number[]; indices: number[] };
type ShellPart = "tub" | "panel" | "port-console" | "starboard-console" | "seat-frame" | "canopy-frame";

const CLAY = new THREE.MeshStandardMaterial({
  color: "#898989",
  roughness: 0.9,
  metalness: 0.02
});
const CLEAR_CANOPY = new THREE.MeshPhysicalMaterial({
  color: "#b8b8b8",
  roughness: 0.18,
  metalness: 0,
  transparent: true,
  opacity: 0.055,
  depthWrite: false,
  side: THREE.DoubleSide
});

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

function box(bucket: Bucket, centre: Vec3, size: Vec3, rotation: Vec3 = [0, 0, 0]): void {
  addGeometry(bucket, new THREE.BoxGeometry(...size), centre, rotation);
}

function rounded(bucket: Bucket, centre: Vec3, size: Vec3, radius: number, rotation: Vec3 = [0, 0, 0]): void {
  const bevel = Math.max(0.0005, Math.min(radius, Math.min(...size) * 0.46));
  addGeometry(bucket, new RoundedBoxGeometry(...size, 4, bevel), centre, rotation);
}

function cylinder(bucket: Bucket, centre: Vec3, radius: number, length: number, axis: Vec3, radial = 16): void {
  const direction = new THREE.Vector3(...axis).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const geometry = new THREE.CylinderGeometry(radius, radius, length, radial, 1, false);
  geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...centre), quaternion, new THREE.Vector3(1, 1, 1)));
  addGeometry(bucket, geometry, [0, 0, 0]);
}

function torus(bucket: Bucket, centre: Vec3, radius: number, tube: number, axis: Vec3): void {
  const direction = new THREE.Vector3(...axis).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  const geometry = new THREE.TorusGeometry(radius, tube, 8, 40);
  geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...centre), quaternion, new THREE.Vector3(1, 1, 1)));
  addGeometry(bucket, geometry, [0, 0, 0]);
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

function panelRing(bucket: Bucket, u: number, v: number, radius: number): void {
  const point = panelPoint(u, v, 0.014);
  const normal = panelNormal(u);
  torus(bucket, [point.x, point.y, point.z], radius, 0.004, [normal.x, normal.y, normal.z]);
}

function panelRectangleFrame(bucket: Bucket, u: number, v: number, width: number, height: number): void {
  const bar = 0.008;
  const rails: readonly [number, number, number, number][] = [
    [0, -height / 2, width + bar, bar],
    [0, height / 2, width + bar, bar],
    [-width / 2, 0, bar, height],
    [width / 2, 0, bar, height]
  ];
  for (const [dx, dy, sx, sy] of rails) {
    const point = panelPoint(u + dx, v + dy, 0.014);
    box(bucket, [point.x, point.y, point.z], [sx, sy, 0.012], panelRotation(u + dx));
  }
}

function panelSegment(bucket: Bucket, u0: number, u1: number, v0: number, v1: number): void {
  const front = [panelPoint(u0, v0), panelPoint(u1, v0), panelPoint(u1, v1), panelPoint(u0, v1)];
  const back = front.map((point) => point.clone().add(new THREE.Vector3(0, 0, -0.045)));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(
    [...front, ...back].flatMap((point) => [point.x, point.y, point.z]), 3
  ));
  geometry.setIndex([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
    0, 5, 4, 0, 1, 5, 1, 6, 5, 1, 2, 6,
    2, 7, 6, 2, 3, 7, 3, 4, 7, 3, 0, 4
  ]);
  geometry.computeVertexNormals();
  addGeometry(bucket, geometry, [0, 0, 0]);
}

function extrudedSidewall(bucket: Bucket, side: -1 | 1): void {
  const shape = new THREE.Shape();
  shape.moveTo(side * 0.34, -0.82);
  shape.lineTo(side * 0.48, -0.82);
  shape.lineTo(side * 0.48, -0.56);
  shape.lineTo(side * 0.455, -0.45);
  shape.lineTo(side * 0.405, -0.405);
  shape.lineTo(side * 0.36, -0.47);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1.86,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008
  });
  geometry.translate(0, 0, -0.88);
  addGeometry(bucket, geometry, [0, 0, 0]);
}

function canopySurface(): THREE.BufferGeometry {
  const rows = 24, columns = 41;
  const positions: number[] = [], indices: number[] = [];
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
  return geometry;
}

function materialMesh(name: ShellPart, bucket: Bucket): THREE.Mesh | null {
  if (bucket.indices.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(bucket.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(bucket.normals, 3));
  geometry.setIndex(bucket.indices);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, CLAY);
  mesh.name = "mig29-cockpit-" + name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.shell = true;
  mesh.userData.shellComponent = name;
  return mesh;
}

/** Build a neutral, switch-free structural frame for the MiG-29 cockpit. */
export function createMiG29CockpitShell(): THREE.Group {
  const buckets: Record<ShellPart, Bucket> = {
    tub: emptyBucket(),
    panel: emptyBucket(),
    "port-console": emptyBucket(),
    "starboard-console": emptyBucket(),
    "seat-frame": emptyBucket(),
    "canopy-frame": emptyBucket()
  };
  const b = (part: ShellPart) => buckets[part];

  // Cockpit tub: floor pan, low sidewalls, sill structure and aft bulkhead.
  rounded(b("tub"), [0, -0.842, 0.02], [0.92, 0.055, 2.30], 0.018);
  rounded(b("tub"), [0, -0.808, 0.02], [0.84, 0.018, 2.18], 0.006);
  rounded(b("tub"), [0, -0.790, -0.58], [0.72, 0.035, 0.54], 0.012);
  rounded(b("tub"), [0, -0.745, -0.27], [0.28, 0.085, 0.52], 0.018);
  rounded(b("tub"), [0, -0.34, 1.08], [0.90, 0.90, 0.085], 0.025);
  for (const side of [-1, 1] as const) {
    extrudedSidewall(b("tub"), side);
    rounded(b("tub"), [side * 0.475, -0.575, 0.045], [0.035, 0.43, 1.88], 0.012);
    rounded(b("tub"), [side * 0.495, -0.355, -0.11], [0.026, 0.035, 1.92], 0.008);
    rounded(b("tub"), [side * 0.455, -0.785, -0.52], [0.035, 0.055, 0.52], 0.008);
  }

  // Three-piece main instrument-panel frame: centre face with inward-turned outer wings.
  panelSegment(b("panel"), -0.20, 0.20, V_TOP, V_BOTTOM);
  panelSegment(b("panel"), -0.43, -0.20, V_TOP, V_BOTTOM);
  panelSegment(b("panel"), 0.20, 0.43, V_TOP, V_BOTTOM);
  for (const side of [-1, 1] as const) {
    const top = panelPoint(side * 0.43, V_TOP, -0.025);
    const bottom = panelPoint(side * 0.43, V_BOTTOM, -0.025);
    const delta = bottom.clone().sub(top);
    const middle = top.clone().add(bottom).multiplyScalar(0.5);
    cylinder(b("panel"), [middle.x, middle.y, middle.z], 0.009, delta.length(), [delta.x, delta.y, delta.z], 12);
  }

  // Empty mounting rings and rectangular apertures only. No faces, labels, lamps or controls.
  const blankGaugeMounts: readonly [number, number, number][] = [
    [130, 165, 65], [140, 235, 65], [255, 150, 75], [245, 245, 95],
    [340, 140, 55], [330, 215, 55], [440, 145, 60], [515, 140, 60],
    [445, 210, 55], [505, 210, 55]
  ];
  for (const [px, py, diameterPx] of blankGaugeMounts) {
    const u = (px - OX) * PX, v = (py - OY) * PX;
    panelRing(b("panel"), u, v, diameterPx * PX * 0.49);
  }
  const blankRectangles: readonly [number, number, number, number][] = [
    [570, 180, 32, 72], [435, 255, 55, 42], [490, 255, 55, 42],
    [555, 255, 55, 42], [600, 95, 112, 98], [650, 215, 75, 75]
  ];
  for (const [px, py, widthPx, heightPx] of blankRectangles) {
    panelRectangleFrame(
      b("panel"),
      (px - OX) * PX,
      (py - OY) * PX,
      widthPx * PX,
      heightPx * PX
    );
  }

  // Glare shield and HUD mounting frame: structural supports only, no combiner or display.
  rounded(b("panel"), [0, -0.103, -0.82], [0.84, 0.036, 0.105], 0.010, [0.06, 0, 0]);
  box(b("panel"), [0, -0.131, -0.784], [0.82, 0.008, 0.026], [0.06, 0, 0]);
  rounded(b("panel"), [0, 0.026, -0.94], [0.28, 0.022, 0.075], 0.008);
  for (const side of [-1, 1] as const) {
    box(b("panel"), [side * 0.105, 0.115, -1.035], [0.010, 0.17, 0.014], [0.04, side * 0.05, 0]);
  }
  box(b("panel"), [0, 0.202, -1.012], [0.23, 0.018, 0.018]);

  // Blank side-console trays with perimeter lips and empty equipment mounting bays.
  for (const side of [-1, 1] as const) {
    const part: ShellPart = side < 0 ? "port-console" : "starboard-console";
    const x = side * 0.385;
    const rotation: Vec3 = [side * 0.055, 0, side * 0.045];
    rounded(b(part), [x, -0.505, -0.08], [0.205, 0.105, 1.48], 0.016, rotation);
    rounded(b(part), [x, -0.438, -0.08], [0.183, 0.018, 1.42], 0.006, rotation);
    rounded(b(part), [side * 0.492, -0.505, -0.08], [0.018, 0.12, 1.46], 0.006, [0, 0, side * 0.04]);
    for (const [z, length] of [[-0.60, 0.28], [-0.20, 0.34], [0.27, 0.30]] as const) {
      rounded(b(part), [x, -0.424, z], [0.142, 0.010, length], 0.005, rotation);
    }
  }

  // Bare ejection-seat structure: seat pan, back pan, head support and mounting rails.
  for (const side of [-1, 1] as const) {
    const x = side * 0.245;
    box(b("seat-frame"), [x, -0.42, 0.70], [0.028, 0.67, 0.09], [0.16, 0, 0]);
    cylinder(b("seat-frame"), [x, -0.40, 0.76], 0.010, 0.55, [0, 1, 0], 14);
  }
  rounded(b("seat-frame"), [0, -0.40, 0.78], [0.46, 0.60, 0.095], 0.035, [0.16, 0, 0]);
  rounded(b("seat-frame"), [0, -0.70, 0.48], [0.48, 0.13, 0.43], 0.045);
  rounded(b("seat-frame"), [0, 0.005, 0.99], [0.39, 0.27, 0.10], 0.035);

  // Canopy sill rails, side rails and two transverse bows; glazing is clear and neutral.
  for (const side of [-1, 1] as const) {
    rounded(b("canopy-frame"), [side * 0.520, -0.045, -0.11], [0.022, 0.025, 1.96], 0.005);
    rounded(b("canopy-frame"), [side * 0.493, -0.145, -0.11], [0.036, 0.035, 1.96], 0.010);
  }
  for (const z of [-1.12, 0.98]) {
    const top = z < 0 ? 0.47 : 0.40;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const theta = -Math.PI / 2 + Math.PI * i / 32;
      points.push(new THREE.Vector3(0.508 * Math.sin(theta), 0.08 + (top - 0.08) * Math.cos(theta), z));
    }
    for (let i = 0; i < points.length - 1; i++) {
      const delta = points[i + 1]!.clone().sub(points[i]!);
      const middle = points[i]!.clone().add(points[i + 1]!).multiplyScalar(0.5);
      cylinder(b("canopy-frame"), [middle.x, middle.y, middle.z], 0.0055, delta.length() + 0.003, [delta.x, delta.y, delta.z], 8);
    }
  }

  const shell = new THREE.Group();
  shell.name = "mig29-9-13-cockpit-shell-frame";
  for (const part of Object.keys(buckets) as ShellPart[]) {
    const mesh = materialMesh(part, buckets[part]);
    if (mesh) shell.add(mesh);
  }
  const glazing = new THREE.Mesh(canopySurface(), CLEAR_CANOPY);
  glazing.name = "mig29-cockpit-canopy-glazing";
  glazing.userData.shell = true;
  glazing.userData.shellComponent = "canopy-glazing";
  shell.add(glazing);

  shell.userData.shell = true;
  shell.userData.configuration = "mig29-9-13-soviet-baseline-v1";
  shell.userData.visualMode = "neutral-structural-blockout";
  shell.userData.controlsIncluded = false;
  shell.userData.provenance = "Reference-guided family-level structural geometry; absolute dimensions, exact product 9.13 fit and eye datum remain unverified.";
  return shell;
}
