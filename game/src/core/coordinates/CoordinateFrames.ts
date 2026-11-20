export type Vector3 = readonly [number, number, number];
export type Quaternion = readonly [number, number, number, number];

export interface WorldEnuVector {
  readonly frame: "world.enu";
  readonly value: Vector3;
}
export interface AircraftBodyFrdVector {
  readonly frame: "aircraft.body.frd";
  readonly value: Vector3;
}

/** [x,y,z,w] quaternion mapping aircraft body FRD vectors into world ENU. */
export type BodyToWorldOrientation = Quaternion;

function assertFiniteVector(vector: Vector3): void {
  if (vector.length !== 3 || !vector.every(Number.isFinite)) {
    throw new RangeError("Vector must contain exactly three finite components.");
  }
}
function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  const [x, y, z, w] = quaternion;
  const magnitude = Math.hypot(x, y, z, w);
  if (!Number.isFinite(magnitude) || magnitude <= Number.EPSILON) {
    throw new RangeError("Quaternion must contain finite values and have non-zero magnitude.");
  }
  return [x / magnitude, y / magnitude, z / magnitude, w / magnitude];
}
function cross(a: Vector3, b: Vector3): Vector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
function rotate(vector: Vector3, quaternion: Quaternion): Vector3 {
  assertFiniteVector(vector);
  const [qx, qy, qz, qw] = normalizeQuaternion(quaternion);
  const qVector: Vector3 = [qx, qy, qz];
  const crossResult = cross(qVector, vector);
  const twiceCross: Vector3 = [crossResult[0] * 2, crossResult[1] * 2, crossResult[2] * 2];
  const secondCross = cross(qVector, twiceCross);
  return [
    vector[0] + qw * twiceCross[0] + secondCross[0],
    vector[1] + qw * twiceCross[1] + secondCross[1],
    vector[2] + qw * twiceCross[2] + secondCross[2]
  ];
}
export function bodyFrdToWorldEnu(
  vector: AircraftBodyFrdVector,
  bodyToWorld: BodyToWorldOrientation
): WorldEnuVector {
  return { frame: "world.enu", value: rotate(vector.value, bodyToWorld) };
}
export function worldEnuToBodyFrd(
  vector: WorldEnuVector,
  bodyToWorld: BodyToWorldOrientation
): AircraftBodyFrdVector {
  const [x, y, z, w] = normalizeQuaternion(bodyToWorld);
  return {
    frame: "aircraft.body.frd",
    value: rotate(vector.value, [-x, -y, -z, w])
  };
}
