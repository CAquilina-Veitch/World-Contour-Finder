import * as Cesium from 'cesium';
import { SOURCE } from '../config.js';

// Manages the two switchable data sources and owns the "primary tileset" that
// the clip shader / clipping planes attach to.
//
//  - ion:    Cesium World Terrain (relief) + Cesium OSM Buildings (the tileset)
//  - google: Google Photorealistic 3D Tiles (ground + buildings in one mesh)
//
// On switch we tear down the previous source and notify listeners so the clip
// controller can re-attach to the new tileset.
export function createDataSourceManager(viewer) {
  const scene = viewer.scene;
  let source = null;
  let osmTileset = null;
  let googleTileset = null;
  const listeners = new Set();

  function onTilesetChanged(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify() {
    const tileset = getPrimaryTileset();
    for (const fn of listeners) fn(tileset, source);
  }

  function getPrimaryTileset() {
    if (source === SOURCE.google) return googleTileset;
    if (source === SOURCE.ion) return osmTileset;
    return null;
  }

  // Isolated so a Cesium API rename only touches this one function. Cesium
  // 1.143 exposes createGooglePhotorealistic3DTileset({ key }); older builds
  // used the ...Async name (and once took the key positionally).
  async function loadGoogleTileset(key) {
    Cesium.GoogleMaps.defaultApiKey = key;
    const create =
      Cesium.createGooglePhotorealistic3DTileset || Cesium.createGooglePhotorealistic3DTilesetAsync;
    try {
      return await create({ key });
    } catch (err) {
      // Older Cesium builds took the key as the first positional argument.
      return await create(key);
    }
  }

  async function activateIon() {
    // Google tiles carry their own ground; switch back to real terrain + globe.
    scene.setTerrain(Cesium.Terrain.fromWorldTerrain());
    scene.globe.show = true;

    if (googleTileset) {
      googleTileset.show = false;
    }
    if (!osmTileset) {
      osmTileset = await Cesium.createOsmBuildingsAsync();
      scene.primitives.add(osmTileset);
    }
    osmTileset.show = true;
    source = SOURCE.ion;
    notify();
  }

  async function activateGoogle(key) {
    if (!key) throw new Error('Google Maps Platform API key required.');
    // The photorealistic mesh includes terrain; hide the globe so the blue
    // ellipsoid doesn't poke through gaps, and drop to a flat terrain provider.
    scene.setTerrain(new Cesium.Terrain(Promise.resolve(new Cesium.EllipsoidTerrainProvider())));
    scene.globe.show = false;

    if (osmTileset) {
      osmTileset.show = false;
    }
    if (!googleTileset) {
      googleTileset = await loadGoogleTileset(key);
      scene.primitives.add(googleTileset);
    }
    googleTileset.show = true;
    source = SOURCE.google;
    notify();
  }

  // Switch to a source. Throws if the required key is missing so the caller can
  // surface a friendly prompt and leave the previous source active.
  async function setSource(next, { ionToken, googleKey } = {}) {
    if (next === SOURCE.google) {
      await activateGoogle(googleKey);
    } else {
      if (!ionToken) throw new Error('Cesium ion token required.');
      Cesium.Ion.defaultAccessToken = ionToken;
      await activateIon();
    }
    return getPrimaryTileset();
  }

  return {
    setSource,
    getPrimaryTileset,
    getSource: () => source,
    onTilesetChanged
  };
}
