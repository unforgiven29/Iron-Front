/**
 * MiG-29 product 9.13 cockpit — neutral structural shell.
 *
 * Structural-only presentation: cockpit tub, shaped sidewalls, four-piece wraparound front
 * instrument assembly, blank side-console decks/faces, glare shield, HUD mounting structure,
 * bare seat frame and canopy rails. No controls, instruments, screens, labels or fitted hardware.
 *
 * This is a reference-guided family-level reconstruction. The public photographs support the
 * arrangement and shape, but do not provide calibrated product 9.13 internal dimensions.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

type Vec3 = readonly [number, number, number];
type Bucket = { positions: number[]; normals: number[]; indices: number[] };
type ShellPart =
  | "tub"
  | "panel-port-outer"
  | "panel-port-inner"
  | "panel-center"
  | "panel-starboard"
  | "panel-support"
  | "panel-recess"
  | "glare-shield"
  | "port-console"
  | "starboard-console"
  | "central-pedestal"
  | "seat-frame"
  | "canopy-frame";

interface PanelSection {
  readonly part: ShellPart;
  readonly minU: number;
  readonly maxU: number;
  readonly yawRad: number;
  readonly topV: number;
  readonly bottomV: number;
}

const CLAY = new THREE.MeshStandardMaterial({
  color: "#898989",
  roughness: 0.9,
  metalness: 0.02
});
const INSET_CLAY = new THREE.MeshStandardMaterial({
  color: "#777777",
  roughness: 0.94,
  metalness: 0.01
});
const RECESS_CLAY = new THREE.MeshStandardMaterial({
  color: "#555555",
  roughness: 0.98,
  metalness: 0
});
const CLEAR_CANOPY = new THREE.MeshPhysicalMaterial({
  color: "#b8b8b8",
  roughness: 0.18,
  metalness: 0,
  transparent: true,
  opacity: 0.008,
  depthWrite: false,
  side: THREE.DoubleSide
});

const FACE_X = 0.76;
const FACE_DOWN = 0.39;
const FACE_TILT = -0.38;
const PHOTO_SCALE = 0.1 / 70;
const PHOTO_ORIGIN_X = 390;
const PHOTO_ORIGIN_Y = 190;

/**
 * Four structural plates: two separate port panels, centre panel and starboard panel.
 * The yaw values make the dashboard wrap around the pilot rather than read as a flat board.
 * They are visual estimates from the early cockpit photographs, not measured 9.13 angles.
 */
const PANEL_SECTIONS: readonly PanelSection[] = [
  { part: "panel-port-outer", minU: -0.52, maxU: -0.34, yawRad: 0.54, topV: -0.20, bottomV: 0.16 },
  { part: "panel-port-inner", minU: -0.34, maxU: -0.16, yawRad: 0.25, topV: -0.24, bottomV: 0.19 },
  { part: "panel-center", minU: -0.16, maxU: 0.16, yawRad: 0, topV: -0.25, bottomV: 0.19 },
  { part: "panel-starboard", minU: 0.16, maxU: 0.52, yawRad: -0.36, topV: -0.23, bottomV: 0.17 }
];

const emptyBucket = (): Bucket => ({ positions: [], normals: [], indices: [] });

function addGeometry(
  bucket: Bucket,
  geometry: THREE.BufferGeometry,
  centre: Vec3,
  rotation: Vec3 = [0, 0, 0]
): void {
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

function rounded(
  bucket: Bucket,
  centre: Vec3,
  size: Vec3,
  radius: number,
  rotation: Vec3 = [0, 0, 0]
): void {
  const bevel = Math.max(0.0005, Math.min(radius, Math.min(...size) * 0.46));
  addGeometry(bucket, new RoundedBoxGeometry(...size, 4, bevel), centre, rotation);
}

function cylinder(
  bucket: Bucket,
  centre: Vec3,
  radius: number,
  length: number,
  axis: Vec3,
  radial = 16
): void {
  const direction = new THREE.Vector3(...axis).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const geometry = new THREE.CylinderGeometry(radius, radius, length, radial, 1, false);
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(new THREE.Vector3(...centre), quaternion, new THREE.Vector3(1, 1, 1))
  );
  addGeometry(bucket, geometry, [0, 0, 0]);
}

