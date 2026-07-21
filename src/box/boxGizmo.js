import * as Cesium from 'cesium';
import * as boxModel from './boxModel.js';

// Visuals for the box: a translucent box, a ground pivot/anchor handle, and six
// draggable face handles. Handles are tagged with `gizmoRole` so the interaction
// layer can identify what was picked. Updated imperatively on state change so we
// stay compatible with requestRenderMode.

const FACE_ROLES = ['+x', '-x', '+y', '-y', '+z', '-z'];
const HANDLE_COLORS = {
  x: Cesium.Color.fromCssColorString('#ff5a5a'), // width  (east)
  y: Cesium.Color.fromCssColorString('#5aff7a'), // depth  (north)
  z: Cesium.Color.fromCssColorString('#5a9dff') // height (up)
};

function orientationFromState(state) {
  const m = boxModel.modelMatrix(state);
  const rot = Cesium.Matrix4.getMatrix3(m, new Cesium.Matrix3());
  return Cesium.Quaternion.fromRotationMatrix(rot, new Cesium.Quaternion());
}

export function createBoxGizmo(viewer, boxState) {
  const entities = viewer.entities;

  const boxEntity = entities.add({
    position: boxModel.centerECEF(boxState.get()),
    orientation: orientationFromState(boxState.get()),
    box: {
      dimensions: boxModel.fullDimensions(boxState.get()),
      fill: true,
      material: Cesium.Color.fromCssColorString('#4fc3f7').withAlpha(0.08),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('#4fc3f7').withAlpha(0.9),
      outlineWidth: 2
    }
  });

  // Pivot / anchor handle at the ground centre.
  const pivotEntity = entities.add({
    position: boxModel.groundECEF(boxState.get()),
    point: {
      pixelSize: 16,
      color: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.fromCssColorString('#4fc3f7'),
      outlineWidth: 3,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    },
    label: {
      text: 'center',
      font: '12px system-ui, sans-serif',
      fillColor: Cesium.Color.WHITE,
      showBackground: true,
      backgroundColor: Cesium.Color.BLACK.withAlpha(0.6),
      pixelOffset: new Cesium.Cartesian2(0, -22),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      style: Cesium.LabelStyle.FILL
    }
  });
  pivotEntity.gizmoRole = 'pivot';

  // Vertical stem from the ground anchor to the box top, for legibility.
  const stemEntity = entities.add({
    polyline: {
      positions: [boxModel.groundECEF(boxState.get()), boxModel.centerECEF(boxState.get())],
      width: 1.5,
      material: Cesium.Color.WHITE.withAlpha(0.5),
      arcType: Cesium.ArcType.NONE
    }
  });

  const faceEntities = FACE_ROLES.map((role) => {
    const e = entities.add({
      position: boxModel.faceHandlePosition(boxState.get(), role),
      point: {
        pixelSize: 13,
        color: HANDLE_COLORS[role[1]],
        outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    e.gizmoRole = role;
    return e;
  });

  function update() {
    const s = boxState.get();
    boxEntity.position = boxModel.centerECEF(s);
    boxEntity.orientation = orientationFromState(s);
    boxEntity.box.dimensions = boxModel.fullDimensions(s);

    pivotEntity.position = boxModel.groundECEF(s);
    stemEntity.polyline.positions = [boxModel.groundECEF(s), boxModel.centerECEF(s)];

    faceEntities.forEach((e, i) => {
      e.position = boxModel.faceHandlePosition(s, FACE_ROLES[i]);
    });

    viewer.scene.requestRender();
  }

  const unsubscribe = boxState.subscribe(update);
  update();

  function roleOf(pickedId) {
    return pickedId && pickedId.gizmoRole ? pickedId.gizmoRole : null;
  }

  function setVisible(visible) {
    boxEntity.show = visible;
    pivotEntity.show = visible;
    stemEntity.show = visible;
    faceEntities.forEach((e) => (e.show = visible));
    viewer.scene.requestRender();
  }

  // Our own entities, so ground-height sampling can exclude them and never
  // snap onto the box we're drawing.
  const allEntities = [boxEntity, pivotEntity, stemEntity, ...faceEntities];

  return { roleOf, setVisible, update, entities: allEntities, destroy: unsubscribe };
}
