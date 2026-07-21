import * as Cesium from 'cesium';

// Create and configure the Cesium Viewer for this app. We strip out the
// widgets we don't need and turn on terrain depth testing so the anchor and
// box handles sit correctly against the ground.
export function createViewer(containerId) {
  const viewer = new Cesium.Viewer(containerId, {
    // Trim default UI chrome; we drive everything from our own panel.
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    selectionIndicator: false,
    infoBox: false,
    // Only re-render when something changes -> much lower idle GPU/CPU use.
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity
  });

  const scene = viewer.scene;
  scene.globe.depthTestAgainstTerrain = true;
  scene.globe.showGroundAtmosphere = true;
  // Slightly darker background than default for the "artistic" feel.
  scene.skyAtmosphere.show = true;

  // Cesium ion attribution / credits must stay visible (also Google ToS).
  return viewer;
}

// requestRenderMode means we must explicitly ask for a redraw after mutating
// entities, uniforms, etc. that Cesium can't detect on its own.
export function requestRender(viewer) {
  viewer.scene.requestRender();
}