function torus(
  bucket: Bucket,
  centre: Vec3,
  radius: number,
  tube: number,
  axis: Vec3,
  radial = 36
): void {
  const direction = new THREE.Vector3(...axis).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  const geometry = new THREE.TorusGeometry(radius, tube, 8, radial);
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(new THREE.Vector3(...centre), quaternion, new THREE.Vector3(1, 1, 1))
  );
  addGeometry(bucket, geometry, [0, 0, 0]);
}

function extrudedSidewall(bucket: Bucket, side: -1 | 1): void {
  const shape = new THREE.Shape();
  shape.moveTo(side * 0.30, -0.855);
  shape.lineTo(side * 0.405, -0.855);
  shape.lineTo(side * 0.465, -0.59);
  shape.lineTo(side * 0.455, -0.48);
  shape.lineTo(side * 0.415, -0.455);
  shape.lineTo(side * 0.365, -0.555);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1.88,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.006,
    bevelThickness: 0.006
  });
  geometry.translate(0, 0, -0.93);
  addGeometry(bucket, geometry, [0, 0, 0]);
}

function sectionAt(u: number): PanelSection {
  return PANEL_SECTIONS.find((section) => u >= section.minU && u <= section.maxU)
    ?? PANEL_SECTIONS.reduce((nearest, section) =>
      Math.abs(u - (section.minU + section.maxU) * 0.5)
        < Math.abs(u - (nearest.minU + nearest.maxU) * 0.5)
        ? section
        : nearest
    );
}

/** Integrate the stepped panel angles so the four plates meet in the correct wraparound order. */
function panelLateralAndForwardOffset(u: number): readonly [number, number] {
  const sign = Math.sign(u);
  if (sign === 0) return [0, 0];
  const lower = Math.min(0, u), upper = Math.max(0, u);
  let lateral = 0, forward = 0;
  for (const section of PANEL_SECTIONS) {
    const from = Math.max(lower, section.minU);
    const to = Math.min(upper, section.maxU);
    if (to <= from) continue;
    const signedWidth = sign * (to - from);
    lateral += signedWidth * Math.cos(section.yawRad);
    forward += signedWidth * Math.sin(section.yawRad);
  }
  return [lateral, forward];
}

function panelRotation(u: number): Vec3 {
  return [FACE_TILT, sectionAt(u).yawRad, 0];
}

function panelNormal(u: number): THREE.Vector3 {
  return new THREE.Vector3(0, 0, 1)
    .applyEuler(new THREE.Euler(...panelRotation(u), "XYZ"))
    .normalize();
}

function panelPoint(u: number, v: number, depth = 0): THREE.Vector3 {
  const [lateral, forwardOffset] = panelLateralAndForwardOffset(u);
  const forward = FACE_X + Math.sin(FACE_TILT) * v + forwardOffset;
  const down = FACE_DOWN + Math.cos(FACE_TILT) * v;
  return new THREE.Vector3(lateral, -down, -forward).addScaledVector(panelNormal(u), depth);
}

function panelSegment(
  bucket: Bucket,
  u0: number,
  u1: number,
  topV: number,
  bottomV: number,
  thickness = 0.042
): void {
  const front = [
    panelPoint(u0, topV, 0.002),
    panelPoint(u1, topV, 0.002),
    panelPoint(u1, bottomV, 0.002),
    panelPoint(u0, bottomV, 0.002)
  ];
  const normal = panelNormal((u0 + u1) * 0.5);
  const back = front.map((point) => point.clone().addScaledVector(normal, -thickness));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(
    [...front, ...back].flatMap((point) => [point.x, point.y, point.z]), 3
  ));
  geometry.setIndex([
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 5, 4, 0, 1, 5,
    1, 6, 5, 1, 2, 6,
    2, 7, 6, 2, 3, 7,
    3, 4, 7, 3, 0, 4
  ]);
  geometry.computeVertexNormals();
  addGeometry(bucket, geometry, [0, 0, 0]);
}

function panelRing(bucket: Bucket, u: number, v: number, radius: number): void {
  const point = panelPoint(u, v, 0.006);
  const normal = panelNormal(u);
  torus(bucket, [point.x, point.y, point.z], radius, 0.0045, [normal.x, normal.y, normal.z], 40);
}

function panelInset(bucket: Bucket, u: number, v: number, radius: number): void {
  const point = panelPoint(u, v, -0.016);
  const normal = panelNormal(u);
  cylinder(
    bucket,
    [point.x, point.y, point.z],
    radius * 0.88,
    0.010,
    [normal.x, normal.y, normal.z],
    32
  );
}

