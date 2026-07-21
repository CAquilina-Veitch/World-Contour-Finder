// Central configuration: defaults, localStorage keys, and per-source tuning.

export const LS_KEYS = {
  ionToken: 'wcf.ionToken',
  googleKey: 'wcf.googleKey',
  presets: 'wcf.presets',
  lastState: 'wcf.lastState',
  source: 'wcf.source'
};

// Data source identifiers.
export const SOURCE = {
  ion: 'ion',
  google: 'google'
};

// Default box, centred on the Sydney Opera House so the tool shows something
// interesting on first run once a token is added.
export const DEFAULT_STATE = {
  lon: 151.2153,
  lat: -33.8568,
  groundHeight: 0, // metres above the ellipsoid at the anchor; resolved via ground snap
  width: 200, // east-west extent (metres)
  depth: 200, // north-south extent (metres)
  height: 80, // vertical extent (metres), grows upward from the ground
  rotation: 0 // yaw in radians (reserved; not yet editable in the UI)
};

// Clip / fade behaviour.
export const CLIP_MODE = {
  fade: 'fade', // translucent CustomShader fade outside the box
  hard: 'hard', // ClippingPlaneCollection hard cut
  off: 'off' // no clipping
};

export const DEFAULTS = {
  clipMode: CLIP_MODE.fade,
  outsideAlpha: 0.15, // slider default: 0 = outside invisible, 1 = fully visible
  feather: 8.0, // metres of soft edge on the fade
  groundSnapDebounceMs: 150,
  minDimMeters: 1
};
