import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { SOURCE, DEFAULTS } from './config.js';
import { createViewer } from './core/viewer.js';
import { createDataSourceManager } from './core/dataSources.js';
import { flyTo, rangeForBox } from './core/camera.js';
import { createDebouncedGroundSnap } from './core/groundSnap.js';
import { createBoxState } from './state/boxState.js';
import { createBoxGizmo } from './box/boxGizmo.js';
import { createBoxInteraction } from './box/boxInteraction.js';
import { createClipController } from './shading/clipController.js';
import { createPanel } from './ui/panel.js';
import { showToast } from './ui/toast.js';
import { keys } from './persistence/keys.js';
import {
  loadLastState,
  saveLastState,
  savePreset,
  loadPreset,
  deletePreset,
  exportJSON,
  importJSON
} from './persistence/presets.js';

// ---- Bootstrap ----------------------------------------------------------
const ionToken = keys.getIonToken();
if (ionToken) Cesium.Ion.defaultAccessToken = ionToken;

const viewer = createViewer('cesiumContainer');
const scene = viewer.scene;

const boxState = createBoxState(loadLastState() || {});
const dataSources = createDataSourceManager(viewer);
const gizmo = createBoxGizmo(viewer, boxState);
const clip = createClipController(viewer, boxState);

// Re-attach clipping to whatever tileset becomes active.
dataSources.onTilesetChanged((tileset) => clip.attach(tileset));

// Ground snapping (debounced) writes groundHeight back into the box state.
const snapper = createDebouncedGroundSnap(
  scene,
  () => gizmo.entities,
  (h) => boxState.set({ groundHeight: h }),
  DEFAULTS.groundSnapDebounceMs
);
const scheduleSnap = (lon, lat) => snapper.schedule(lon, lat);

createBoxInteraction(viewer, boxState, gizmo, {
  onPivotMoved: (lon, lat) => scheduleSnap(lon, lat)
});

// Persist the box between reloads.
boxState.subscribe((s) => saveLastState(s));

function notify(message, opts) {
  showToast(message, { kind: 'warn', timeout: 4500, ...opts });
}

function flyToState() {
  const s = boxState.get();
  flyTo(viewer, { lon: s.lon, lat: s.lat, groundHeight: s.groundHeight, range: rangeForBox(s) });
}

// ---- Actions wired to the panel ----------------------------------------
const actions = {
  notify,

  fly(lon, lat) {
    boxState.set({ lon, lat });
    scheduleSnap(lon, lat);
    flyToState();
  },

  async setSource(next) {
    try {
      await dataSources.setSource(next, {
        ionToken: keys.getIonToken(),
        googleKey: keys.getGoogleKey()
      });
      keys.setSource(next);
      panel.setActiveSource(next);
      // Re-snap the anchor now that a different surface is loaded.
      const s = boxState.get();
      scheduleSnap(s.lon, s.lat);
    } catch (err) {
      panel.setActiveSource(dataSources.getSource() || SOURCE.ion);
      if (next === SOURCE.google) {
        notify('Add a Google Maps API key in Settings to load photorealistic tiles.', {
          linkText: 'Get key',
          linkHref: 'https://console.cloud.google.com/google/maps-apis/'
        });
      } else {
        notify('Add a free Cesium ion token in Settings to load terrain & buildings.', {
          linkText: 'Get token',
          linkHref: 'https://ion.cesium.com/tokens'
        });
      }
    }
  },

  applyDims(dims) {
    boxState.set(dims);
  },

  setOutsideAlpha(v) {
    clip.setOutsideAlpha(v);
  },

  setFeather(v) {
    clip.setFeather(v);
  },

  setClipMode(mode) {
    clip.setMode(mode);
    panel.setActiveMode(mode);
  },

  savePreset(name) {
    savePreset(name, boxState.get());
  },

  loadPreset(name) {
    const s = loadPreset(name);
    if (s) {
      boxState.set(s);
      flyToState();
    }
  },

  deletePreset(name) {
    deletePreset(name);
  },

  exportPreset(name) {
    exportJSON(boxState.get(), name);
  },

  async importPreset(file) {
    try {
      const s = await importJSON(file);
      boxState.set(s);
      flyToState();
    } catch (_) {
      notify('Could not read that JSON file.');
    }
  },

  saveKeys({ ionToken: ion, googleKey: google }) {
    keys.setIonToken(ion);
    keys.setGoogleKey(google);
    if (ion) Cesium.Ion.defaultAccessToken = ion;
    // Reload the currently selected source with the new credentials.
    actions.setSource(dataSources.getSource() || keys.getSource());
    showToast('Keys saved.', { kind: 'info', timeout: 2500 });
  }
};

// ---- UI -----------------------------------------------------------------
const panel = createPanel(boxState, actions, {
  ionToken: keys.getIonToken(),
  googleKey: keys.getGoogleKey(),
  outsideAlpha: clip.getOutsideAlpha(),
  feather: clip.getFeather()
});
panel.setActiveMode(clip.getMode());

// ---- Initial activation -------------------------------------------------
(async function init() {
  let source = keys.getSource();
  const hasIon = !!keys.getIonToken();
  const hasGoogle = !!keys.getGoogleKey();

  if (source === SOURCE.google && !hasGoogle) source = SOURCE.ion;

  panel.setActiveSource(source);

  if (source === SOURCE.ion && !hasIon) {
    notify('Add a free Cesium ion token in Settings to load terrain & buildings.', {
      linkText: 'Get token',
      linkHref: 'https://ion.cesium.com/tokens',
      timeout: 0
    });
  } else {
    await actions.setSource(source);
  }

  flyToState();
})();