function panelRectangleFrame(
  bucket: Bucket,
  u: number,
  v: number,
  width: number,
  height: number
): void {
  const rail = 0.006;
  const rails: readonly [number, number, number, number][] = [
    [0, -height / 2, width + rail, rail],
    [0, height / 2, width + rail, rail],
    [-width / 2, 0, rail, height],
    [width / 2, 0, rail, height]
  ];
  for (const [dx, dy, sx, sy] of rails) {
    const panelU = u + dx;
    const point = panelPoint(panelU, v + dy, 0.006);
    box(bucket, [point.x, point.y, point.z], [sx, sy, 0.009], panelRotation(panelU));
  }
}

function panelRectInset(bucket: Bucket, u: number, v: number, width: number, height: number): void {
  const point = panelPoint(u, v, -0.014);
  box(
    bucket,
    [point.x, point.y, point.z],
    [width * 0.94, height * 0.94, 0.006],
    panelRotation(u)
  );
}

function consoleBay(bucket: Bucket, x: number, y: number, z: number, width: number, length: number, rotation: Vec3): void {
  rounded(bucket, [x, y, z], [width, 0.008, length], 0.004, rotation);
}

function canopySurface(): THREE.BufferGeometry {
  const rows = 24, columns = 41;
  const positions: number[] = [], indices: number[] = [];
  for (let row = 0; row < rows; row++) {
    const z = -1.17 + 2.22 * row / (rows - 1);
    const crown = 0.47 - 0.08 * Math.max(0, z / 1.05);
    for (let col = 0; col < columns; col++) {
      const theta = -Math.PI / 2 + Math.PI * col / (columns - 1);
      positions.push(0.505 * Math.sin(theta), 0.08 + (crown - 0.08) * Math.cos(theta), z);
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

function materialMesh(name: ShellPart, bucket: Bucket, material = CLAY): THREE.Mesh | null {
  if (bucket.indices.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(bucket.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(bucket.normals, 3));
  geometry.setIndex(bucket.indices);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "mig29-cockpit-" + name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.shell = true;
  mesh.userData.shellComponent = name;
  const section = PANEL_SECTIONS.find((panelSection) => panelSection.part === name);
  if (section) {
    mesh.userData.panelYawRad = section.yawRad;
    mesh.userData.panelRangeM = [section.minU, section.maxU];
  }
  return mesh;
}

/** Build a neutral, proportion-corrected structural frame for the MiG-29 cockpit. */
export function createMiG29CockpitShell(): THREE.Group {
  const buckets: Record<ShellPart, Bucket> = {
    tub: emptyBucket(),
    "panel-port-outer": emptyBucket(),
    "panel-port-inner": emptyBucket(),
    "panel-center": emptyBucket(),
    "panel-starboard": emptyBucket(),
    "panel-support": emptyBucket(),
    "panel-recess": emptyBucket(),
    "glare-shield": emptyBucket(),
    "port-console": emptyBucket(),
    "starboard-console": emptyBucket(),
    "central-pedestal": emptyBucket(),
    "seat-frame": emptyBucket(),
    "canopy-frame": emptyBucket()
  };
  const b = (part: ShellPart) => buckets[part];

  // Narrow, tapered cockpit tub with a shaped floor, rather than two raised rectangular rails.
  rounded(b("tub"), [0, -0.846, 0.01], [0.82, 0.040, 2.08], 0.018);
  rounded(b("tub"), [0, -0.824, 0.015], [0.70, 0.014, 1.92], 0.006);
  for (const side of [-1, 1] as const) {
    extrudedSidewall(b("tub"), side);
    // Thin upper sill and a low outer lip; neither rises into the pilot's sight picture.
    rounded(b("tub"), [side * 0.455, -0.49, -0.02], [0.018, 0.026, 1.82], 0.006);
    rounded(b("tub"), [side * 0.414, -0.815, -0.43], [0.025, 0.040, 0.48], 0.008);
  }
  // Aft bulkhead and seat mounting cross-member.
  rounded(b("tub"), [0, -0.365, 1.015], [0.82, 0.70, 0.060], 0.022);
  rounded(b("tub"), [0, -0.735, 0.65], [0.78, 0.055, 0.16], 0.012);

  // Four front-panel plates, each a separate mesh with its own face normal and vertical extent.
  for (const section of PANEL_SECTIONS) {
    const gap = 0.003;
    panelSegment(
      b(section.part),
      section.minU + gap,
      section.maxU - gap,
      section.topV,
      section.bottomV
    );
  }

  // Blank, flush mounting apertures. They are only shallow structural recesses, not instrument faces.
  const gaugeMounts: readonly [number, number, number][] = [
    [130, 165, 64], [140, 235, 62], [255, 150, 74], [245, 245, 88],
    [340, 140, 54], [330, 215, 50], [440, 145, 56], [515, 140, 54],
    [445, 210, 50], [505, 210, 50]
  ];
  for (const [px, py, diameterPx] of gaugeMounts) {
    const u = (px - PHOTO_ORIGIN_X) * PHOTO_SCALE;
    const v = (py - PHOTO_ORIGIN_Y) * PHOTO_SCALE;
    const radius = diameterPx * PHOTO_SCALE * 0.44;
    const part = sectionAt(u).part;
    panelInset(b("panel-recess"), u, v, radius * 0.91);
    panelRing(b(part), u, v, radius);
  }
  const rectangularMounts: readonly [number, number, number, number][] = [
    [570, 180, 32, 72],
    [435, 255, 55, 42],
    [490, 255, 55, 42],
    [555, 255, 55, 42],
    [600, 95, 108, 92],
    [650, 215, 72, 72]
  ];
  for (const [px, py, widthPx, heightPx] of rectangularMounts) {
    const u = (px - PHOTO_ORIGIN_X) * PHOTO_SCALE;
    const v = (py - PHOTO_ORIGIN_Y) * PHOTO_SCALE;
    const width = widthPx * PHOTO_SCALE;
    const height = heightPx * PHOTO_SCALE;
    const part = sectionAt(u).part;
    panelRectInset(b("panel-recess"), u, v, width, height);
    panelRectangleFrame(b(part), u, v, width, height);
  }

  // A low rear casing supports the four plates and blends their lower edges into the front tub.
  rounded(b("panel-support"), [0, -0.635, -0.545], [0.92, 0.105, 0.19], 0.025, [-0.24, 0, 0]);
  rounded(b("panel-support"), [0, -0.735, -0.43], [0.72, 0.055, 0.18], 0.018, [-0.16, 0, 0]);
  for (const side of [-1, 1] as const) {
    // Panel end cheeks bridge the dashboard into the consoles without forming square pillars.
    rounded(
      b("panel-support"),
      [side * 0.455, -0.45, -0.655],
      [0.070, 0.22, 0.16],
      0.018,
      [0.12, side * 0.20, side * 0.12]
    );
  }

  // Glare shield: a narrow padded brow, not a thick full-width crossbar.
  rounded(b("glare-shield"), [0, -0.108, -0.765], [0.96, 0.022, 0.095], 0.009, [-0.045, 0, 0]);
  box(b("glare-shield"), [0, -0.127, -0.724], [0.92, 0.006, 0.020], [-0.045, 0, 0]);

  // HUD support structure only. The optical plate, screen and all controls are intentionally absent.
  rounded(b("glare-shield"), [0, -0.005, -0.905], [0.190, 0.046, 0.068], 0.009);
  for (const side of [-1, 1] as const) {
    box(b("glare-shield"), [side * 0.084, 0.064, -0.940], [0.007, 0.120, 0.009], [0.045, side * 0.04, 0]);
  }
  box(b("glare-shield"), [0, 0.124, -0.934], [0.180, 0.012, 0.012]);

  // Side consoles are narrow, low-profile and built into the sloping tub walls.
  // Their horizontal decks meet separate inward-facing vertical faces; no bulky top rails.
  for (const side of [-1, 1] as const) {
    const part: ShellPart = side < 0 ? "port-console" : "starboard-console";
    const x = side * 0.385;
    const deckRotation: Vec3 = [0, 0, side * 0.18];

    // Horizontal console deck: much thinner and narrower than the previous slab.
    rounded(b(part), [x, -0.485, -0.10], [0.150, 0.038, 1.14], 0.010, deckRotation);
    rounded(b(part), [side * 0.446, -0.465, -0.10], [0.014, 0.022, 1.05], 0.005, deckRotation);

    // Vertical inner console face, canted toward the pilot and attached to the deck edge.
    rounded(
      b(part),
      [side * 0.303, -0.580, -0.12],
      [0.014, 0.185, 0.94],
      0.006,
      [0.025, side * 0.10, side * 0.12]
    );

    // Empty mounting bays are flush outlines only, not raised boxes or switches.
    consoleBay(b(part), x, -0.462, -0.405, 0.112, 0.235, deckRotation);
    consoleBay(b(part), x, -0.462, -0.055, 0.112, 0.255, deckRotation);
    consoleBay(b(part), side * 0.303, -0.580, -0.36, 0.105, 0.205, [0.025, side * 0.10, side * 0.12]);
    consoleBay(b(part), side * 0.303, -0.580, 0.08, 0.105, 0.205, [0.025, side * 0.10, side * 0.12]);
  }

  // Blank central lower pedestal and recessed footwell walls; no stick or rudder pedals.
  rounded(b("central-pedestal"), [0, -0.724, -0.405], [0.285, 0.100, 0.315], 0.018, [-0.14, 0, 0]);
  rounded(b("central-pedestal"), [0, -0.655, -0.405], [0.255, 0.010, 0.270], 0.006, [-0.14, 0, 0]);
  for (const side of [-1, 1] as const) {
    rounded(b("tub"), [side * 0.205, -0.785, -0.45], [0.050, 0.045, 0.56], 0.012, [0.10, 0, side * 0.10]);
  }

  // Bare K-36 family seat frame only; the seat pan, cushions, straps and handles are omitted.
  for (const side of [-1, 1] as const) {
    const x = side * 0.235;
    box(b("seat-frame"), [x, -0.41, 0.72], [0.024, 0.63, 0.075], [0.16, 0, 0]);
    cylinder(b("seat-frame"), [x, -0.40, 0.77], 0.008, 0.52, [0, 1, 0], 12);
  }
  rounded(b("seat-frame"), [0, -0.40, 0.80], [0.43, 0.57, 0.075], 0.026, [0.16, 0, 0]);
  rounded(b("seat-frame"), [0, -0.70, 0.49], [0.45, 0.10, 0.36], 0.030);
  rounded(b("seat-frame"), [0, 0.005, 1.00], [0.36, 0.24, 0.075], 0.028);

  // Canopy framing: slim side rails and a single aft bow. No forward hoop across the windscreen.
  for (const side of [-1, 1] as const) {
    rounded(b("canopy-frame"), [side * 0.502, 0.065, -0.12], [0.012, 0.014, 1.88], 0.003);
    rounded(b("canopy-frame"), [side * 0.478, -0.160, -0.12], [0.022, 0.026, 1.90], 0.005);
  }
  const aftBowZ = 1.045;
  const aftPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const theta = -Math.PI / 2 + Math.PI * i / 40;
    aftPoints.push(new THREE.Vector3(
      0.505 * Math.sin(theta),
      0.08 + (0.40 - 0.08) * Math.cos(theta),
      aftBowZ
    ));
  }
  for (let i = 0; i < aftPoints.length - 1; i++) {
    const delta = aftPoints[i + 1]!.clone().sub(aftPoints[i]!);
    const middle = aftPoints[i]!.clone().add(aftPoints[i + 1]!).multiplyScalar(0.5);
    cylinder(
      b("canopy-frame"),
      [middle.x, middle.y, middle.z],
      0.0042,
      delta.length() + 0.002,
      [delta.x, delta.y, delta.z],
      8
    );
  }

  const shell = new THREE.Group();
  shell.name = "mig29-9-13-cockpit-shell-frame";
  for (const part of Object.keys(buckets) as ShellPart[]) {
    const material = part === "panel-support" ? INSET_CLAY : part === "panel-recess" ? RECESS_CLAY : CLAY;
    const mesh = materialMesh(part, buckets[part], material);
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
  shell.userData.frontCanopyBowIncluded = false;
  shell.userData.panelSections = PANEL_SECTIONS.map((section) => ({
    name: section.part,
    minU: section.minU,
    maxU: section.maxU,
    yawRad: section.yawRad,
    topV: section.topV,
    bottomV: section.bottomV
  }));
  shell.userData.provenance = "Reference-guided family-level reconstruction informed by IrasD MiG-29 cockpit photographs 1-4, DCS 9-12 cockpit overview and GAF T.O. panel-location figures. Dimensions and exact product 9.13 fit remain unverified.";
  return shell;
}
