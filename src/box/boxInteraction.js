import * as Cesium from 'cesium';
import * as boxModel from './boxModel.js';
import { DEFAULTS } from '../config.js';

// Drag handling for the gizmo. Picks a handle on LEFT_DOWN, drags on
// MOUSE_MOVE, releases on LEFT_UP. Pivot drags along the ground plane; face
// handles resize one dimension while keeping the opposite face anchored.
//
// All movement is computed against a snapshot taken at drag-start (not
// accumulated frame-to-frame) so there's no drift.
export function createBoxInteraction(viewer, boxState, gizmo, { onPivotMoved } = {}) {
  const scene = viewer.scene;
  const camera = scene.camera;
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  const MIN = DEFAULTS.minDimMeters;

  let drag = null;

  function beginDrag(role, screenPos) {
    scene.screenSpaceCameraController.enableInputs = false;
    const start = boxState.get();

    if (role === 'pivot') {
      const groundCenter = boxModel.groundECEF(start);
      const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(groundCenter, new Cesium.Cartesian3());
      const plane = Cesium.Plane.fromPointNormal(groundCenter, up);
      drag = { role, plane, start };
      return;
    }

    // Face handle: outward axis (world) + a camera-facing plane containing it.
    const axisChar = role[1];
    const sign = role[0] === '+' ? 1 : -1;
    const axisWorld = boxModel.axisWorld(start, axisChar, new Cesium.Cartesian3());
    const outwardAxis = Cesium.Cartesian3.multiplyByScalar(axisWorld, sign, new Cesium.Cartesian3());

    const view = camera.directionWC;
    const tmp = Cesium.Cartesian3.cross(outwardAxis, view, new Cesium.Cartesian3());
    const normal = Cesium.Cartesian3.cross(tmp, outwardAxis, new Cesium.Cartesian3());
    if (Cesium.Cartesian3.magnitude(normal) < 1e-6) {
      // Axis nearly parallel to view; bail out of this drag.
      drag = null;
      scene.screenSpaceCameraController.enableInputs = true;
      return;
    }
    Cesium.Cartesian3.normalize(normal, normal);

    const center = boxModel.centerECEF(start);
    const plane = Cesium.Plane.fromPointNormal(center, normal);
    const startHit = rayToPlane(screenPos, plane);
    if (!startHit) {
      drag = null;
      scene.screenSpaceCameraController.enableInputs = true;
      return;
    }
    drag = {
      role,
      outwardAxis,
      plane,
      normal,
      startHit,
      start,
      startGroundCenter: boxModel.groundECEF(start)
    };
  }

  function rayToPlane(screenPos, plane) {
    const ray = camera.getPickRay(screenPos);
    if (!ray) return null;
    // Skip near-grazing intersections to avoid jumpy results.
    if (Math.abs(Cesium.Cartesian3.dot(plane.normal, ray.direction)) < 0.02) return null;
    return Cesium.IntersectionTests.rayPlane(ray, plane, new Cesium.Cartesian3());
  }

  function dragPivot(screenPos) {
    const hit = rayToPlane(screenPos, drag.plane);
    if (!hit) return;
    const carto = Cesium.Cartographic.fromCartesian(hit);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    // Keep the current ground height during the drag; refine async.
    boxState.set({ lon, lat }, { source: 'drag' });
    if (onPivotMoved) onPivotMoved(lon, lat);
  }

  function dragFace(screenPos) {
    const hit = rayToPlane(screenPos, drag.plane);
    if (!hit) return;
    const delta = Cesium.Cartesian3.subtract(hit, drag.startHit, new Cesium.Cartesian3());
    const moveOut = Cesium.Cartesian3.dot(delta, drag.outwardAxis);
    const s = drag.start;
    const axisChar = drag.role[1];

    if (axisChar === 'x' || axisChar === 'y') {
      const key = axisChar === 'x' ? 'width' : 'depth';
      const startDim = s[key];
      const newDim = Math.max(MIN, startDim + moveOut);
      const eff = newDim - startDim; // actual growth after clamping
      const shift = Cesium.Cartesian3.multiplyByScalar(drag.outwardAxis, eff / 2, new Cesium.Cartesian3());
      const newCenter = Cesium.Cartesian3.add(drag.startGroundCenter, shift, new Cesium.Cartesian3());
      const carto = Cesium.Cartographic.fromCartesian(newCenter);
      boxState.set(
        {
          [key]: newDim,
          lon: Cesium.Math.toDegrees(carto.longitude),
          lat: Cesium.Math.toDegrees(carto.latitude)
        },
        { source: 'drag' }
      );
    } else {
      // Vertical: +z moves the top (grow height, base stays grounded);
      // -z moves the base (lift/lower), keeping the top fixed.
      if (drag.role === '+z') {
        const newHeight = Math.max(MIN, s.height + moveOut);
        boxState.set({ height: newHeight }, { source: 'drag' });
      } else {
        const eff = Math.min(moveOut, s.height - MIN); // don't invert the box
        boxState.set(
          { groundHeight: s.groundHeight - eff, height: s.height + eff },
          { source: 'drag' }
        );
      }
    }
  }

  function endDrag() {
    if (drag && drag.role === 'pivot' && onPivotMoved) {
      const s = boxState.get();
      onPivotMoved(s.lon, s.lat, true);
    }
    drag = null;
    scene.screenSpaceCameraController.enableInputs = true;
  }

  handler.setInputAction((click) => {
    const picked = scene.pick(click.position);
    const role = picked ? gizmo.roleOf(picked.id) : null;
    if (!role) return;
    beginDrag(role, click.position);
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction((move) => {
    if (!drag) return;
    if (drag.role === 'pivot') dragPivot(move.endPosition);
    else dragFace(move.endPosition);
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(endDrag, Cesium.ScreenSpaceEventType.LEFT_UP);

  return {
    destroy() {
      handler.destroy();
    }
  };
}
