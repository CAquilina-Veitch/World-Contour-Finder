# World Contour Finder

A simple browser tool for **clipping an artistic 3D chunk of the world**. Fly to
a latitude/longitude like Google Earth, drop a center anchor that snaps to the
ground automatically, define a bounding box (e.g. `200m x 200m x 80m`), and fade
everything outside the box with a transparency slider so you can frame a clean
chunk without losing your bearings.

Built with [CesiumJS](https://cesium.com/platform/cesiumjs/) + [Vite](https://vitejs.dev/).

## Features

- **Fly to any coordinate** – type `lat, lon` and the camera flies in with an
  oblique framing.
- **Ground-snapped anchor** – the center marker auto-detects ground level from
  the terrain / 3D tiles.
- **Editable bounding box** – paste `W x D x H` in metres, or drag the handles:
  the white **center** handle moves the box along the ground; colored **face**
  handles resize it (red = width/east, green = depth/north, blue = height/up).
- **Outside fade** – a custom shader fades geometry outside the box toward a
  chosen transparency (slider: `0 %` = full context → `100 %` hidden = a clean
  chunk). Plus **Hard** clip and **Off** modes.
- **Two switchable data sources**
  - **Cesium (free):** Cesium World Terrain + OSM Buildings — needs a free
    [Cesium ion token](https://ion.cesium.com/tokens).
  - **Google 3D:** Google Photorealistic 3D Tiles (the true "Google Earth"
    photo-mesh) — needs a
    [Google Maps Platform API key](https://console.cloud.google.com/google/maps-apis/)
    with the **Map Tiles API** enabled and billing on. Its free tier (~1,000
    root-tile sessions/month) is effectively free for personal use.
- **Presets** – save/load a chunk (lat-long + dimensions) in the browser, or
  export/import it as JSON.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Then open **Settings → API keys** in the panel and paste your Cesium ion token
(and optionally a Google key). Keys are stored **only in your browser's
localStorage** — nothing is committed.

```bash
npm run build    # static site in dist/
npm run preview
```

## How the clipping works

The fade is a Cesium `CustomShader` applied to the active tileset. For each
fragment it transforms the world position into the box's local frame, measures
how far outside the box it is, and lerps its alpha from opaque (inside) toward
the slider value (outside), with a soft feather band on the edge. The **Hard**
mode is a second shader that instead `discard`s fragments outside the box for a
true cut with correct depth. Both work in ECEF (via `positionWC`), so they don't
depend on any per-tileset reference frame. See `src/shading/clipShader.js`.

> Note: translucent 3D Tiles are not perfectly depth-sorted, so at partial
> transparency you'll see a slight "ghost" look — this is inherent to
> see-through 3D tiles and is most visible on the dense Google mesh. Use **Hard**
> mode (or slide fully to hidden) for a crisp cut.

## Project layout

```
src/
  main.js                composition root
  config.js              defaults + localStorage keys
  state/boxState.js      single source of truth + pub/sub
  core/                  viewer, dataSources, camera, groundSnap
  box/                   boxModel (math), boxGizmo (visuals), boxInteraction (drag)
  shading/               clipShader (fade + hard), clipController
  ui/                    panel, panel.css, toast
  persistence/           presets (JSON + localStorage), keys
```

## Notes & limitations

- Ground snapping needs terrain/tiles loaded; it refines on drag release.
- Box rotation (yaw) is stored in the data model but not yet editable in the UI.
- Mesh export (GLB/glTF) is not implemented; the preset JSON captures enough to
  reproduce a chunk exactly. Note Google's tiles cannot be exported as a mesh
  per their terms — mesh export would require a non-Google source.
- If `vite-plugin-cesium` ever lags a Cesium release, fall back to setting
  `CESIUM_BASE_URL` manually and copying Cesium's `Build/Cesium/{Assets,Workers,
  Widgets,ThirdParty}` into the served assets.
