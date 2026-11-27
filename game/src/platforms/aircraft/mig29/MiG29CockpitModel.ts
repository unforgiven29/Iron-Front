/**
 * MiG-29 cockpit shell — procedural Three.js presentation model.
 *
 * Coordinate frame: cockpit camera local, X right, Y up, Z aft; pilot design eye at origin.
 * Geometry is grouped by PBR material before insertion to keep cockpit draw calls bounded.
 *
 * This is a reference-guided family-level reconstruction, not a verified 1:1 product 9.13 model.
 * It deliberately does not use photo textures or fabricate equipment legends. The dynamic
 * instrument faces and supported interactive controls are overlaid by MiG29Cockpit.ts.
 */
import * as THREE from "three";

type Surface = "paint" | "panel" | "console" | "frame" | "black" | "rubber" | "metal" | "bezel" | "seat" | "cushion" | "belt" | "warning" | "amber" | "glass" | "hud";
type Vec3 = readonly [number, number, number];

const FACE_X = 0.845, FACE_Z = 0.42, TILT = -0.3, WING_U = 0.2, WING_YAW = 0.38;
const PX = 0.1 / 75;
const OX = 390, OY = 190;
const V_TOP = (30 - 190) * PX;
const V_BOTTOM = (300 - 190) * PX;

const palette: Record<Surface, THREE.Material> = {
  paint: new THREE.MeshStandardMaterial({ color: "#687a80", roughness: 0.82, metalness: 0.22 }),
  panel: new THREE.MeshStandardMaterial({ color: "#78878b", roughness: 0.84, metalness: 0.18 }),
  console: new THREE.MeshStandardMaterial({ color: "#586c72", roughness: 0.86, metalness: 0.16 }),
  frame: new THREE.MeshStandardMaterial({ color: "#2d373c", roughness: 0.62, metalness: 0.58 }),
  black: new THREE.MeshStandardMaterial({ color: "#171c1e", roughness: 0.94, metalness: 0.08 }),
  rubber: new THREE.MeshStandardMaterial({ color: "#252a28", roughness: 0.98, metalness: 0.0 }),
  metal: new THREE.MeshStandardMaterial({ color: "#9aa1a1", roughness: 0.38, metalness: 0.78 }),
  bezel: new THREE.MeshStandardMaterial({ color: "#343a3c", roughness: 0.48, metalness: 0.68 }),
  seat: new THREE.MeshStandardMaterial({ color: "#59634f", roughness: 0.83, metalness: 0.25 }),
  cushion: new THREE.MeshStandardMaterial({ color: "#414944", roughness: 1.0, metalness: 0.0 }),
  belt: new THREE.MeshStandardMaterial({ color: "#9c8750", roughness: 0.94, metalness: 0.0 }),
  warning: new THREE.MeshStandardMaterial({ color: "#b83d29", roughness: 0.55, metalness: 0.12 }),
  amber: new THREE.MeshStandardMaterial({ color: "#bd8b35", roughness: 0.56, metalness: 0.10 }),
  glass: new THREE.MeshPhysicalMaterial({ color: "#a7c3cc", roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }),
  hud: new THREE.MeshPhysicalMaterial({ color: "#b3dfc3", roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide })
};

type GeometryBucket = { positions: number[]; normals: number[]; indices: number[] };
const emptyBucket = (): GeometryBucket => ({ positions: [], normals: [], indices: [] });

function panelPoint(u: number, v: number): THREE.Vector3 {
  const over = Math.max(0, Math.abs(u) - WING_U);
  const side = Math.sign(u);
  const lateral = side * (Math.min(Math.abs(u), WING_U) + over * Math.cos(WING_YAW));
  const bodyX = FACE_X + Math.sin(TILT) * v - over * Math.sin(WING_YAW);
  const bodyZ = FACE_Z + Math.cos(TILT) * v;
  return new THREE.Vector3(lateral, -bodyZ, -bodyX);
}

function instrumentPoint(px: number, py: number): THREE.Vector3 {
  const u = (px - OX) * PX, v = (py - OY) * PX;
  return panelPoint(u, v);
}

