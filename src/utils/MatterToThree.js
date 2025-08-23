import * as THREE from "three";
// api: {x, y, z} → {x, z, -y}
export function convertPosition(apiVec) {
  return new THREE.Vector3(apiVec.x, apiVec.z, -apiVec.y);
}

// rotate basis change
export function convertRotation(apiQuat) {
  // construct quaternion from api
  const q = new THREE.Quaternion(apiQuat.x, apiQuat.y, apiQuat.z, apiQuat.w);

  // rotate from matt "z-up" → three "y-up"
  const zUpToYUp = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, 0, Math.PI / 2, "XYZ") // rotate -90 in x
  );

  // handedness (matt uses right, three uses left)
  const flipHandedness = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI
  );

  // combine transform
  q.premultiply(zUpToYUp).premultiply(flipHandedness).normalize();

  // clean shape
  return {
    x: q.x,
    y: q.z,
    z: q.y,
    w: q.w,
  };
}
