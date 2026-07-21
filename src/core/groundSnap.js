import * as Cesium from 'cesium';

// Resolve the ground height (metres above the ellipsoid) at a lon/lat.
//
// Strategy, most-accurate first:
//   1. clampToHeightMostDetailed onto the loaded surface (3D tiles + terrain).
//   2. sampleHeightMostDetailed (works when 3D tiles or terrain are loaded).
//   3. sampleTerrainMostDetailed against the terrain provider (ion terrain).
//   4. fall back to 0 (ellipsoid surface).
//
// `exclude` is the list of our own gizmo entities so we never snap onto the box
// we're drawing. All of these need tiles/terrain loaded, so callers should
// debounce and treat the result as "best effort, refined on release".
export async function sampleGroundHeight(scene, lon, lat, exclude = []) {
  const carto = Cesium.Cartographic.fromDegrees(lon, lat);

  // 1. Clamp a point high above the surface straight down onto the scene.
  if (scene.clampToHeightSupported) {
    try {
      const start = Cesium.Cartesian3.fromDegrees(lon, lat, 10000);
      const results = await scene.clampToHeightMostDetailed([start], exclude);
      if (results[0]) {
        const h = Cesium.Cartographic.fromCartesian(results[0]).height;
        if (Number.isFinite(h)) return h;
      }
    } catch (_) {
      /* fall through */
    }
  }

  // 2. Sample height (tileset or terrain, whichever intersects).
  if (scene.sampleHeightSupported) {
    try {
      const results = await scene.sampleHeightMostDetailed([carto], exclude);
      const h = results[0] && results[0].height;
      if (Number.isFinite(h)) return h;
    } catch (_) {
      /* fall through */
    }
  }

  // 3. Terrain-only fallback.
  try {
    const provider = scene.terrainProvider;
    if (provider && !(provider instanceof Cesium.EllipsoidTerrainProvider)) {
      const [res] = await Cesium.sampleTerrainMostDetailed(provider, [carto.clone()]);
      if (res && Number.isFinite(res.height)) return res.height;
    }
  } catch (_) {
    /* fall through */
  }

  // 4. Ellipsoid surface.
  return 0;
}

// A small debounced wrapper so dragging doesn't fire dozens of async samples.
// `getExclude` returns the gizmo entities to keep out of the height sample.
export function createDebouncedGroundSnap(scene, getExclude, onHeight, delayMs = 150) {
  let timer = null;
  let seq = 0;

  function schedule(lon, lat) {
    if (timer) clearTimeout(timer);
    const mySeq = ++seq;
    timer = setTimeout(async () => {
      const h = await sampleGroundHeight(scene, lon, lat, getExclude());
      // Ignore stale results if a newer request has since been scheduled.
      if (mySeq === seq) onHeight(h);
    }, delayMs);
  }

  return { schedule };
}