function appendGeometry(bucket: GeometryBucket, geometry: THREE.BufferGeometry, position: Vec3, rotation?: Vec3): void {
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const euler = new THREE.Euler(...(rotation ?? [0, 0, 0]), "XYZ");
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(euler),
    new THREE.Vector3(1, 1, 1)
  );
  geometry.applyMatrix4(matrix);
  const p = geometry.getAttribute("position");
  const n = geometry.getAttribute("normal");
  const offset = bucket.positions.length / 3;
  for (let i = 0; i < p.count; i++) {
    bucket.positions.push(p.getX(i), p.getY(i), p.getZ(i));
    bucket.normals.push(n.getX(i), n.getY(i), n.getZ(i));
  }
  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i++) bucket.indices.push(index.getX(i) + offset);
  } else {
    for (let i = 0; i < p.count; i++) bucket.indices.push(i + offset);
  }
  geometry.dispose();
}

function buildBox(b: GeometryBucket, centre: Vec3, size: Vec3, rotation: Vec3 = [0, 0, 0]): void {
  appendGeometry(b, new THREE.BoxGeometry(size[0], size[1], size[2]), centre, rotation);
}

function buildCylinder(b: GeometryBucket, centre: Vec3, radius: number, length: number, axis: Vec3 = [0, 1, 0], radial = 16): void {
  const direction = new THREE.Vector3(...axis).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const geometry = new THREE.CylinderGeometry(radius, radius, length, radial, 1, false);
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...centre), q, new THREE.Vector3(1, 1, 1));
  geometry.applyMatrix4(matrix);
  appendGeometry(b, geometry, [0, 0, 0]);
}

function buildTorus(b: GeometryBucket, centre: Vec3, radius: number, tube: number, axis: Vec3 = [0, 0, 1], radial = 36): void {
  const direction = new THREE.Vector3(...axis).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  const geometry = new THREE.TorusGeometry(radius, tube, 8, radial);
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...centre), q, new THREE.Vector3(1, 1, 1));
  geometry.applyMatrix4(matrix);
  appendGeometry(b, geometry, [0, 0, 0]);
}

function buildPanelSegment(b: GeometryBucket, u0: number, u1: number, v0: number, v1: number): void {
  const front = [panelPoint(u0, v0), panelPoint(u1, v0), panelPoint(u1, v1), panelPoint(u0, v1)];
  const back = front.map((p) => p.clone().add(new THREE.Vector3(0, 0, -0.045)));
  const vertices = [...front, ...back];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices.flatMap((p) => [p.x, p.y, p.z]), 3));
  geometry.setIndex([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
    0, 5, 4, 0, 1, 5, 1, 6, 5, 1, 2, 6,
    2, 7, 6, 2, 3, 7, 3, 4, 7, 3, 0, 4
  ]);
  geometry.computeVertexNormals();
  const p = geometry.getAttribute("position");
  const n = geometry.getAttribute("normal");
  const offset = b.positions.length / 3;
  for (let i = 0; i < p.count; i++) {
    b.positions.push(p.getX(i), p.getY(i), p.getZ(i));
    b.normals.push(n.getX(i), n.getY(i), n.getZ(i));
  }
  for (let i = 0; i < geometry.getIndex()!.count; i++) b.indices.push(geometry.getIndex()!.getX(i) + offset);
  geometry.dispose();
}

