import * as Cesium from 'cesium';
import * as boxModel from '../box/boxModel.js';
import { createFadeShader, createHardShader, updateClipShaderUniforms } from './clipShader.js';
import { createBoxClippingPlanes, updateBoxClippingPlanes } from './clipPlanes.js';
import { CLIP_MODE, DEFAULTS } from '../config.js';

// Coordinates the fade / hard / off clip modes. Two clip mechanisms, one per
// surface, both driven from the same box state:
//   - the TILESET (OSM Buildings / Google mesh) uses a CustomShader (fade ramp
//     or hard discard) — the globe can't take a per-fragment custom shader.
//   - the TERRAIN globe uses a real ClippingPlaneCollection, since the shader
//     never reaches it. Terrain can't fade, so it is a hard cut whenever any
//     clip mode is active (fade or hard); off restores it.
export function createClipController(viewer, boxState) {
  const fadeShader = createFadeShader();
  const hardShader = createHardShader();
  const globeClip = createBoxClippingPlanes(boxState.get());
  viewer.scene.globe.clippingPlanes = globeClip;
  let tileset = null;
  let mode = DEFAULTS.clipMode;
  let outsideAlpha = DEFAULTS.outsideAlpha;
  let feather = DEFAULTS.feather;

  function applyMode() {
    // Terrain is cut whenever a clip mode is active; the fade/hard distinction
    // only governs how the tileset renders outside the box.
    globeClip.enabled = mode !== CLIP_MODE.off;
    if (!tileset) return;
    if (mode === CLIP_MODE.fade) tileset.customShader = fadeShader;
    else if (mode === CLIP_MODE.hard) tileset.customShader = hardShader;
    else tileset.customShader = undefined;
  }

  function refresh() {
    const state = boxState.get();
    const params = boxModel.shaderParams(state);
    const values = {
      center: params.center,
      rotInv: params.rotInv,
      halfExtents: params.halfExtents,
      outsideAlpha,
      feather
    };
    updateClipShaderUniforms(fadeShader, values);
    updateClipShaderUniforms(hardShader, values);
    updateBoxClippingPlanes(globeClip, state);
    viewer.scene.requestRender();
  }

  // Called by the data-source manager whenever the active tileset changes.
  function attach(nextTileset) {
    tileset = nextTileset;
    if (tileset) tileset.backFaceCulling = true;
    applyMode();
    refresh();
  }

  function setMode(nextMode) {
    mode = nextMode;
    applyMode();
    refresh();
  }

  function setOutsideAlpha(value) {
    outsideAlpha = Cesium.Math.clamp(value, 0, 1);
    refresh();
  }

  function setFeather(value) {
    feather = Math.max(0.001, value);
    refresh();
  }

  // Sync globe clipping to the initial mode even before a tileset attaches.
  applyMode();
  refresh();
  boxState.subscribe(refresh);

  return {
    attach,
    setMode,
    setOutsideAlpha,
    setFeather,
    getMode: () => mode,
    getOutsideAlpha: () => outsideAlpha,
    getFeather: () => feather
  };
}
