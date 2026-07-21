import * as Cesium from 'cesium';

// Fly the camera to a lon/lat with a pleasant oblique framing, looking down at
// roughly 45 degrees from a distance scaled to the box so the chunk fills a
// good portion of the view.
export function flyTo(viewer, { lon, lat, groundHeight = 0, range = 600 }) {
  const target = Cesium.Cartesian3.fromDegrees(lon, lat, groundHeight);
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(target, range * 0.6), {
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(-30), // heading: slight rotation for depth
      Cesium.Math.toRadians(-40), // pitch: oblique, not top-down
      range
    ),
    duration: 1.6
  });
}

// Frame the current box: distance scaled to the largest horizontal extent.
export function rangeForBox(state) {
  const span = Math.max(state.width, state.depth, state.height);
  return Cesium.Math.clamp(span * 3.2, 120, 20000);
}