function addCanopySurface(b: GeometryBucket, z0: number, z1: number, topAt: (z: number) => number): void {
  const rows = 18, columns = 33, positions: number[] = [], indices: number[] = [];
  for (let row = 0; row < rows; row++) {
    const z = z0 + (z1 - z0) * row / (rows - 1);
    const top = topAt(z);
    for (let col = 0; col < columns; col++) {
      const theta = -Math.PI / 2 + Math.PI * col / (columns - 1);
      positions.push(0.49 * Math.sin(theta), 0.10 + (top - 0.10) * Math.cos(theta), z);
    }
  }
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < columns - 1; col++) {
      const a = row * columns + col, c = (row + 1) * columns + col + 1;
      indices.push(a, a + 1, c, a, c, c - 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal"), offset = b.positions.length / 3;
  for (let i = 0; i < p.count; i++) {
    b.positions.push(p.getX(i), p.getY(i), p.getZ(i));
    b.normals.push(n.getX(i), n.getY(i), n.getZ(i));
  }
  for (let i = 0; i < geometry.getIndex()!.count; i++) b.indices.push(geometry.getIndex()!.getX(i) + offset);
  geometry.dispose();
}

function makeMaterialGeometry(bucket: GeometryBucket): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(bucket.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(bucket.normals, 3));
  geometry.setIndex(bucket.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function addSwitchCluster(b: GeometryBucket, x: number, y: number, z: number, kind: "toggle" | "knob" | "button"): void {
  buildCylinder(b, [x, y, z], 0.010, 0.009, [0, 1, 0], 14);
  if (kind === "toggle") {
    buildCylinder(b, [x, y + 0.020, z - 0.002], 0.0035, 0.035, [0.15, 0.95, -0.28], 10);
    buildCylinder(b, [x + 0.004, y + 0.037, z - 0.008], 0.006, 0.012, [0.15, 0.95, -0.28], 12);
  } else if (kind === "knob") {
    buildCylinder(b, [x, y + 0.012, z], 0.012, 0.018, [0, 1, 0], 18);
    buildCylinder(b, [x, y + 0.024, z], 0.009, 0.008, [0, 1, 0], 18);
  } else {
    buildCylinder(b, [x, y + 0.012, z], 0.009, 0.015, [0, 1, 0], 14);
  }
}

/** Build the MiG-29 cockpit shell. All dimensions are provisional family-level estimates. */
export function createMiG29CockpitShell(): THREE.Group {
  const buckets: Record<Surface, GeometryBucket> = {
    paint: empty(), panel: empty(), console: empty(), frame: empty(), black: empty(), rubber: empty(),
    metal: empty(), bezel: empty(), seat: empty(), cushion: empty(), belt: empty(), warning: empty(),
    amber: empty(), glass: empty(), hud: empty()
  };
  const b = (surface: Surface) => buckets[surface];

  // Primary tub, lower floor, bulkheads and sidewall liners.
  buildBox(b("frame"), [0, -0.855, 0.02], [0.96, 0.085, 2.34]);
  buildBox(b("paint"), [0, -0.805, 0], [0.84, 0.025, 2.18]);
  for (let z = -0.82; z <= 0.901; z += 0.191) buildBox(b("frame"), [0, -0.787, z], [0.79, 0.012, 0.018]);
  for (const x of [-0.27, -0.09, 0.09, 0.27]) buildBox(b("console"), [x, -0.777, -0.12], [0.145, 0.012, 0.42]);
  buildBox(b("frame"), [0, -0.32, -1.12], [0.98, 1.05, 0.085]);
  buildBox(b("frame"), [0, -0.30, 1.06], [0.98, 1.10, 0.09]);

  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(side * 0.36, -0.80);
    shape.lineTo(side * 0.49, -0.80);
    shape.lineTo(side * 0.54, -0.04);
    shape.lineTo(side * 0.48, 0.13);
    shape.lineTo(side * 0.41, 0.06);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.91, bevelEnabled: false, steps: 1 });
    geometry.translate(0, 0, -0.92);
    const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal"), offset = b("paint").positions.length / 3;
    for (let i = 0; i < p.count; i++) {
      b("paint").positions.push(p.getX(i), p.getY(i), p.getZ(i));
      b("paint").normals.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    const idx = geometry.getIndex();
    if (idx) for (let i = 0; i < idx.count; i++) b("paint").indices.push(idx.getX(i) + offset);
    else for (let i = 0; i < p.count; i++) b("paint").indices.push(i + offset);
    geometry.dispose();

    buildBox(b("frame"), [side * 0.49, -0.02, 0.02], [0.075, 0.105, 2.18]);
    buildBox(b("console"), [side * 0.45, -0.31, 0.18], [0.04, 0.38, 1.50], [0, 0, side * 0.06]);
    buildBox(b("metal"), [side * 0.50, 0.055, 0], [0.055, 0.055, 2.10]);
    for (const z of [-0.72, -0.32, 0.12, 0.57, 0.86]) buildBox(b("frame"), [side * 0.455, -0.27, z], [0.035, 0.35, 0.018]);
    buildBox(b("panel"), [side * 0.435, -0.56, 0.61], [0.045, 0.24, 0.39]);
    for (const z of [0.48, 0.60, 0.72]) buildCylinder(b("metal"), [side * 0.405, -0.45, z], 0.006, 0.013, [1, 0, 0], 10);
  }
  buildBox(b("cushion"), [0, -0.12, 1.00], [0.72, 0.62, 0.08]);
  for (const x of [-0.40, -0.28, 0.28, 0.40]) buildBox(b("frame"), [x, -0.36, 0.98], [0.025, 0.72, 0.028]);

  // Formed panel: central instrument face and individually yawed outer wings.
  buildPanelSegment(b("panel"), -0.20, 0.20, V_TOP, V_BOTTOM);
  buildPanelSegment(b("panel"), -0.43, -0.20, V_TOP, V_BOTTOM);
  buildPanelSegment(b("panel"), 0.20, 0.43, V_TOP, V_BOTTOM);
  for (const side of [-1, 1]) {
    const top = panelPoint(side * 0.43, V_TOP), bottom = panelPoint(side * 0.43, V_BOTTOM);
    const middle = top.clone().add(bottom).multiplyScalar(0.5).add(new THREE.Vector3(0, 0, -0.018));
    const axis = bottom.clone().sub(top);
    buildCylinder(b("frame"), [middle.x, middle.y, middle.z], 0.014, axis.length(), [axis.x, axis.y, axis.z], 12);
  }
  buildBox(b("black"), [0, -0.145, -0.805], [0.88, 0.070, 0.105], [0.05, 0, 0]);
  buildBox(b("frame"), [0, -0.19, -0.825], [0.88, 0.026, 0.075]);

  // Bezel wells align exactly to the existing live-instrument photo registration.
  const gauges: readonly [string, number, number, number][] = [
    ["ias", 130, 165, 65], ["alt", 140, 235, 65], ["adi", 255, 150, 75], ["hsi", 245, 245, 95],
    ["aoa", 340, 140, 55], ["ralt", 330, 215, 55], ["vvi", 440, 145, 60], ["rpm", 515, 140, 60],
    ["egt-l", 445, 210, 55], ["egt-r", 505, 210, 55]
  ];
  for (const [, px, py, sizePx] of gauges) {
    const p = instrumentPoint(px, py), diameter = sizePx * PX;
    buildCylinder(b("black"), [p.x, p.y, p.z - 0.005], diameter * 0.515, 0.022, [0, 0, 1], 44);
    buildTorus(b("bezel"), [p.x, p.y, p.z + 0.004], diameter * 0.515, diameter * 0.040, [0, 0, 1], 40);
    buildTorus(b("metal"), [p.x, p.y, p.z + 0.012], diameter * 0.545, 0.0015, [0, 0, 1], 40);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * 0.5 * i;
      buildCylinder(b("metal"), [p.x + Math.cos(a) * diameter * 0.54, p.y + Math.sin(a) * diameter * 0.54, p.z + 0.014], 0.0032, 0.0025, [0, 0, 1], 8);
    }
  }
  const rectangles: readonly [number, number, number, number][] = [[570, 180, 32, 72], [435, 255, 55, 42], [490, 255, 55, 42], [555, 255, 55, 42]];
  for (const [px, py, widthPx, heightPx] of rectangles) {
    const p = instrumentPoint(px, py), w = widthPx * PX, h = heightPx * PX;
    buildBox(b("black"), [p.x, p.y, p.z - 0.009], [w + 0.018, h + 0.018, 0.026]);
    buildBox(b("bezel"), [p.x, p.y, p.z + 0.003], [w + 0.008, h + 0.008, 0.009]);
  }
  for (const [px, py, width, height] of [[600, 95, 0.15, 0.13], [650, 215, 0.10, 0.10]] as const) {
    const p = instrumentPoint(px, py);
    buildBox(b("black"), [p.x, p.y, p.z - 0.008], [width + 0.028, height + 0.028, 0.035]);
    buildBox(b("bezel"), [p.x, p.y, p.z + 0.008], [width + 0.012, height + 0.012, 0.012]);
  }
  for (const x of [-0.39, -0.2925, -0.195, -0.0975, 0, 0.0975, 0.195, 0.2925, 0.39]) {
    for (const y of [-0.205, -0.565]) buildCylinder(b("metal"), [x, y, -0.833], 0.0032, 0.003, [0, 0, 1], 8);
  }
  for (const [x, y] of [[-0.38, -0.27], [0.38, -0.27], [-0.39, -0.52], [0.39, -0.52]] as const) {
    buildCylinder(b("bezel"), [x, y, -0.824], 0.012, 0.010, [0, 0, 1], 16);
    buildCylinder(b(x < 0 ? "warning" : "amber"), [x, y, -0.817], 0.007, 0.004, [0, 0, 1], 16);
  }

  // HUD projector, combiner, brackets and adjustment hardware.
  buildBox(b("black"), [0, 0.015, -0.975], [0.22, 0.105, 0.145]);
  buildBox(b("frame"), [0, -0.035, -0.89], [0.30, 0.045, 0.10]);
  for (const side of [-1, 1]) buildBox(b("metal"), [side * 0.078, 0.115, -1.005], [0.012, 0.19, 0.014], [0, side * 0.10, 0]);
  const hudGeometry = new THREE.BufferGeometry();
  hudGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.105, 0.005, -1.035, 0.105, 0.005, -1.035, 0.105, 0.205, -0.985, -0.105, 0.205, -0.985
  ], 3));
  hudGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  hudGeometry.computeVertexNormals();
  const hp = hudGeometry.getAttribute("position"), hn = hudGeometry.getAttribute("normal"), ho = b("hud").positions.length / 3;
  for (let i = 0; i < hp.count; i++) {
    b("hud").positions.push(hp.getX(i), hp.getY(i), hp.getZ(i));
    b("hud").normals.push(hn.getX(i), hn.getY(i), hn.getZ(i));
  }
  for (let i = 0; i < hudGeometry.getIndex()!.count; i++) b("hud").indices.push(hudGeometry.getIndex()!.getX(i) + ho);
  for (const x of [-0.12, 0.12]) buildBox(b("frame"), [x, 0.105, -0.995], [0.016, 0.22, 0.020]);
  for (const x of [-0.15, 0.15]) buildCylinder(b("bezel"), [x, 0.005, -0.90], 0.012, 0.024, [0, 1, 0], 18);

  // Side consoles and sidewall equipment panels; left/right layouts intentionally differ.
  for (const side of [-1, 1]) {
    const x = side * 0.435;
    buildBox(b("console"), [x, -0.39, 0.12], [0.26, 0.16, 1.52], [0, 0, side * 0.035]);
    buildBox(b("panel"), [x, -0.295, 0.12], [0.255, 0.055, 1.46], [side * 0.09, 0, side * 0.035]);
    buildBox(b("frame"), [side * 0.555, -0.27, 0.12], [0.035, 0.11, 1.55]);
    for (const z of [-0.64, 0.86]) buildBox(b("frame"), [x, -0.28, z], [0.28, 0.07, 0.035]);
    const rows = side < 0
      ? [-0.50, -0.30, -0.08, 0.18, 0.43, 0.70]
      : [-0.44, -0.18, 0.08, 0.34, 0.60];
    for (let row = 0; row < rows.length; row++) {
      const columns = side < 0 ? [-0.07, 0.02, 0.085] : [-0.055, 0.055];
      for (let col = 0; col < columns.length; col++) {
        const xx = x + columns[col]!;
        const z = rows[row]!;
        const kind = (row + col) % 4 === 0 ? "knob" : (row + col) % 3 === 0 ? "button" : "toggle";
        addSwitchCluster(b(kind === "button" && row % 2 === 0 ? "amber" : "metal"), xx, -0.25, z, kind);
      }
    }
    for (const z of side < 0 ? [-0.33, 0.28, 0.58] : [-0.25, 0.18, 0.55]) {
      buildBox(b("black"), [x, -0.252, z], [0.17, 0.012, 0.11]);
      for (const dx of [-0.055, 0, 0.055]) addSwitchCluster(b("amber"), x + dx, -0.238, z, "button");
      buildBox(b("metal"), [x, -0.23, z + 0.065], [0.18, 0.018, 0.02]);
    }
    if (side > 0) {
      buildBox(b("black"), [x, -0.205, 0.16], [0.205, 0.045, 0.40]);
      for (const z of [0.02, 0.10, 0.18, 0.26, 0.34]) {
        buildBox(b("panel"), [x, -0.178, z], [0.18, 0.016, 0.055]);
        for (const dx of [-0.045, 0, 0.045]) addSwitchCluster(b("amber"), x + dx, -0.166, z, "button");
      }
    }
    buildBox(b("panel"), [side * 0.445, -0.25, 0.83], [0.025, 0.42, 0.27], [0, 0, side * 0.12]);
    for (let k = 0; k < 5; k++) {
      buildCylinder(b("bezel"), [side * 0.425, -0.12, 0.74 + k * 0.045], 0.014, 0.018, [1, 0, 0], 16);
      buildCylinder(b("metal"), [side * 0.414, -0.12, 0.74 + k * 0.045], 0.008, 0.008, [1, 0, 0], 12);
    }
  }

  // Twin-engine throttle quadrant. The animated lever blocks remain part of the data layout.
  buildBox(b("black"), [-0.385, -0.235, -0.24], [0.17, 0.055, 0.40]);
  buildBox(b("bezel"), [-0.385, -0.202, -0.24], [0.16, 0.018, 0.37]);
  for (const x of [-0.405, -0.365]) buildCylinder(b("metal"), [x, -0.17, -0.25], 0.014, 0.08, [0, 1, 0], 16);

  // Rudder pedals, footwells, floor tunnel and centre-stick boot/grip.
  for (const side of [-1, 1]) {
    const x = side * 0.205;
    buildBox(b("frame"), [x, -0.735, -0.30], [0.035, 0.045, 0.56]);
    buildBox(b("metal"), [x, -0.64, -0.42], [0.16, 0.055, 0.105], [-0.16, side * 0.06, 0]);
    buildBox(b("rubber"), [x, -0.61, -0.425], [0.145, 0.025, 0.07], [-0.16, side * 0.06, 0]);
    buildBox(b("metal"), [x, -0.58, -0.43], [0.13, 0.012, 0.025]);
    buildCylinder(b("metal"), [x, -0.68, -0.12], 0.012, 0.48, [0, 0, 1], 14);
  }
  buildBox(b("frame"), [0, -0.765, -0.02], [0.15, 0.035, 0.76]);
  buildBox(b("rubber"), [0, -0.68, -0.39], [0.17, 0.06, 0.18]);
  buildBox(b("rubber"), [0, -0.235, -0.425], [0.075, 0.13, 0.105], [0.22, 0, 0]);
  buildBox(b("warning"), [-0.036, -0.205, -0.45], [0.018, 0.036, 0.018]);
  buildCylinder(b("warning"), [0, -0.17, -0.43], 0.009, 0.018, [0, 1, 0], 12);
  for (const x of [-0.020, 0.020]) buildCylinder(b("amber"), [x, -0.18, -0.46], 0.004, 0.010, [0, 1, 0], 10);

  // K-36 family seat structure, cushion, head box, rails and restraint webbing.
  for (const side of [-1, 1]) {
    const x = side * 0.255;
    buildBox(b("metal"), [x, -0.40, 0.60], [0.032, 0.73, 0.10], [0.19, 0, 0]);
    buildBox(b("seat"), [x, -0.63, 0.38], [0.055, 0.10, 0.63]);
    buildCylinder(b("bezel"), [x, -0.33, 0.67], 0.014, 0.58, [0, 1, 0], 16);
  }
  buildBox(b("seat"), [0, -0.59, 0.48], [0.51, 0.15, 0.52], [-0.10, 0, 0]);
  buildBox(b("seat"), [0, -0.17, 0.72], [0.49, 0.74, 0.13], [0.22, 0, 0]);
  buildBox(b("seat"), [0, 0.285, 0.83], [0.40, 0.30, 0.22]);
  buildBox(b("cushion"), [0, 0.305, 0.955], [0.30, 0.19, 0.045]);
  buildBox(b("cushion"), [0, -0.515, 0.40], [0.43, 0.10, 0.40], [-0.10, 0, 0]);
  buildBox(b("cushion"), [0, -0.665, 0.40], [0.43, 0.065, 0.43]);
  for (const side of [-1, 1]) {
    const x = side * 0.21;
    buildBox(b("seat"), [x, -0.19, 0.70], [0.045, 0.55, 0.10], [0.20, 0, 0]);
    buildBox(b("cushion"), [x * 1.17, -0.42, 0.47], [0.075, 0.09, 0.28]);
    buildBox(b("belt"), [side * 0.105, 0.005, 0.55], [0.055, 0.62, 0.018], [0.18, 0, side * 0.12]);
    buildBox(b("belt"), [side * 0.105, -0.50, 0.20], [0.045, 0.34, 0.018], [-0.25, 0, side * 0.12]);
    buildBox(b("metal"), [side * 0.105, -0.25, 0.40], [0.055, 0.05, 0.028]);
    buildTorus(b("metal"), [side * 0.12, -0.40, 0.05], 0.028, 0.006);
    buildTorus(b("warning"), [side * 0.095, -0.69, 0.12], 0.073, 0.012);
    buildBox(b("bezel"), [side * 0.095, -0.73, 0.12], [0.045, 0.022, 0.038]);
  }
  buildBox(b("frame"), [0, -0.72, 0.77], [0.30, 0.05, 0.06]);

  // Canopy bows, rails, seals and transparent windshield/canopy surfaces.
  for (const side of [-1, 1]) {
    buildBox(b("frame"), [side * 0.505, 0.105, -0.20], [0.045, 0.055, 1.95]);
    buildBox(b("rubber"), [side * 0.49, 0.135, -0.20], [0.024, 0.018, 1.93]);
  }
  addCanopySurface(b("glass"), -1.12, -0.63, (z) => 0.38 + 0.18 * ((z + 1.12) / 0.49));
  addCanopySurface(b("glass"), -0.60, 0.98, (z) => 0.54 - 0.12 * Math.max(0, (z - 0.20) / 0.78));
  for (const [z, top] of [[-1.12, 0.38], [-0.62, 0.56], [-0.12, 0.55], [0.46, 0.50], [0.98, 0.42]] as const) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 33; i++) {
      const theta = -Math.PI / 2 + Math.PI * i / 32;
      points.push(new THREE.Vector3(0.497 * Math.sin(theta), 0.105 + (top - 0.105) * Math.cos(theta), z));
    }
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!, next = points[i + 1]!, delta = next.clone().sub(a);
      const midpoint = a.clone().add(next).multiplyScalar(0.5);
      buildCylinder(b("frame"), [midpoint.x, midpoint.y, midpoint.z], 0.0075, delta.length() + 0.004, [delta.x, delta.y, delta.z], 8);
    }
  }
  for (const side of [-1, 1]) {
    buildBox(b("metal"), [side * 0.49, 0.10, -0.94], [0.04, 0.09, 0.22]);
    buildBox(b("metal"), [side * 0.51, 0.13, 0.92], [0.07, 0.10, 0.14]);
    buildCylinder(b("bezel"), [side * 0.52, 0.15, 0.88], 0.018, 0.10, [1, 0, 0], 16);
  }
  buildBox(b("frame"), [0, 0.22, -0.61], [0.045, 0.22, 0.05]);

  // Sill fasteners, sidewall placard blanks and a few routed cable looms.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 18; i++) {
      const z = -0.82 + i * 1.73 / 17;
      buildCylinder(b("metal"), [side * 0.507, 0.04, z], 0.0027, 0.003, [1, 0, 0], 8);
    }
    for (const z of [-0.73, -0.48, -0.20, 0.08, 0.36, 0.64]) buildBox(b("bezel"), [side * 0.43, -0.02, z], [0.05, 0.01, 0.075]);
    for (const z of [-0.54, -0.22, 0.12, 0.48, 0.78]) buildBox(b("black"), [side * 0.435, -0.235, z + 0.075], [0.11, 0.008, 0.024]);
    for (let cable = 0; cable < 2; cable++) {
      let previous: THREE.Vector3 | undefined;
      for (let i = 0; i < 30; i++) {
        const z = -0.68 + 1.46 * i / 29;
        const point = new THREE.Vector3(side * (0.42 - 0.018 * cable), -0.60 + 0.04 * Math.sin(z * 2 + cable), z);
        if (previous) {
          const delta = point.clone().sub(previous), mid = previous.clone().add(point).multiplyScalar(0.5);
          buildCylinder(b("rubber"), [mid.x, mid.y, mid.z], 0.0045, delta.length(), [delta.x, delta.y, delta.z], 8);
        }
        previous = point;
      }
    }
  }
  buildBox(b("black"), [0.50, -0.02, 0.58], [0.055, 0.10, 0.10]);
  buildTorus(b("warning"), [0.50, 0.045, 0.58], 0.026, 0.006, [1, 0, 0], 24);

  const shell = new THREE.Group();
  shell.name = "mig29-9-13-cockpit-shell-provisional";
  for (const surface of Object.keys(buckets) as Surface[]) {
    const bucket = buckets[surface]!;
    if (bucket.indices.length === 0) continue;
    const geometry = makeMaterialGeometry(bucket);
    const mesh = new THREE.Mesh(geometry, palette[surface]);
    mesh.name = `mig29-cockpit-${surface}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.shell = true;
    shell.add(mesh);
  }
  shell.userData.shell = true;
  shell.userData.provenance = "Original reference-guided provisional family-level geometry; not measured product 9.13";
  return shell;
}
