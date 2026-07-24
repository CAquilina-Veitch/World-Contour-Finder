import * as Cesium from 'cesium';
import * as boxModel from '../box/boxModel.js';

// Real geometry clipping for the terrain globe (the CustomShaders in
// clipShader.js only reach a tileset's fragments; the globe needs a
// ClippingPlaneCollection). Six axis-aligned planes with INWARD normals in the
// box-local frame keep the interior of the box:
//
//   unionClippingRegions = true  => a fragment is clipped if it is outside ANY
//   face. The union of the six outward half-spaces is "everything outside the
//   box", so the kept region is exactly the box interior.
//
// The planes live in the frame given by the collection's modelMatrix; we reuse
// boxModel.modelMatrix (an ECEF East-North-Up frame at the box centre, with the
// box's yaw) so the terrain cut lines up precisely with the drawn gizmo box.

// Plane distances map to half-extents in local x,x,y,y,z,z order.
function distances(state) {
  const he = boxModel.halfExtents(state);
  return [he.x, he.x, he.y, he.y, he.z, he.z];
}

export function createBoxClippingPlanes(state) {
  const he = boxModel.halfExtents(state);
  const planes = [
    new Cesium.ClippingPlane(new Cesium.Cartesian3(-1, 0, 0), he.x), // +x face
    new Cesium.ClippingPlane(new Cesium.Cartesian3(1, 0, 0), he.x), // -x face
    new Cesium.ClippingPlane(new Cesium.Cartesian3(0, -1, 0), he.y), // +y face
    new Cesium.ClippingPlane(new Cesium.Cartesian3(0, 1, 0), he.y), // -y face
    new Cesium.ClippingPlane(new Cesium.Cartesian3(0, 0, -1), he.z), // +z face
    new Cesium.ClippingPlane(new Cesium.Cartesian3(0, 0, 1), he.z) // -z face
  ];
  return new Cesium.ClippingPlaneCollection({
    planes,
    modelMatrix: boxModel.modelMatrix(state),
    unionClippingRegions: true,
    edgeColor: Cesium.Color.CYAN,
    edgeWidth: 1.0
  });
}

// Cheap per-drag update: mutate the modelMatrix and plane distances in place so
// we never rebuild the collection (which would drop it from the globe).
export function updateBoxClippingPlanes(collection, state) {
  if (!collection) return;
  boxModel.modelMatrix(state, collection.modelMatrix);
  const d = distances(state);
  for (let i = 0; i < collection.length; i++) {
    collection.get(i).distance = d[i];
  }
}
