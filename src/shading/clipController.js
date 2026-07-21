import * as Cesium from 'cesium';
import * as boxModel from '../box/boxModel.js';
import { createFadeShader, createHardShader, updateClipShaderUniforms } from './clipShader.js';
import { CLIP_MODE, DEFAULTS } from '../config.js';

// Coordinates the fade / hard / off clip modes over whatever tileset is
// currently active. Owns both shaders, keeps their uniforms in sync with the
// box state, and re-attaches to a new tileset when the data source switches.
export function createClipController(viewer, boxState) {
  const fadeShader = createFadeShader();
  const hardShader = createHardShader();
  let tileset = null;
  let mode = DEFAULTS.clipMode;
  let outsideAlpha = DEFAULTS.outsideAlpha;
  let feather = DEFAULTS.feather;

  function applyModeToTileset() {
    if (!tileset) return;
    if (mode === CLIP_MODE.fade) tileset.customShader = fadeShader;
    else if (mode === CLIP_MODE.hard) tileset.customShader = hardShader;
    else tileset.customShader = undefined;
  }

  function refresh() {
    const params = boxModel.shaderParams(boxState.get());
    const values = {
      center: params.center,
      rotInv: params.rotInv,
      halfExtents: params.halfExtents,
      outsideAlpha,
      feather
    };
    updateClipShaderUniforms(fadeShader, values);
    updateClipShaderUniforms(hardShader, values);
    viewer.scene.requestRender();
  }

  // Called by the data-source manager whenever the active tileset changes.
  function attach(nextTileset) {
    tileset = nextTileset;
    if (tileset) tileset.backFaceCulling = true;
    applyModeToTileset();
    refresh();
  }

  function setMode(nextMode) {
    mode = nextMode;
    applyModeToTileset();
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
