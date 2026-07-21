import { LS_KEYS, DEFAULT_STATE } from '../config.js';

// Chunk presets: the box definition {lon,lat,groundHeight,width,depth,height,
// rotation}. Persisted to localStorage and importable/exportable as JSON so a
// chunk can be shared or reloaded later. (Mesh export is out of scope for now,
// but this data model is enough to reproduce a chunk exactly.)

const STATE_KEYS = Object.keys(DEFAULT_STATE);

function pickState(state) {
  const out = {};
  for (const k of STATE_KEYS) out[k] = state[k];
  return out;
}

export function saveLastState(state) {
  localStorage.setItem(LS_KEYS.lastState, JSON.stringify(pickState(state)));
}

export function loadLastState() {
  try {
    const raw = localStorage.getItem(LS_KEYS.lastState);
    if (!raw) return null;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (_) {
    return null;
  }
}

function readPresets() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS.presets) || '{}');
  } catch (_) {
    return {};
  }
}

export function listPresetNames() {
  return Object.keys(readPresets()).sort();
}

export function savePreset(name, state) {
  const presets = readPresets();
  presets[name] = pickState(state);
  localStorage.setItem(LS_KEYS.presets, JSON.stringify(presets));
}

export function loadPreset(name) {
  const presets = readPresets();
  return presets[name] ? { ...DEFAULT_STATE, ...presets[name] } : null;
}

export function deletePreset(name) {
  const presets = readPresets();
  delete presets[name];
  localStorage.setItem(LS_KEYS.presets, JSON.stringify(presets));
}

// Export the current chunk as a downloaded .json file.
export function exportJSON(state, name = 'chunk') {
  const blob = new Blob([JSON.stringify(pickState(state), null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Parse an imported .json file into a full state object.
export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        resolve({ ...DEFAULT_STATE, ...parsed });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
