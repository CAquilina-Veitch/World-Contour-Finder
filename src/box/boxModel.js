import * as Cesium from 'cesium';

// Geometry helpers: convert the flat box state into ECEF frames, extents and
// the parameters the clip shader needs.
//
// Local box axes (East-North-Up at the anchor):
//   x = east  -> width
//   y = north -> depth
//   z = up    -> height (base sits on the ground, box grows upward)

// ECEF point at the ground anchor.
export function groundECEF(state, result = new Cesium.Cartesian3()) {
  return Cesium.Cartesian3.fromDegrees(state.lon, state.lat, state.groundHeight, Cesium.Ellipsoid.WGS84, result);
}

// ECEF point at the box centre (half the height above the ground).
export function centerECEF(state, result = new Cesium.Cartesian3()) {
  return Cesium.Cartesian3.fromDegrees(
    state.lon,
    state.lat,
    state.groundHeight + state.height / 2,
    Cesium.Ellipsoid.WGS84,
    result
  );
}

// Full model matrix: ENU frame at the centre, optionally yawed about local up.
export function modelMatrix(state, result = new Cesium.Matrix4()) {
  const center = centerECEF(state);
  Cesium.Transforms.eastNorthUpToFixedFrame(center, Cesium.Ellipsoid.WGS84, result);
  if (state.rotation) {
    const rot = Cesium.Matrix4.fromRotationTranslation(
      Cesium.Matrix3.fromRotationZ(state.rotation),
      Cesium.Cartesian3.ZERO,
      new Cesium.Matrix4()
    );
    Cesium.Matrix4.multiply(result, rot, result);
  }
  return result;
}

export function halfExtents(state, result = new Cesium.Cartesian3()) {
  result.x = state.width / 2;
  result.y = state.depth / 2;
  result.z = state.height / 2;
  return result;
}

// The world-space dimensions of a full box as a Cartesian3 (for BoxGraphics).
export function fullDimensions(state, result = new Cesium.Cartesian3()) {
  result.x = state.width;
  result.y = state.depth;
  result.z = state.height;
  return result;
}

// Parameters the fade shader consumes. We pass the centre + inverse rotation
// separately (rather than one big inverse MAT4) so the shader subtracts the
// large ECEF offset BEFORE rotating -> avoids catastrophic float cancellation.
export function shaderParams(state) {
  const m = modelMatrix(state);
  const center = Cesium.Matrix4.getTranslation(m, new Cesium.Cartesian3());
  const rot = Cesium.Matrix4.getMatrix3(m, new Cesium.Matrix3());
  const rotInv = Cesium.Matrix3.transpose(rot, new Cesium.Matrix3()); // orthonormal -> transpose = inverse
  return {
    center,
    rotInv,
    halfExtents: halfExtents(state)
  };
}

// World-space direction of a local axis (unit length). role in {x,y,z}.
export function axisWorld(state, role, result = new Cesium.Cartesian3()) {
  const m = modelMatrix(state);
  const local =
    role === 'x'
      ? Cesium.Cartesian3.UNIT_X
      : role === 'y'
      ? Cesium.Cartesian3.UNIT_Y
      : Cesium.Cartesian3.UNIT_Z;
  Cesium.Matrix4.multiplyByPointAsVector(m, local, result);
  return Cesium.Cartesian3.normalize(result, result);
}

// World position of a face-handle centre. role like '+x', '-y', '+z'.
export function faceHandlePosition(state, role) {
  const m = modelMatrix(state);
  const he = halfExtents(state);
  const sign = role[0] === '+' ? 1 : -1;
  const axis = role[1];
  const local = new Cesium.Cartesian3(
    axis === 'x' ? sign * he.x : 0,
    axis === 'y' ? sign * he.y : 0,
    axis === 'z' ? sign * he.z : 0
  );
  return Cesium.Matrix4.multiplyByPoint(m, local, new Cesium.Cartesian3());
}
